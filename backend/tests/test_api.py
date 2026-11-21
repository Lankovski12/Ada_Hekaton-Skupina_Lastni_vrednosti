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
        for path in ["/api/health", "/api/now", "/api/forecast?h=48", "/api/scene",
                     "/api/facts", "/api/places?tip=vrtec"]:
            assert c.get(path).status_code == 200, path
        assert len(c.get("/api/forecast?h=48").json()["ure"]) == 48
        assert c.get("/api/places?tip=vrtec").json()[0]["tip"] == "vrtec"
        assert c.get("/api/vceraj").status_code == 404  # prazna baza: igra vzame arhiv


def test_yesterday_from_measurements(monkeypatch):
    import datetime as dt

    from app import daily
    from app.db import Measurement, SessionLocal, Station, init_db

    init_db()
    monkeypatch.setattr(daily, "_weather", lambda day: None)  # brez interneta
    today = dt.date(2026, 11, 21)
    start = dt.datetime(2026, 11, 20) - dt.timedelta(hours=1)  # lokalna polnoč v UTC
    with SessionLocal() as db:
        for i, sid in enumerate(["E403", "E404", "E405", "E407"]):
            db.merge(Station(id=sid, ime=f"Postaja {sid}", lat=46 + i * 0.1, lon=14.5, vir="arso"))
            for h in range(48):  # predvčerajšnjim in včeraj
                t = start - dt.timedelta(hours=24) + dt.timedelta(hours=h)
                db.add(Measurement(station_id=sid, time_utc=t, onesnazevalo="pm25", vrednost=10 + i * 10 + (h % 24), vir="arso"))
        db.commit()
    d = daily.yesterday(today)
    assert d["datum"] == "2026-11-20"
    assert len(d["postaje"]) == 4
    assert d["ure"][0] == 10 and d["ure"][23] == 33  # Bežigrad, lokalne ure 0 in 23
    best = max(d["postaje"], key=lambda p: p["pm25"])
    assert best["id"] == "E407"
    assert d["prejsnji"]["pm25"] == 21.5
