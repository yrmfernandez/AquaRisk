# Groundwater Risk Assessment API

Flask API serving the three trained models: drinking-water risk, irrigation suitability,
and anomaly detection — with SHAP explanations.

## Run

```bash
pip install -r backend/requirements.txt
python -m backend.app                  # http://127.0.0.1:5000
```

Production: `gunicorn "backend.app:create_app()" -b 0.0.0.0:5000 -w 2`

> Run from the **project root** (the module path is `backend.app`).
> Models are loaded once per process from `models/`; override with `MODELS_DIR`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/health` | Liveness + confirms all 3 models loaded |
| GET  | `/api/metadata` | Field list, valid ranges, known districts — drives the frontend form |
| POST | `/api/predict` | **All three models** on one well (what the dashboard calls) |
| POST | `/api/predict/drinking` | Drinking risk only |
| POST | `/api/predict/irrigation` | Irrigation class only |
| POST | `/api/predict/anomaly` | Anomaly score only |
| POST | `/api/predict/batch` | Up to 500 wells; per-row errors are non-fatal |

Add `?explain=false` to skip SHAP (faster). Batch defaults to `explain=false`.

## Request

One flat payload. All 13 chemistry fields are required; `district` and `year` are optional.

```json
{
  "ph": 7.9, "tds": 2040, "co3": 13, "hco3": 460, "cl": 568,
  "f": 1.6, "no3": 222, "so4": 110, "na": 360, "k": 32,
  "ca": 141, "mg": 105, "th": 787,
  "district": "Nalgonda", "year": 2020
}
```

## Response (`POST /api/predict`)

```json
{
  "drinking": {
    "risk": "High",
    "confidence": 0.9724,
    "probabilities": {"Safe": 0.0014, "Moderate": 0.0263, "High": 0.9724},
    "explanation": [
      {"feature": "hco3", "contribution": 1.3345, "direction": "increases"},
      {"feature": "na",   "contribution": 0.4448, "direction": "increases"}
    ]
  },
  "irrigation": {
    "irrigation_class": "C4S2",
    "salinity_hazard": "C4",
    "sodium_hazard": "S2",
    "confidence": 0.8659,
    "explanation": [...]
  },
  "anomaly": {
    "is_anomaly": true,
    "anomaly_score": -0.0154,
    "interpretation": "Chemistry is unusual ... recommend manual review / re-testing."
  }
}
```

## Design notes

**One payload, three feature sets.** Each model was trained on a *different* feature set
(deliberately — see notebooks 03/04/05):

- **drinking** — 38 features: contextual only (`year`, `na`, `k`, `co3`, `hco3` + 33 one-hot
  districts). BIS-tested chemistry is **excluded** because it mechanically defines the label;
  including it would make the model a threshold lookup, not a predictor.
- **irrigation** — 12 raw ion-chemistry features (EC/SAR/TDS excluded as circular).
- **anomaly** — the **full** 13-parameter panel. Not leakage: Isolation Forest is unsupervised,
  so there is no label to leak into.

The API builds each model's vector internally. The frontend never needs to know any of this.

**Unknown districts** don't fail. The one-hot dummies stay zero, the model predicts from
chemistry alone, and the response carries a `warning` field.

**Validation** rejects physically impossible values (e.g. `ph: 99`) before they reach a model —
otherwise you get a confident prediction from a unit error.

## Caveats

- SHAP explains **what the model learned**, not ground truth. A feature that merely correlates
  with contamination will still show a large contribution.
- The drinking model's macro-F1 is ~0.67 and the `Moderate` class is weakest (F1 ~0.41) — it is
  a **triage aid for prioritising testing**, not a substitute for a lab panel.
