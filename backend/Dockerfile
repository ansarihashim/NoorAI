FROM python:3.11-slim

# ffmpeg is REQUIRED by Whisper for audio decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend

# Pre-download Whisper + embedding models so first request isn't slow
RUN python -m backend.scripts.download_whisper \
    && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

ENV PYTHONUNBUFFERED=1
ENV STORAGE_DIR=/data/storage
RUN mkdir -p /data/storage
VOLUME ["/data/storage"]

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
