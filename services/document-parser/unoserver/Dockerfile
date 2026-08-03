# Ported near-verbatim from ~/REPO/cortex-document-parser/docker/unoserver/Dockerfile
# — the real, deployed sidecar pattern (design doc §1.2), NOT the repo's own
# dead docker/entrypoint.sh alternative (which starts unoserver inside the
# SAME container as the app; that path is never actually used by that
# repo's own Dockerfile/docker-compose.yml — CMD there is plain
# `streamlit run app.py`). Command/port here come from docker-compose.yml's
# `command:`/`healthcheck:` for this service, not from this Dockerfile.
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    libreoffice-draw \
    python3 \
    python3-pip \
    python3-uno \
    fonts-dejavu-core \
    procps \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages unoserver

WORKDIR /app
