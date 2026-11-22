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


def test_pokrovka_rule():
    from app.pokrovka import visina_pokrovke

    assert visina_pokrovke(-3, 2) < 80  # močna inverzija: pokrovka zelo nizko
    assert 120 < visina_pokrovke(0, -2) < 220
    assert visina_pokrovke(5, -1) > visina_pokrovke(0, 0) > visina_pokrovke(-3, 5)


HISTORY = """time_from_local,time_to_local,station_code,station_name,lat,lon,alt_m,d96_e,d96_n,so2,co,o3,no2,nox,pm10,pm25,benzen,prepared_local,fetched_utc
2026-11-20T08:00,2026-11-20T09:00,E403,LJ Bežigrad,46.0655449,14.5127203,299,462302.09,102976.48,,0.2,49,16,17,30,20,,2026-11-20T09:35,2026-11-20T08:50:59Z
2026-11-21T08:00,2026-11-21T09:00,E403,LJ Bežigrad,46.0655449,14.5127203,299,462302.09,102976.48,,0.2,49,16,17,20,10,,2026-11-21T09:35,2026-11-21T08:50:59Z
2026-11-21T08:00,2026-11-21T09:00,E403,LJ Bežigrad,46.0655449,14.5127203,299,462302.09,102976.48,,0.2,49,16,17,21,12,,2026-11-21T09:40,2026-11-21T08:55:59Z
"""


def test_parse_history_keeps_last_duplicate():
    from app.ingest import parse_arso_history_csv

    rows = parse_arso_history_csv(HISTORY)
    assert len(rows) == 2
    last = [r for r in rows if r["time_utc"].day == 21][0]
    assert last["pm25"] == 12 and last["time_utc"].hour == 7


def test_fallbacks_use_arso_climatology():
    """Brez meritev in napovedi: vrednosti iz zgodovine ARSO, ne izmišljene."""
    from datetime import datetime

    from app import klima
    from app.forecast import typical

    t = datetime(2026, 1, 15, 19)  # 20h lokalno, januar
    assert typical(t) == (klima.data()["klima"]["pm25"][0][20], klima.data()["klima"]["pm10"][0][20])
    with TestClient(app) as c:
        assert c.get("/api/forecast?h=3").json()["model"] in ("cams", "klima")
        assert c.get("/api/scene").json()["vir"] in ("open-meteo", "klima")
        assert len(c.get("/api/facts").json()) >= 3
