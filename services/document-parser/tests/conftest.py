import pytest

from src.config import Config


@pytest.fixture()
def mock_config(tmp_path) -> Config:
    """Config with test-safe paths, no real API key/model."""
    return Config(
        cortex_api_url="http://localhost:8240",
        cortex_api_key="test-key-not-real",
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
