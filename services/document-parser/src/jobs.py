# In-memory job state, process-lifetime only (design doc D2/D4): this
# backend has no persistent database. Postgres (owned by the Next.js BFF,
# document_parser.jobs — Faza 2, out of scope here) is the durable source
# of truth once a job reaches "done"/"error"; this store only needs to
# survive long enough for the BFF's poll loop to observe the final state
# and mirror it, hence TTL eviction rather than unbounded growth.
#
# asyncio.Lock, not threading.Lock: every access happens from the single
# asyncio event loop (main.py never touches this from a worker thread) —
# see main.py's _run_job, which runs the actual (blocking) pipeline work
# via asyncio.to_thread and only touches the store from the event loop
# before/after that call.
from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from src.models import JobRecord

DEFAULT_TTL_SECONDS = 3600  # 1h retention for finished jobs — plenty of time
# for a BFF poll loop (architecture_rules.md §5: refetchInterval ~2s) to
# observe "done"/"error" and mirror it into Postgres; this is a lightweight
# safety net against unbounded memory growth, not a durability guarantee
# (D4's accepted MVP trade-off: an in-flight job lost on backend restart).


@dataclass
class _JobEntry:
    record: JobRecord
    finished_monotonic: float | None = None


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class JobStore:
    def __init__(self, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> None:
        self._ttl_seconds = ttl_seconds
        self._entries: dict[str, _JobEntry] = {}
        self._lock = asyncio.Lock()

    async def create(self, file_name: str, model: str | None) -> JobRecord:
        async with self._lock:
            self._evict_expired_locked()
            job_id = uuid.uuid4().hex[:12]
            record = JobRecord(
                job_id=job_id,
                status="processing",
                file_name=file_name,
                model=model,
                created_at=_now_iso(),
                started_at=_now_iso(),
            )
            self._entries[job_id] = _JobEntry(record=record)
            return record

    async def get(self, job_id: str) -> JobRecord | None:
        async with self._lock:
            self._evict_expired_locked()
            entry = self._entries.get(job_id)
            return entry.record if entry else None

    async def mark_done(
        self,
        job_id: str,
        *,
        markdown: str,
        model: str,
        page_count: int,
        image_count: int,
        truncated: bool,
        elapsed_seconds: float,
    ) -> None:
        await self._update(
            job_id,
            status="done",
            markdown=markdown,
            model=model,
            page_count=page_count,
            image_count=image_count,
            truncated=truncated,
            elapsed_seconds=elapsed_seconds,
            completed_at=_now_iso(),
        )

    async def mark_error(
        self,
        job_id: str,
        *,
        error_message: str,
        elapsed_seconds: float | None = None,
        model: str | None = None,
        page_count: int = 0,
        image_count: int = 0,
        truncated: bool = False,
    ) -> None:
        # page_count/image_count/truncated matter even on the error path:
        # the pipeline can fail AFTER conversion+render succeed (e.g. the
        # vision-LLM call itself fails) — losing those numbers here would
        # make "conversion never worked" and "conversion worked, the model
        # call failed" indistinguishable to whatever reads this record,
        # defeating D1's requirement to tell those error cases apart.
        await self._update(
            job_id,
            status="error",
            error_message=error_message,
            elapsed_seconds=elapsed_seconds,
            model=model,
            page_count=page_count,
            image_count=image_count,
            truncated=truncated,
            completed_at=_now_iso(),
        )

    async def _update(self, job_id: str, **changes: object) -> None:
        async with self._lock:
            entry = self._entries.get(job_id)
            if entry is None:
                return
            entry.record = entry.record.model_copy(update=changes)
            if entry.record.status in ("done", "error"):
                entry.finished_monotonic = time.monotonic()

    def _evict_expired_locked(self) -> None:
        now = time.monotonic()
        expired = [
            job_id
            for job_id, entry in self._entries.items()
            if entry.finished_monotonic is not None and now - entry.finished_monotonic > self._ttl_seconds
        ]
        for job_id in expired:
            del self._entries[job_id]
