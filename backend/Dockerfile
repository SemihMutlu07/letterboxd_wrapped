# Build context: backend/
# Render injects $PORT at runtime; 8000 is the local fallback.

FROM python:3.11-slim

WORKDIR /app

# Install dependencies first — this layer is cached until requirements.txt changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend directory.
# PYTHONPATH exposes both the package root (/app) and the source sub-directory
# (/app/app) so absolute imports like "from analysis_utils import ..." keep working.
COPY . /app
ENV PYTHONPATH=/app:/app/app

# Shell form (not JSON/exec) so the shell expands ${PORT:-8000} correctly.
CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
