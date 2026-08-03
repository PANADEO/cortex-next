"""FastAPI entrypoint. POST /analyze is stateless — it accepts a FULL config
snapshot in the request body (PROJECT/cortex-frontend-geo-score-calculator-
port-projekt.md D3) and returns a scored result; this service never reads or
writes any database or file, and never sees a request from a browser (no
`ports:` in docker-compose.yml — Next.js is the only caller, server-side
only, see code-python-service/SKILL.md "Bezpieczeństwo").
"""
from fastapi import FastAPI

from models import AnalyzeRequest, AnalyzeResponse
from service import calculate_geo_score

app = FastAPI(title="cortex-frontend GEO Score Calculator service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    return calculate_geo_score(payload)
