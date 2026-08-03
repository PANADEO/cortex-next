# Copied from services/_template-python-service/Dockerfile (code-python-service
# SKILL.md) and extended with spaCy + the Polish model. Single-stage build is
# still correct here: `pip install` remains the whole build step, and
# `pl_core_news_sm` is just another package installed into the same image —
# no compiled artifact to extract into a leaner stage.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# curl only: python:slim has no HTTP client on PATH, and the HEALTHCHECK
# below needs one.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# The Polish spaCy model is downloaded HERE, at build time — never at
# container start. This is the concrete requirement from the design doc (D2
# Option A: "Dockerfile z pl_core_news_sm wbudowanym w obraz, build-time
# `python -m spacy download`, nie runtime-download"). A runtime download would
# make every cold start depend on network access to GitHub releases and would
# silently degrade the action-verbs analyzer to its heuristic fallback
# whenever that download failed — exactly the failure mode this step exists
# to rule out. Verified empirically: see the docker build/run log in the
# implementation report.
RUN python -m spacy download pl_core_news_sm

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# 8000 (uvicorn's own default) — this service is reached exclusively via
# Docker DNS from cortex-frontend, never from a host port (no `ports:` in
# docker-compose.yml, see code-python-service/SKILL.md).
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
