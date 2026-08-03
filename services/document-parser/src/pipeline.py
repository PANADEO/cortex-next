# Ported from ~/REPO/cortex-document-parser/src/core/document_pipeline.py
# (read-only reference, not modified). Scope per design doc D2/D7: this
# backend does ONLY unoserver conversion (`unoconvert` subprocess), PDF page
# rendering (`pypdfium2`), and the vision-LLM call through cortex-proxy —
# nothing else, no own database, no queue, no auth.
#
# Deliberate differences from the legacy version:
#   - Config is the trimmed src/config.py (no cortex-admin/queue fields).
#   - PromptRegistry -> src/prompt.py's single DEFAULT_PROMPT (Q5: one
#     built-in prompt in v1).
#   - RuntimeStatus trimmed to the two flags GET /health actually surfaces
#     (D1) — cortex_key_present/default_model/uno_host/uno_port/max_pages
#     were legacy's "Runtime & Audit" page fields, which D1 explicitly drops
#     as a user-facing screen.
#   - `_run_openai` adds the `X-Scope` header (code-integration's referenced
#     cortex-proxy contract requires X-User-ID + X-Scope + X-Source-App;
#     legacy only ever sent two of the three — D7 flagged this as the one
#     gap to close during the port).
from __future__ import annotations

import base64
import shutil
import socket
import subprocess
import tempfile
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

import pypdfium2 as pdfium
from openai import OpenAI
from PIL import Image

from src.config import Config
from src.exceptions import AIProcessingError, ConversionError, DependencyError
from src.prompt import DEFAULT_PROMPT

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff", ".gif"}
MAX_IMAGE_DIMENSION = 2048
JPEG_QUALITY = 85

# X-Scope: module-specific constant, same pattern as ilustromat's SCOPES in
# app/idp/lib/ilustromat/config.ts — decides token-usage attribution on the
# cortex-proxy side.
CORTEX_SCOPE = "document-parser-extraction"

RecordStatus = Literal["success", "error"]


@dataclass
class ProcessingRecord:
    job_id: str
    file_name: str
    model: str
    prompt: str
    markdown: str
    status: RecordStatus
    created_at: str
    elapsed_seconds: float
    page_count: int
    image_count: int
    truncated: bool
    error_message: str | None = None


@dataclass
class RuntimeStatus:
    unoconvert_installed: bool
    unoserver_reachable: bool


class DocumentPipeline:
    def __init__(self, config: Config):
        self.config = config
        self._client: OpenAI | None = None

    def get_runtime_status(self) -> RuntimeStatus:
        return RuntimeStatus(
            unoconvert_installed=shutil.which("unoconvert") is not None,
            unoserver_reachable=self._is_unoserver_reachable(),
        )

    def process(
        self,
        file_name: str,
        file_bytes: bytes,
        prompt: str,
        model: str | None = None,
        user_email: str = "",
    ) -> ProcessingRecord:
        if not file_bytes:
            raise ConversionError("Uploaded file is empty.")

        started = time.perf_counter()
        created_at = datetime.now(UTC).isoformat()
        model_name = (model or self.config.vision_model or "").strip()
        final_prompt = prompt.strip() or DEFAULT_PROMPT
        job_id = uuid.uuid4().hex[:12]

        work_dir = Path(tempfile.mkdtemp(prefix=f"doc-{job_id}-", dir=self.config.temp_dir))
        image_count = 0
        page_count = 0
        truncated = False

        try:
            input_path = self._save_input(file_name=file_name, file_bytes=file_bytes, work_dir=work_dir)
            images_dir = work_dir / "images"
            images_dir.mkdir(parents=True, exist_ok=True)

            image_paths, page_count, truncated = self._convert_to_images(
                input_path=input_path, images_dir=images_dir
            )
            image_count = len(image_paths)

            if image_count == 0:
                raise ConversionError("No images were generated from the uploaded file.")

            markdown = self._run_openai(
                prompt=final_prompt, image_paths=image_paths, model=model_name, user_email=user_email
            )
            elapsed = time.perf_counter() - started

            return ProcessingRecord(
                job_id=job_id,
                file_name=input_path.name,
                model=model_name,
                prompt=final_prompt,
                markdown=markdown,
                status="success",
                created_at=created_at,
                elapsed_seconds=round(elapsed, 2),
                page_count=page_count,
                image_count=image_count,
                truncated=truncated,
                error_message=None,
            )
        except Exception as exc:
            elapsed = time.perf_counter() - started
            return ProcessingRecord(
                job_id=job_id,
                file_name=file_name,
                model=model_name,
                prompt=final_prompt,
                markdown="",
                status="error",
                created_at=created_at,
                elapsed_seconds=round(elapsed, 2),
                page_count=page_count,
                image_count=image_count,
                truncated=truncated,
                error_message=str(exc),
            )
        finally:
            if not self.config.keep_artifacts:
                shutil.rmtree(work_dir, ignore_errors=True)

    def _save_input(self, file_name: str, file_bytes: bytes, work_dir: Path) -> Path:
        safe_name = Path(file_name).name or "upload.bin"
        output_path = work_dir / safe_name
        output_path.write_bytes(file_bytes)
        return output_path

    def _convert_to_images(self, input_path: Path, images_dir: Path) -> tuple[list[Path], int, bool]:
        suffix = input_path.suffix.lower()

        if suffix in IMAGE_SUFFIXES:
            with Image.open(input_path) as image:
                out = self._optimize_image(image, images_dir / "page-0001")
            return [out], 1, False

        if suffix == ".pdf":
            pdf_path = input_path
        else:
            self._ensure_conversion_dependencies()
            pdf_path = input_path.with_suffix(".pdf")
            self._run_unoconvert(input_path=input_path, pdf_path=pdf_path)

        image_paths, page_count, truncated = self._render_pdf_to_images(pdf_path=pdf_path, images_dir=images_dir)
        return image_paths, page_count, truncated

    def _ensure_conversion_dependencies(self) -> None:
        if shutil.which("unoconvert") is None:
            raise DependencyError("`unoconvert` command not found. Install `unoserver` first.")
        if not self._is_unoserver_reachable():
            raise DependencyError(
                f"Cannot reach unoserver on {self.config.uno_host}:{self.config.uno_port}. "
                "Start unoserver before processing Office documents."
            )

    def _run_unoconvert(self, input_path: Path, pdf_path: Path) -> None:
        base = ["unoconvert", str(input_path), str(pdf_path)]
        commands: list[list[str]] = [
            [
                "unoconvert",
                "--host",
                self.config.uno_host,
                "--port",
                str(self.config.uno_port),
                str(input_path),
                str(pdf_path),
            ],
            [
                "unoconvert",
                "--server",
                self.config.uno_host,
                "--port",
                str(self.config.uno_port),
                str(input_path),
                str(pdf_path),
            ],
            [
                "unoconvert",
                "--interface",
                self.config.uno_host,
                "--port",
                str(self.config.uno_port),
                str(input_path),
                str(pdf_path),
            ],
            base,
        ]

        # Keep order but remove exact duplicates.
        deduped: list[list[str]] = []
        seen: set[tuple[str, ...]] = set()
        for command in commands:
            key = tuple(command)
            if key not in seen:
                deduped.append(command)
                seen.add(key)

        last_error: str | None = None
        for idx, command in enumerate(deduped):
            try:
                result = subprocess.run(
                    command,
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=self.config.uno_timeout_s,
                )
            except subprocess.TimeoutExpired as exc:
                raise ConversionError(f"Conversion timed out after {self.config.uno_timeout_s}s.") from exc

            if result.returncode == 0:
                last_error = None
                break

            stderr = (result.stderr or "").strip()
            stdout = (result.stdout or "").strip()
            error_text = stderr or stdout or f"exit {result.returncode}"
            last_error = f"unoconvert failed (exit {result.returncode}): {error_text}"

            # Retry with another argument variant only when CLI rejects flags.
            if "unrecognized arguments" in error_text.lower() and idx < len(deduped) - 1:
                continue

            raise ConversionError(last_error)

        if last_error is not None:
            raise ConversionError(last_error)

        if not pdf_path.exists() or pdf_path.stat().st_size == 0:
            raise ConversionError("unoconvert finished but produced an empty PDF.")

    def _render_pdf_to_images(self, pdf_path: Path, images_dir: Path) -> tuple[list[Path], int, bool]:
        scale = self.config.pdf_render_dpi / 72.0
        pdf = pdfium.PdfDocument(str(pdf_path))

        try:
            page_count = len(pdf)
            if page_count == 0:
                raise ConversionError("PDF has no pages.")

            max_pages = min(page_count, self.config.max_pages)
            truncated = page_count > self.config.max_pages
            image_paths: list[Path] = []

            for index in range(max_pages):
                page = pdf[index]
                try:
                    bitmap = page.render(scale=scale)
                    image = bitmap.to_pil()
                    out = self._optimize_image(image, images_dir / f"page-{index + 1:04d}")
                    image_paths.append(out)
                finally:
                    page.close()

            return image_paths, page_count, truncated
        except RuntimeError as exc:
            raise ConversionError(f"Unable to render PDF pages: {exc}") from exc
        finally:
            pdf.close()

    def _run_openai(self, prompt: str, image_paths: list[Path], model: str, user_email: str = "") -> str:
        if not self.config.cortex_api_key:
            raise DependencyError("CORTEX_PROXY_API_KEY is required to process documents with AI.")
        if not model:
            raise DependencyError(
                "No vision model resolved — set DOCUMENT_PARSER_VISION_MODEL (no built-in default, "
                "see design doc Q3)."
            )

        if self._client is None:
            self._client = OpenAI(
                api_key=self.config.cortex_api_key,
                base_url=f"{self.config.cortex_api_url}/v1",
                default_headers={
                    "X-Source-App": self.config.application_name,
                    "X-Scope": CORTEX_SCOPE,
                },
            )

        content: list[dict] = [{"type": "text", "text": prompt}]
        for image_path in image_paths:
            encoded = base64.b64encode(image_path.read_bytes()).decode("utf-8")
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{encoded}"},
                }
            )

        try:
            response = self._client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": content}],
                extra_headers={"X-User-ID": user_email} if user_email else {},
            )
        except Exception as exc:
            raise AIProcessingError(f"OpenAI request failed: {exc}") from exc

        choice = response.choices[0] if response.choices else None
        output_text = (choice.message.content or "").strip() if choice else ""

        if not output_text:
            raise AIProcessingError("Model returned an empty response.")

        return output_text

    @staticmethod
    def _optimize_image(image: Image.Image, output_path: Path) -> Path:
        """Resize to max MAX_IMAGE_DIMENSION and save as JPEG."""
        image = image.convert("RGB")
        w, h = image.size
        if max(w, h) > MAX_IMAGE_DIMENSION:
            ratio = MAX_IMAGE_DIMENSION / max(w, h)
            image = image.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
        jpeg_path = output_path.with_suffix(".jpg")
        image.save(jpeg_path, format="JPEG", quality=JPEG_QUALITY)
        return jpeg_path

    def _is_unoserver_reachable(self) -> bool:
        try:
            with socket.create_connection((self.config.uno_host, self.config.uno_port), timeout=1):
                return True
        except OSError:
            return False
