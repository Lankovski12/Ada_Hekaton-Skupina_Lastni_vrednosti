import os

os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["DATABASE_URL"] = "sqlite://"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def test_endpoints_respond():
    with TestClient(app) as c:
        for path in ["/api/health", "/api/now", "/api/forecast?h=48", "/api/scene", "/api/daily-game", "/api/facts", "/api/places"]:
            assert c.get(path).status_code == 200, path
        assert len(c.get("/api/forecast?h=48").json()["ure"]) == 48
