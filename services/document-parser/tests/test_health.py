from unittest.mock import patch

from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_health_returns_ok_status():
    with patch("src.pipeline.shutil.which", return_value="/usr/bin/unoconvert"), patch(
        "src.pipeline.socket.create_connection"
    ):
        response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["unoconvert_installed"] is True
    assert body["unoserver_reachable"] is True


def test_health_reflects_missing_dependencies():
    with patch("src.pipeline.shutil.which", return_value=None), patch(
        "src.pipeline.socket.create_connection", side_effect=OSError("refused")
    ):
        response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["unoconvert_installed"] is False
    assert body["unoserver_reachable"] is False


def test_health_returns_json_content_type():
    response = client.get("/health")
    assert response.headers["content-type"].startswith("application/json")
