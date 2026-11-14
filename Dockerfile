# SPHEREx Blink 4.0: the SERVING container of the backend (both profiles; BLINK_PROFILE picks one). Read-only public endpoints only:
# archive retrieval and processing are offline jobs and are not in this image. No data, no key and no .env is copied in (.dockerignore).
#
#   docker build -t spherex-blink-api .
#   docker run --rm -p 8080:8080 -e BLINK_PROFILE=edu spherex-blink-api           # the edu profile, from the bundle inside the image
#
# Deploy steps for the full profile (Cloud Run, a private bucket, a read-only service account): docs/DEPLOY_FULL.md.
FROM python:3.12.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080 \
    BLINK_PROFILE=edu REAL_DATA_ENABLED=false SERVE_PIXELS=false \
    BLINK_CACHE_DIR=/tmp/blink-cache EDU_BUNDLE_DIR=/srv/frontend/data/edu APPROVED_SEQUENCES_FILE=/srv/backend/approved_sequences.json

WORKDIR /srv
COPY backend/requirements-serve.txt backend/requirements-serve.txt
RUN pip install --no-cache-dir -r backend/requirements-serve.txt

COPY backend/app.py backend/approved_sequences.json backend/
COPY backend/blink backend/blink
COPY frontend/data/edu frontend/data/edu

RUN useradd --system --uid 10001 blink
USER blink

EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app:app --app-dir backend --host 0.0.0.0 --port ${PORT}"]
