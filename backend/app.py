"""Flask application factory for the groundwater risk assessment API.

In development this serves the API only; Vite proxies /api to it from :5173.
In production (Docker / Hugging Face Spaces) the compiled React app is copied
to frontend/dist and this same process serves it, so the whole system runs on
one origin and needs no CORS at all.
"""

from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, jsonify, send_from_directory

from backend.api.routes import api
from backend.utils.validation import ValidationError

# Repo root: backend/app.py → backend/ → root
ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "frontend" / "dist"


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)

    # Only needed when the frontend is served from a different origin — i.e. the
    # Vite dev server. When we serve dist/ ourselves, this is a no-op.
    origins = os.getenv("CORS_ORIGINS", "*")
    if origins:
        from flask_cors import CORS

        CORS(app, resources={r"/api/*": {"origins": origins}})

    # Registered first so /api/* always wins over the SPA catch-all below.
    app.register_blueprint(api)

    # Blueprint-level handlers don't catch everything — register at app level too.
    @app.errorhandler(ValidationError)
    def _validation(e: ValidationError):
        return jsonify({"error": "validation_failed", "details": e.errors}), 400

    @app.errorhandler(500)
    def _server_error(_):
        return jsonify({"error": "internal_error"}), 500

    @app.errorhandler(404)
    def _not_found(_):
        # A missing API route is a real 404. A missing page is the SPA's problem —
        # hand it index.html and let the client router decide.
        return jsonify({"error": "not_found"}), 404

    if DIST.is_dir():

        @app.get("/", defaults={"path": ""})
        @app.get("/<path:path>")
        def spa(path: str):
            """Serve the built React app.

            The catch-all must not swallow /api/*. Without this guard a typo'd
            endpoint returns index.html with a 200, and the frontend's res.json()
            fails on an HTML body — a confusing parse error instead of a clean
            404. An unmatched API path is a real error and must say so in JSON.
            """
            if path.startswith("api/"):
                return jsonify({"error": "not_found"}), 404
            if path and (DIST / path).is_file():
                return send_from_directory(DIST, path)
            return send_from_directory(DIST, "index.html")

    else:
        # No build present — running the API standalone in development.
        @app.get("/")
        def index():
            return jsonify(
                {
                    "service": "Groundwater Quality Risk Assessment API",
                    "note": "No frontend build found; API only.",
                    "endpoints": [
                        "GET  /api/health",
                        "GET  /api/metadata",
                        "POST /api/predict",
                        "POST /api/predict/drinking",
                        "POST /api/predict/irrigation",
                        "POST /api/predict/anomaly",
                        "POST /api/predict/batch",
                    ],
                }
            )

    return app


if __name__ == "__main__":
    create_app().run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", 5000)),
        debug=os.getenv("FLASK_DEBUG", "1") == "1",
    )
