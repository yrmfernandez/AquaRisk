"""Flask application factory for the groundwater risk assessment API."""

from __future__ import annotations

import os

from flask import Flask, jsonify
from flask_cors import CORS

from backend.api.routes import api
from backend.utils.validation import ValidationError


def create_app() -> Flask:
    app = Flask(__name__)

    # The React dev server needs CORS; lock this down in production.
    CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})

    app.register_blueprint(api)

    # Blueprint-level handlers don't catch everything — register at app level too.
    @app.errorhandler(ValidationError)
    def _validation(e: ValidationError):
        return jsonify({"error": "validation_failed", "details": e.errors}), 400

    @app.errorhandler(404)
    def _not_found(_):
        return jsonify({"error": "not_found"}), 404

    @app.errorhandler(500)
    def _server_error(_):
        return jsonify({"error": "internal_error"}), 500

    @app.get("/")
    def index():
        return jsonify({
            "service": "Groundwater Quality Risk Assessment API",
            "endpoints": [
                "GET  /api/health",
                "GET  /api/metadata",
                "POST /api/predict",
                "POST /api/predict/drinking",
                "POST /api/predict/irrigation",
                "POST /api/predict/anomaly",
                "POST /api/predict/batch",
            ],
        })

    return app


if __name__ == "__main__":
    create_app().run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", 5000)),
        debug=os.getenv("FLASK_DEBUG", "1") == "1",
    )
