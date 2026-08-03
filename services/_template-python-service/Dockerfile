# Single-stage build — a deliberate departure from the root Dockerfile's
# multi-stage layout, not a shortcut. The root Dockerfile's stages
# (deps/builder/runner) exist because `next build` produces compiled
# artifacts (standalone server, static assets) that must be copied into a
# leaner final image, and pnpm's workspace symlink layout needs isolating
# from the build toolchain. Neither reason applies to a pure-Python FastAPI
# service: `pip install` IS the build step, and it produces exactly the
# runtime environment the app needs — there's no separate compiled artifact
# to extract into a slimmer stage. `python:3.12-slim` is already the leanest
# reasonable base. If a real service under services/ later needs native
# extensions compiled from source (e.g. a package without a prebuilt wheel
# for this platform), THAT is the point to introduce a builder stage that
# compiles into a venv/wheelhouse and copies only the result here — not
# before, per YAGNI (architecture_rules.md §1).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# curl only: python:slim has no HTTP client on PATH, and the HEALTHCHECK
# below needs one. Mirrors PANADEO/cortex-document-parser's Dockerfile,
# which installs curl for the identical reason.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# 8000 (uvicorn's own default), not 80 like the root Dockerfile's Next.js
# `runner` stage. Node's port 80 there is a convention for that image alone,
# not a repo-wide rule — Python services reached only via Docker DNS
# (code-integration "Docker/sieć") are free to use the ecosystem-idiomatic
# FastAPI/uvicorn default. No `ports:` mapping in docker-compose.yml: this
# service is never meant to be reachable from the host, only from other
# containers on the same Docker network — see code-python-service skill.
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
