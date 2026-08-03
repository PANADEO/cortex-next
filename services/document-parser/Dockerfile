# Single-stage, per .claude/skills/code-python-service/SKILL.md — copied
# from services/_template-python-service/Dockerfile (the real, verified
# starting point for every Python service in this repo), extended only
# where this service actually differs from the template.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# curl: HEALTHCHECK below needs an HTTP client (python:slim has none on
# PATH). No other system packages — `unoconvert` (src/pipeline.py) is a
# pure-Python RPC client from the `unoserver` pip package; the actual
# LibreOffice/UNO bindings live only in the unoserver/ sidecar image.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
