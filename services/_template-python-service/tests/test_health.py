from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_returns_ok_status():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_returns_json_content_type():
    response = client.get("/health")
    assert response.headers["content-type"].startswith("application/json")
