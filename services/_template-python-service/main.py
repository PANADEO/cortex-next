# Minimal FastAPI app — the entire template. Real services (geo-score-calculator,
# document-parser) start from a copy of this file and grow their own routers;
# this one stays exactly this small, on purpose (see .claude/skills/code-python-service).
from fastapi import FastAPI

app = FastAPI(title="cortex-frontend Python service template")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
