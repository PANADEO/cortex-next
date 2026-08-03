# Config for THIS service only (code-config convention: no shared, growing
# config file — every module owns its own env var surface).
#
# Ported from ~/REPO/cortex-document-parser/src/utils/config.py, trimmed to
# what this backend actually needs per D2 (compute-only, no own DB, no auth):
# dropped cortex_admin_url/cortex_admin_api_key/disable_permission_check
# (cortex-admin auth is dead in this repo — D6, requireTileAccess() in
# Next.js is the only gate), refresh_interval/sqlite_path (legacy Streamlit
# queue concerns, replaced by jobs.py's in-memory store).
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Config:
    cortex_api_url: str
    cortex_api_key: str
    application_name: str
    # DOCUMENT_PARSER_VISION_MODEL: deliberately NO hardcoded default (design
    # doc Q3) — legacy's "gpt-5.2" placeholder was explicitly called out as
    # unverified. Empty string here is a valid parsed value; the pipeline
    # raises a clear DependencyError only when a job actually needs the
    # model and none was resolved (env unset AND no per-call override).
    vision_model: str
    max_pages: int
    pdf_render_dpi: int
    max_upload_mb: int
    temp_dir: Path
    keep_artifacts: bool
    uno_host: str
    uno_port: int
    uno_timeout_s: int

    @classmethod
    def from_env(cls) -> "Config":
        temp_dir = Path(os.getenv("TEMP_DIR", "/tmp/document-parser"))
        temp_dir.mkdir(parents=True, exist_ok=True)

        return cls(
            cortex_api_url=(os.getenv("CORTEX_PROXY_URL") or "http://localhost:8240").strip().rstrip("/"),
            cortex_api_key=os.getenv("CORTEX_PROXY_API_KEY", "").strip(),
            application_name=os.getenv("APPLICATION_NAME", "document-parser").strip(),
            vision_model=os.getenv("DOCUMENT_PARSER_VISION_MODEL", "").strip(),
            max_pages=max(1, int(os.getenv("MAX_PAGES", "20"))),
            pdf_render_dpi=max(72, int(os.getenv("PDF_RENDER_DPI", "144"))),
            max_upload_mb=max(1, int(os.getenv("MAX_UPLOAD_MB", "100"))),
            temp_dir=temp_dir,
            keep_artifacts=os.getenv("KEEP_ARTIFACTS", "false").lower() in {"1", "true", "yes"},
            uno_host=os.getenv("UNO_HOST", "127.0.0.1"),
            uno_port=int(os.getenv("UNO_PORT", "2003")),
            uno_timeout_s=max(5, int(os.getenv("UNO_TIMEOUT_S", "120"))),
        )
