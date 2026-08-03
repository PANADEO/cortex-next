# FastAPI wrapper — design doc D3/D4 API contract. Internal-only service
# (D6): no auth here, reachable exclusively via Docker DNS from the Next.js
# BFF, never from a browser (see code-python-service SKILL.md "Bezpieczeństwo").
#
# POST /jobs answers 202 the instant the upload is read and a job_id is
# minted — actual processing (unoconvert -> pypdfium2 -> vision LLM call,
# easily tens of seconds) runs via asyncio.create_task + asyncio.to_thread,
# NOT FastAPI's BackgroundTasks. Reasoning matters here: BackgroundTasks
# runs its callback on the same event loop after the response is sent, but
# DocumentPipeline.process() is a blocking, synchronous function (subprocess
# calls, file I/O) — running it directly on the event loop would stall
# every other request (GET /jobs/{id} polls, GET /health, other POST /jobs)
# for the full duration of that one job. asyncio.to_thread hands the
# blocking work to a worker thread so the event loop stays free — this is
# the actual mechanism behind D4's "202 fast even though real processing
# takes longer" property, not just the immediate response.
from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from src.config import Config
from src.jobs import JobStore
from src.models import HealthResponse, JobCreateResponse, JobRecord
from src.pipeline import DocumentPipeline

logger = logging.getLogger("document-parser")

config = Config.from_env()
pipeline = DocumentPipeline(config)
job_store = JobStore()

app = FastAPI(title="document-parser")


@app.get("/health")
def health() -> HealthResponse:
    status = pipeline.get_runtime_status()
    return HealthResponse(
        status="ok",
        unoconvert_installed=status.unoconvert_installed,
        unoserver_reachable=status.unoserver_reachable,
    )


@app.post("/jobs", status_code=202)
async def create_job(
    file: UploadFile = File(...),
    user_email: str = Form(""),
    model: str | None = Form(None),
) -> JobCreateResponse:
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="uploaded file is empty")

    max_bytes = config.max_upload_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail=f"file exceeds MAX_UPLOAD_MB ({config.max_upload_mb} MB)")

    file_name = file.filename or "upload.bin"
    resolved_model = (model or config.vision_model or "").strip() or None

    record = await job_store.create(file_name=file_name, model=resolved_model)
    # Fire-and-forget: NOT awaited. The request handler returns as soon as
    # this task is scheduled — see module docstring for why to_thread (not
    # BackgroundTasks-on-the-loop) is what actually keeps the event loop
    # free for the polling GET /jobs/{id} requests that follow.
    asyncio.create_task(_run_job(record.job_id, file_name, file_bytes, resolved_model, user_email))

    return JobCreateResponse(job_id=record.job_id, status=record.status)


@app.get("/jobs/{job_id}")
async def get_job(job_id: str) -> JobRecord:
    record = await job_store.get(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="job not found")
    return record


async def _run_job(job_id: str, file_name: str, file_bytes: bytes, model: str | None, user_email: str) -> None:
    try:
        result = await asyncio.to_thread(pipeline.process, file_name, file_bytes, "", model, user_email)
    except Exception:  # pragma: no cover - pipeline.process() already catches
        # its own domain errors and returns an error ProcessingRecord; this
        # is a last-resort net against a genuinely unexpected exception
        # (e.g. a bug in the thread hand-off itself) so one bad job can
        # never leave job_store stuck on "processing" forever.
        logger.exception("document-parser: unexpected failure running job %s", job_id)
        await job_store.mark_error(job_id, error_message="internal error while processing the document")
        return

    if result.status == "success":
        await job_store.mark_done(
            job_id,
            markdown=result.markdown,
            model=result.model,
            page_count=result.page_count,
            image_count=result.image_count,
            truncated=result.truncated,
            elapsed_seconds=result.elapsed_seconds,
        )
    else:
        await job_store.mark_error(
            job_id,
            error_message=result.error_message or "processing failed",
            elapsed_seconds=result.elapsed_seconds,
            model=result.model,
            page_count=result.page_count,
            image_count=result.image_count,
            truncated=result.truncated,
        )
