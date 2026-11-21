import os

os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["INGEST_ON_STARTUP"] = "false"
import tempfile  # noqa: E402

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.ingest import parse_arso_xml  # noqa: E402
from app.main import app  # noqa: E402

SAMPLE = """<?xml version="1.0" encoding="UTF-8"?>
<arsopodatki><datum_priprave>2026-11-21 14:35</datum_priprave>
<postaja sifra="E403" wgs84_sirina="46.0655" wgs84_dolzina="14.5127" nadm_visina="299">
<merilno_mesto>LJ Bežigrad</merilno_mesto><datum_od>2026-11-21 13:00</datum_od><datum_do>2026-11-21 14:00</datum_do>
<pm10>31</pm10><pm2.5>&lt;2</pm2.5></postaja></arsopodatki>""".encode()


def test_parse_arso_xml():
    rows = parse_arso_xml(SAMPLE)
    assert rows[0]["station_id"] == "E403"
    assert rows[0]["pm10"] == 31
    assert rows[0]["pm25"] == 1.0  # '<2' -> polovica meje
    assert rows[0]["time_utc"].hour == 12  # UTC+1 -> UTC


def test_endpoints_respond():
    with TestClient(app) as c:
        for path in ["/api/health", "/api/now", "/api/forecast?h=48", "/api/scene", "/api/daily-game",
                     "/api/facts", "/api/places?tip=vrtec"]:
            assert c.get(path).status_code == 200, path
        assert len(c.get("/api/forecast?h=48").json()["ure"]) == 48
        assert c.get("/api/places?tip=vrtec").json()[0]["tip"] == "vrtec"
