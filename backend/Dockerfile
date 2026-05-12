FROM python:3.11-slim

# ffmpeg is REQUIRED by Whisper for audio decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first so the layer is cached across code changes.
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source. The repo holds the package at backend/app/ — we copy
# it into /app/app so `uvicorn app.main:app` resolves cleanly.
COPY backend/app       ./app
COPY backend/alembic.ini ./alembic.ini

# Pre-download Whisper + embedding models so first request isn't slow
RUN python -m app.scripts.download_whisper \
    && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    STORAGE_DIR=/data/storage

RUN mkdir -p /data/storage
VOLUME ["/data/storage"]

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
