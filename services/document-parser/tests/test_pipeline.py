# Ported from ~/REPO/cortex-document-parser/tests/unit/test_document_pipeline.py
# (already well-designed per the design doc's own read-through — mocks
# shutil.which/socket.create_connection/subprocess.run/the OpenAI client,
# tests error paths). Adapted for the trimmed Config (src/config.py) and
# RuntimeStatus (src/pipeline.py) shapes, and for `unoconvert`/vision model
# both being required-but-unset-by-default now (no "gpt-5.2" placeholder).
from pathlib import Path
from unittest.mock import patch

import pytest

from src.config import Config
from src.exceptions import ConversionError, DependencyError
from src.prompt import DEFAULT_PROMPT
from src.pipeline import DocumentPipeline


def _config(tmp_path: Path, **overrides) -> Config:
    base = dict(
        cortex_api_url="http://localhost:8240",
        cortex_api_key="test-key",
        application_name="document-parser",
        vision_model="test/vision-model",
        max_pages=20,
        pdf_render_dpi=144,
        max_upload_mb=100,
        temp_dir=tmp_path / "temp",
        keep_artifacts=False,
        uno_host="127.0.0.1",
        uno_port=2003,
        uno_timeout_s=120,
    )
    base.update(overrides)
    Path(base["temp_dir"]).mkdir(parents=True, exist_ok=True)
    return Config(**base)


class TestGetRuntimeStatus:
    def test_all_available(self, mock_config):
        pipeline = DocumentPipeline(mock_config)
        with patch("src.pipeline.shutil.which", return_value="/usr/bin/unoconvert"), patch(
            "src.pipeline.socket.create_connection"
        ):
            status = pipeline.get_runtime_status()
        assert status.unoconvert_installed is True
        assert status.unoserver_reachable is True

    def test_unoconvert_not_installed(self, mock_config):
        pipeline = DocumentPipeline(mock_config)
        with patch("src.pipeline.shutil.which", return_value=None), patch(
            "src.pipeline.socket.create_connection", side_effect=OSError("refused")
        ):
            status = pipeline.get_runtime_status()
        assert status.unoconvert_installed is False
        assert status.unoserver_reachable is False

    def test_unoserver_unreachable(self, mock_config):
        pipeline = DocumentPipeline(mock_config)
        with patch("src.pipeline.shutil.which", return_value="/usr/bin/unoconvert"), patch(
            "src.pipeline.socket.create_connection", side_effect=OSError("Connection refused")
        ):
            status = pipeline.get_runtime_status()
        assert status.unoconvert_installed is True
        assert status.unoserver_reachable is False


class TestProcessErrorPaths:
    def test_empty_file_raises_conversion_error(self, mock_config):
        pipeline = DocumentPipeline(mock_config)
        with pytest.raises(ConversionError, match="empty"):
            pipeline.process("doc.pdf", b"", "prompt", "model")

    def test_conversion_error_returns_error_record(self, tmp_path):
        config = _config(tmp_path)
        pipeline = DocumentPipeline(config)

        with patch.object(
            pipeline, "_convert_to_images", side_effect=ConversionError("Bad format")
        ), patch.object(pipeline, "_save_input"):
            record = pipeline.process("bad.docx", b"not-empty", "prompt", None)

        assert record.status == "error"
        assert "Bad format" in record.error_message
        assert record.markdown == ""

    def test_process_uses_default_prompt_when_empty(self, tmp_path):
        config = _config(tmp_path)
        pipeline = DocumentPipeline(config)

        with patch.object(pipeline, "_save_input", return_value=Path("test.png")), patch.object(
            pipeline, "_convert_to_images", return_value=([Path("img.png")], 1, False)
        ), patch.object(pipeline, "_run_openai", return_value="# Result") as mock_openai:
            pipeline.process("test.png", b"img", "   ", None)

        mock_openai.assert_called_once()
        actual_prompt = mock_openai.call_args[1]["prompt"]
        assert actual_prompt == DEFAULT_PROMPT

    def test_process_uses_config_model_when_none(self, tmp_path):
        config = _config(tmp_path)
        pipeline = DocumentPipeline(config)

        with patch.object(pipeline, "_save_input", return_value=Path("test.png")), patch.object(
            pipeline, "_convert_to_images", return_value=([Path("img.png")], 1, False)
        ), patch.object(pipeline, "_run_openai", return_value="# Result") as mock_openai:
            pipeline.process("test.png", b"img", "prompt", None)

        actual_model = mock_openai.call_args[1]["model"]
        assert actual_model == "test/vision-model"

    def test_process_cleans_up_work_dir(self, tmp_path):
        config = _config(tmp_path)
        pipeline = DocumentPipeline(config)

        with patch.object(pipeline, "_save_input", return_value=Path("test.png")), patch.object(
            pipeline, "_convert_to_images", return_value=([Path("img.png")], 1, False)
        ), patch.object(pipeline, "_run_openai", return_value="# Result"), patch(
            "src.pipeline.shutil.rmtree"
        ) as mock_rmtree:
            pipeline.process("test.png", b"img", "prompt", None)

        mock_rmtree.assert_called_once()

    def test_process_errors_when_no_vision_model_resolved(self, tmp_path):
        """No DOCUMENT_PARSER_VISION_MODEL and no per-call override (Q3: no
        hardcoded default) -> a clear DependencyError, not a silent/garbled
        upstream failure."""
        config = _config(tmp_path, vision_model="")
        pipeline = DocumentPipeline(config)

        with patch.object(pipeline, "_save_input", return_value=Path("test.png")), patch.object(
            pipeline, "_convert_to_images", return_value=([Path("img.png")], 1, False)
        ):
            record = pipeline.process("test.png", b"img", "prompt", None)

        assert record.status == "error"
        assert "DOCUMENT_PARSER_VISION_MODEL" in record.error_message


class TestEnsureConversionDependencies:
    def test_raises_when_unoconvert_missing(self, mock_config):
        pipeline = DocumentPipeline(mock_config)
        with patch("src.pipeline.shutil.which", return_value=None):
            with pytest.raises(DependencyError, match="unoconvert"):
                pipeline._ensure_conversion_dependencies()

    def test_raises_when_unoserver_unreachable(self, mock_config):
        pipeline = DocumentPipeline(mock_config)
        with patch("src.pipeline.shutil.which", return_value="/usr/bin/unoconvert"), patch(
            "src.pipeline.socket.create_connection", side_effect=OSError("refused")
        ):
            with pytest.raises(DependencyError, match="unoserver"):
                pipeline._ensure_conversion_dependencies()
