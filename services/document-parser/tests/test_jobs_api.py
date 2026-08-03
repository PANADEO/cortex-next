# Proves the D4 async-model correctness property this whole design hinges
# on: POST /jobs answers fast regardless of how long real processing takes,
# and — the part that's easy to get wrong (see src/main.py's docstring on
# why asyncio.to_thread, not bare BackgroundTasks) — the event loop stays
# free to serve OTHER requests (health checks, polls) while a job runs.
#
# `with TestClient(app) as client:` is required, not cosmetic: it triggers
# FastAPI's lifespan and keeps a single persistent event loop running in a
# background thread for the whole `with` block, so an asyncio.create_task()
# scheduled during one request is still running (and observable) on a
# later, separate request — exactly the real deployment shape (one
# long-lived uvicorn process, many requests).
import time
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import src.main as main_module
from src.main import app
from src.pipeline import ProcessingRecord


def _slow_success_record(*_args, **_kwargs) -> ProcessingRecord:
    # pipeline.process is patched as a plain Mock (not a bound method), so it
    # receives main.py's call args positionally: (file_name, file_bytes,
    # prompt, model, user_email). The record's own job_id is irrelevant —
    # main.py's _run_job keys job_store updates off the store-assigned
    # job_id, never result.job_id (see src/main.py).
    time.sleep(0.4)
    return ProcessingRecord(
        job_id="mocked",
        file_name="test.png",
        model="test/vision-model",
        prompt="prompt",
        markdown="# Extracted",
        status="success",
        created_at="2026-08-03T00:00:00+00:00",
        elapsed_seconds=0.4,
        page_count=1,
        image_count=1,
        truncated=False,
        error_message=None,
    )


def _fast_error_record(*_args, **_kwargs) -> ProcessingRecord:
    return ProcessingRecord(
        job_id="mocked",
        file_name="bad.zip",
        model="test/vision-model",
        prompt="prompt",
        markdown="",
        status="error",
        created_at="2026-08-03T00:00:00+00:00",
        elapsed_seconds=0.01,
        page_count=0,
        image_count=0,
        truncated=False,
        error_message="unoconvert failed (exit 1): unsupported format",
    )


def _vision_call_failed_after_conversion_record(*_args, **_kwargs) -> ProcessingRecord:
    # Regression fixture: conversion + PDF render SUCCEEDED (page_count/
    # image_count are non-zero) and only the vision-LLM call failed —
    # exactly what a real end-to-end run against the running cortex-proxy
    # produced (fake model name rejected with a 400, after unoconvert/
    # pypdfium2 had already done their job). main.py's error path used to
    # drop these numbers on the floor; job_store.mark_error() now threads
    # them through (see src/jobs.py).
    return ProcessingRecord(
        job_id="mocked",
        file_name="smoke-test.docx",
        model="test/fake-vision-model",
        prompt="prompt",
        markdown="",
        status="error",
        created_at="2026-08-03T00:00:00+00:00",
        elapsed_seconds=0.78,
        page_count=1,
        image_count=1,
        truncated=False,
        error_message="OpenAI request failed: test/fake-vision-model is not a valid model ID",
    )


def test_post_jobs_returns_202_fast_even_though_processing_is_slow():
    with patch.object(main_module.pipeline, "process", side_effect=_slow_success_record):
        with TestClient(app) as client:
            started = time.monotonic()
            response = client.post("/jobs", files={"file": ("test.png", b"fake-bytes", "image/png")})
            elapsed = time.monotonic() - started

    assert response.status_code == 202
    assert elapsed < 1.0, f"POST /jobs took {elapsed:.2f}s — should return long before the 0.4s pipeline finishes"
    body = response.json()
    assert body["status"] == "processing"
    assert body["job_id"]


def test_event_loop_stays_responsive_while_a_job_is_processing():
    """The regression this guards against: if the blocking pipeline ran
    directly on the event loop (e.g. via bare BackgroundTasks instead of
    asyncio.to_thread), THIS request would queue behind it and take ~0.4s
    too — defeating the purpose of polling."""
    with patch.object(main_module.pipeline, "process", side_effect=_slow_success_record):
        with TestClient(app) as client:
            client.post("/jobs", files={"file": ("test.png", b"fake-bytes", "image/png")})

            started = time.monotonic()
            health_response = client.get("/health")
            elapsed = time.monotonic() - started

    assert health_response.status_code == 200
    assert elapsed < 0.2, f"GET /health took {elapsed:.2f}s — event loop was blocked by the in-flight job"


def test_job_transitions_from_processing_to_done():
    with patch.object(main_module.pipeline, "process", side_effect=_slow_success_record):
        with TestClient(app) as client:
            create_response = client.post("/jobs", files={"file": ("test.png", b"fake-bytes", "image/png")})
            job_id = create_response.json()["job_id"]

            record = _poll_until_terminal(client, job_id)

    assert record["status"] == "done"
    assert record["markdown"] == "# Extracted"
    assert record["page_count"] == 1


def test_job_transitions_from_processing_to_error():
    with patch.object(main_module.pipeline, "process", side_effect=_fast_error_record):
        with TestClient(app) as client:
            create_response = client.post("/jobs", files={"file": ("bad.zip", b"fake-bytes", "application/zip")})
            job_id = create_response.json()["job_id"]

            record = _poll_until_terminal(client, job_id)

    assert record["status"] == "error"
    assert "unsupported format" in record["error_message"]


def test_error_after_successful_conversion_preserves_page_and_image_counts():
    with patch.object(main_module.pipeline, "process", side_effect=_vision_call_failed_after_conversion_record):
        with TestClient(app) as client:
            create_response = client.post(
                "/jobs", files={"file": ("smoke-test.docx", b"fake-bytes", "application/vnd.ms-word")}
            )
            job_id = create_response.json()["job_id"]

            record = _poll_until_terminal(client, job_id)

    assert record["status"] == "error"
    assert record["page_count"] == 1
    assert record["image_count"] == 1
    assert "not a valid model ID" in record["error_message"]


def test_get_unknown_job_returns_404():
    with TestClient(app) as client:
        response = client.get("/jobs/does-not-exist")
    assert response.status_code == 404


def test_post_jobs_rejects_empty_file():
    with TestClient(app) as client:
        response = client.post("/jobs", files={"file": ("empty.png", b"", "image/png")})
    assert response.status_code == 400


def _poll_until_terminal(client: TestClient, job_id: str, timeout_s: float = 3.0) -> dict:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        response = client.get(f"/jobs/{job_id}")
        assert response.status_code == 200
        body = response.json()
        if body["status"] != "processing":
            return body
        time.sleep(0.05)
    raise AssertionError(f"job {job_id} did not reach a terminal state within {timeout_s}s")
