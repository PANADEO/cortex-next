# Pydantic response models for the FastAPI layer (main.py). Separate from
# pipeline.py's plain-dataclass ProcessingRecord (internal pipeline result
# shape, ported near-verbatim from legacy) — this module is the actual wire
# contract the Next.js BFF will consume in Faza 2.
#
# Status is intentionally a 3-state set here: "processing" | "done" | "error".
# "queued" (the 4th state in the Postgres schema, packages/@cortex/db/src/
# schema/document-parser.ts) exists ONLY on the Next.js/Postgres side, for the
# brief window between the BFF's INSERT and its call to this backend's
# POST /jobs (D4) — this backend never sees or reports "queued", it always
# answers with "processing" the instant a job is accepted.
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

JobStatus = Literal["processing", "done", "error"]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    # D1's "Runtime & Audit" note: no user-facing page for this, but the
    # health check itself must surface these two flags — for Docker
    # HEALTHCHECK today and a future Konfiguracja Systemu diagnostics panel.
    unoconvert_installed: bool
    unoserver_reachable: bool


class JobCreateResponse(BaseModel):
    job_id: str
    status: JobStatus


class JobRecord(BaseModel):
    job_id: str
    status: JobStatus
    file_name: str
    model: str | None = None
    markdown: str | None = None
    error_message: str | None = None
    page_count: int = 0
    image_count: int = 0
    truncated: bool = False
    elapsed_seconds: float | None = None
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None
