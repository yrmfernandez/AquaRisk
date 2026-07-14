# ── Stage 1: build the React frontend ───────────────────────────────
FROM node:20-slim AS frontend

WORKDIR /build

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ ./
RUN npm run build


# ── Stage 2: the Python API, serving the built frontend ─────────────
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Use backend/requirements.txt — the root one is for notebooks.
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY models/  ./models/

COPY --from=frontend /build/dist ./frontend/dist

ENV FLASK_DEBUG=0 \
    PYTHONUNBUFFERED=1

CMD gunicorn "backend.app:create_app()" --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 180
