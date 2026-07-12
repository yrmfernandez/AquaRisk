"""
Prediction service — loads the three trained models once and serves predictions.

Design note
-----------
Each model was trained on a DIFFERENT feature set (deliberately — see notebooks 03/04/05):

  drinking   : 38 features — contextual only (year, na, k, co3, hco3 + 33 one-hot districts).
               BIS-tested chemistry is EXCLUDED because it mechanically defines the label.
  irrigation : 12 features — raw ion chemistry (EC/SAR/TDS excluded as circular).
  anomaly    : 13 features — the FULL chemistry panel. Not leakage: it is unsupervised,
               so there is no label to leak into.

The API therefore accepts ONE flat well payload and builds each model's feature vector
internally. The frontend must not need to know any of the above.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import joblib
import numpy as np
import pandas as pd

MODELS_DIR = os.getenv(
    "MODELS_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "models"),
)

# --- Feature contracts (must match the training notebooks exactly) ---------
IRRIGATION_FEATURES = ["ph", "co3", "hco3", "cl", "f", "no3", "so4",
                       "na", "k", "ca", "mg", "th"]

ANOMALY_FEATURES = ["ph", "tds", "co3", "hco3", "cl", "f", "no3", "so4",
                    "na", "k", "ca", "mg", "th"]

# Chemistry the drinking model is allowed to see (non-BIS only)
DRINKING_CHEM = ["co3", "hco3", "na", "k"]

# Every field a caller may supply
ALL_CHEM = ANOMALY_FEATURES


class ModelBundle:
    """Holds all loaded artifacts. Instantiated once at startup."""

    def __init__(self, models_dir: str = MODELS_DIR):
        d = models_dir

        self.drinking_model = joblib.load(f"{d}/drinking/drinking_model.pkl")
        self.drinking_feats = joblib.load(f"{d}/drinking/feature_names.pkl")
        self.drinking_classes = joblib.load(f"{d}/drinking/label_encoder.pkl")["classes_"]

        self.irrigation_model = joblib.load(f"{d}/irrigation/irrigation_model.pkl")
        self.irrigation_feats = joblib.load(f"{d}/irrigation/feature_names.pkl")
        self.irrigation_classes = joblib.load(f"{d}/irrigation/label_encoder.pkl")["classes_"]

        self.anomaly_model = joblib.load(f"{d}/anomaly/isolation_forest.pkl")
        self.anomaly_scaler = joblib.load(f"{d}/anomaly/anomaly_scaler.pkl")
        self.anomaly_feats = joblib.load(f"{d}/anomaly/anomaly_features.pkl")

        # Districts the drinking model knows about, recovered from its one-hot columns
        self.known_districts = sorted(
            c[len("dist_"):] for c in self.drinking_feats if c.startswith("dist_")
        )

        self._shap_drinking = None
        self._shap_irrigation = None

    # SHAP explainers are lazy: they cost ~1s to build and aren't needed
    # unless the caller asks for an explanation.
    @property
    def shap_drinking(self):
        if self._shap_drinking is None:
            import shap
            self._shap_drinking = shap.TreeExplainer(self.drinking_model)
        return self._shap_drinking

    @property
    def shap_irrigation(self):
        if self._shap_irrigation is None:
            import shap
            self._shap_irrigation = shap.TreeExplainer(self.irrigation_model)
        return self._shap_irrigation


@lru_cache(maxsize=1)
def get_models() -> ModelBundle:
    """Singleton — models load once per process, not per request."""
    return ModelBundle()


# --- Feature-vector builders ----------------------------------------------

def _build_drinking_row(well: dict[str, Any], mb: ModelBundle) -> pd.DataFrame:
    row = {c: 0 for c in mb.drinking_feats}
    row["year"] = well.get("year", 2020)
    for c in DRINKING_CHEM:
        row[c] = well[c]

    district = well.get("district")
    col = f"dist_{district}"
    if col in row:
        row[col] = 1
    # Unknown district -> all dummies stay 0. The model still predicts from
    # chemistry; it just has no location prior. We surface this to the caller.

    return pd.DataFrame([row])[mb.drinking_feats]


def _build_frame(well: dict[str, Any], feats: list[str]) -> pd.DataFrame:
    return pd.DataFrame([{f: well[f] for f in feats}])[feats]


def _top_shap(values: np.ndarray, feats: list[str], k: int = 6) -> list[dict]:
    """Return the k features with the largest absolute contribution."""
    s = pd.Series(values, index=feats)
    s = s[s.abs() > 1e-6].sort_values(key=abs, ascending=False).head(k)
    return [
        {
            "feature": f,
            "contribution": round(float(v), 4),
            "direction": "increases" if v > 0 else "decreases",
        }
        for f, v in s.items()
    ]


def _normalise_shap(raw, n_classes: int) -> np.ndarray:
    """SHAP returns different shapes across versions. Force (classes, samples, features)."""
    arr = np.array(raw)
    if arr.ndim == 3 and arr.shape[-1] == n_classes:
        arr = np.transpose(arr, (2, 0, 1))
    return arr


# --- Public prediction API -------------------------------------------------

def predict_drinking(well: dict[str, Any], explain: bool = True) -> dict:
    mb = get_models()
    X = _build_drinking_row(well, mb)

    proba = mb.drinking_model.predict_proba(X)[0]
    idx = int(proba.argmax())

    out = {
        "risk": mb.drinking_classes[idx],
        "confidence": round(float(proba[idx]), 4),
        "probabilities": {
            cls: round(float(p), 4) for cls, p in zip(mb.drinking_classes, proba)
        },
    }

    district = well.get("district")
    if district and district not in mb.known_districts:
        out["warning"] = (
            f"District '{district}' was not in the training data. Prediction is based on "
            "chemistry alone, with no location prior."
        )

    if explain:
        sv = _normalise_shap(mb.shap_drinking.shap_values(X), len(mb.drinking_classes))
        out["explanation"] = _top_shap(sv[idx][0], list(X.columns))

    return out


def predict_irrigation(well: dict[str, Any], explain: bool = True) -> dict:
    mb = get_models()
    X = _build_frame(well, mb.irrigation_feats)

    proba = mb.irrigation_model.predict_proba(X)[0]
    idx = int(proba.argmax())
    cls = mb.irrigation_classes[idx]

    out = {
        "irrigation_class": cls,
        "salinity_hazard": cls[:2],   # e.g. "C3"
        "sodium_hazard": cls[2:],     # e.g. "S1"
        "confidence": round(float(proba[idx]), 4),
        "probabilities": {
            c: round(float(p), 4) for c, p in zip(mb.irrigation_classes, proba)
        },
    }

    if explain:
        sv = _normalise_shap(mb.shap_irrigation.shap_values(X), len(mb.irrigation_classes))
        out["explanation"] = _top_shap(sv[idx][0], list(X.columns))

    return out


def predict_anomaly(well: dict[str, Any]) -> dict:
    mb = get_models()
    X = _build_frame(well, mb.anomaly_feats)
    Xs = mb.anomaly_scaler.transform(X)

    score = float(mb.anomaly_model.decision_function(Xs)[0])
    is_anom = bool(mb.anomaly_model.predict(Xs)[0] == -1)

    return {
        "is_anomaly": is_anom,
        "anomaly_score": round(score, 4),
        "interpretation": (
            "Chemistry is unusual relative to the reference population — recommend "
            "manual review / re-testing."
            if is_anom else
            "Chemistry falls within the normal range for this region."
        ),
    }


def predict_all(well: dict[str, Any], explain: bool = True) -> dict:
    """All three models on one well — the endpoint the dashboard actually wants."""
    return {
        "drinking": predict_drinking(well, explain=explain),
        "irrigation": predict_irrigation(well, explain=explain),
        "anomaly": predict_anomaly(well),
    }
