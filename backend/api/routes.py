"""API routes for the groundwater risk assessment system."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from backend.services import predictor
from backend.utils.validation import ValidationError, validate_well

api = Blueprint("api", __name__, url_prefix="/api")

MAX_BATCH = 500


@api.errorhandler(ValidationError)
def _handle_validation(e: ValidationError):
    return jsonify({"error": "validation_failed", "details": e.errors}), 400


@api.get("/health")
def health():
    """Liveness + confirmation that all three models actually loaded."""
    try:
        mb = predictor.get_models()
        return jsonify({
            "status": "ok",
            "models": {
                "drinking": {
                    "classes": list(mb.drinking_classes),
                    "n_features": len(mb.drinking_feats),
                },
                "irrigation": {
                    "classes": list(mb.irrigation_classes),
                    "n_features": len(mb.irrigation_feats),
                },
                "anomaly": {"n_features": len(mb.anomaly_feats)},
            },
        })
    except Exception as exc:  # noqa: BLE001 — health must report, not raise
        return jsonify({"status": "error", "detail": str(exc)}), 503


@api.get("/metadata")
def metadata():
    """Everything the frontend needs to build its input form."""
    from backend.utils.validation import RANGES, REQUIRED

    mb = predictor.get_models()
    return jsonify({
        "required_fields": REQUIRED,
        "field_ranges": {k: {"min": lo, "max": hi} for k, (lo, hi) in RANGES.items()},
        "districts": mb.known_districts,
        "drinking_classes": list(mb.drinking_classes),
        "irrigation_classes": list(mb.irrigation_classes),
    })


@api.post("/predict/drinking")
def predict_drinking():
    well = validate_well(request.get_json(silent=True))
    explain = request.args.get("explain", "true").lower() != "false"
    return jsonify(predictor.predict_drinking(well, explain=explain))


@api.post("/predict/irrigation")
def predict_irrigation():
    well = validate_well(request.get_json(silent=True))
    explain = request.args.get("explain", "true").lower() != "false"
    return jsonify(predictor.predict_irrigation(well, explain=explain))


@api.post("/predict/anomaly")
def predict_anomaly():
    well = validate_well(request.get_json(silent=True))
    return jsonify(predictor.predict_anomaly(well))


@api.post("/predict")
def predict_all():
    """All three models on one well — what the dashboard calls."""
    well = validate_well(request.get_json(silent=True))
    explain = request.args.get("explain", "true").lower() != "false"
    return jsonify(predictor.predict_all(well, explain=explain))


@api.post("/predict/batch")
def predict_batch():
    """Score many wells at once. Per-row errors are reported, not fatal."""
    body = request.get_json(silent=True)
    if not isinstance(body, list):
        return jsonify({
            "error": "validation_failed",
            "details": ["Body must be a JSON array of well objects."],
        }), 400

    if len(body) > MAX_BATCH:
        return jsonify({
            "error": "batch_too_large",
            "details": [f"Maximum {MAX_BATCH} wells per request, got {len(body)}."],
        }), 413

    # SHAP is expensive; default it off for batches.
    explain = request.args.get("explain", "false").lower() == "true"

    results, errors = [], []
    for i, raw in enumerate(body):
        try:
            well = validate_well(raw)
            results.append({"index": i, **predictor.predict_all(well, explain=explain)})
        except ValidationError as e:
            errors.append({"index": i, "errors": e.errors})

    return jsonify({
        "predicted": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    })
