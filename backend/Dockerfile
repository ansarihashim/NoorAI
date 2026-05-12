FROM python:3.11-slim

WORKDIR /app

# Install deps first so the layer is cached across code changes.
# No system packages are required — STT (Whisper) was removed and every
# remaining ML dependency runs on a hosted API.
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source. The repo holds the package at backend/app/ — we copy
# it into /app/app so `uvicorn app.main:app` resolves cleanly.
COPY backend/app       ./app
COPY backend/alembic.ini ./alembic.ini

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    STORAGE_DIR=/data/storage

RUN mkdir -p /data/storage
VOLUME ["/data/storage"]

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
