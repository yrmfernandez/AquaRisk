# ── Stage 1: build the React frontend ───────────────────────────────
FROM node:20-slim AS frontend

WORKDIR /build

# Copy manifests first so this layer caches when only source changes.
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ ./
RUN npm run build
# → /build/dist


# ── Stage 2: the Python API, serving the built frontend ─────────────
FROM python:3.11-slim

# Hugging Face Spaces runs the container as a non-root user (uid 1000).
RUN useradd -m -u 1000 user

WORKDIR /app

# System deps that xgboost/scipy need at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps before copying source, so dependency layers cache.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Application code and the trained models.
COPY backend/ ./backend/
COPY models/  ./models/

# The compiled React app from stage 1. Flask serves this as static files.
COPY --from=frontend /build/dist ./frontend/dist

RUN chown -R user:user /app
USER user

# Spaces expects the app on 7860.
ENV PORT=7860 \
    FLASK_DEBUG=0 \
    PYTHONUNBUFFERED=1

EXPOSE 7860

# One worker: each loads its own copy of the models, and the free tier is
# memory-limited. Long timeout because the first SHAP call is slow.
CMD ["gunicorn", "backend.app:create_app()", \
     "--bind", "0.0.0.0:7860", \
     "--workers", "1", \
     "--threads", "4", \
     "--timeout", "180"]
