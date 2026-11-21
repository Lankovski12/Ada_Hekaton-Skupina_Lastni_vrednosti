"""FastAPI zaledje – vsi endpointi samo berejo.

Zagon:  uvicorn app.main:app --reload   (v mapi backend/)
Dokumentacija: http://localhost:8000/docs
"""
import logging
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime, timedelta

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from . import forecast as fc
from .config import CORS_ORIGINS, INGEST_MINUTE, SCHEDULER_ENABLED
from .db import init_db
from .ingest import run_hourly
from .schemas import (
    DailyGameResponse,
    FactOut,
    ForecastResponse,
    NowResponse,
    PlaceOut,
    SceneResponse,
    StationNow,
    Yesterday,
)

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler = None
    if SCHEDULER_ENABLED:
        from apscheduler.schedulers.background import BackgroundScheduler

        scheduler = BackgroundScheduler(timezone="UTC")
        scheduler.add_job(run_hourly, "cron", minute=INGEST_MINUTE, id="urni-zajem")
        scheduler.start()
    yield
    if scheduler:
        scheduler.shutdown()


app = FastAPI(title="Zrak, ki ga dihamo – API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])

# TODO: zamenjati z branjem iz baze (stations + measurements)
DEMO_STATIONS = [
    ("LJ-BEZ", "Ljubljana Bežigrad", 46.0656, 14.5126, 1.0),
    ("LJ-CEL", "Ljubljana Celovška", 46.0636, 14.4914, 1.2),
    ("LJ-VIC", "Ljubljana Vič", 46.0425, 14.4874, 0.9),
]


@app.get("/api/health")
def health():
    return {"ok": True, "model": fc.load_model() is not None}


@app.get("/api/now", response_model=NowResponse)
def now(lat: float = Query(46.05), lon: float = Query(14.51)):
    t = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    base = fc.typical_pm25(t)
    postaje = [
        StationNow(id=i, ime=ime, lat=la, lon=lo, pm25=round(base * f), pm10=round(base * f * 1.3),
                   vir="meritev", cas_utc=t.isoformat())
        for i, ime, la, lo, f in DEMO_STATIONS
    ]
    return NowResponse(cas_utc=t.isoformat(), postaje=postaje)


@app.get("/api/forecast", response_model=ForecastResponse)
def forecast(lat: float = 46.05, lon: float = 14.51, h: int = Query(48, ge=1, le=48)):
    ure = fc.predict(lat, lon, h)
    return ForecastResponse(
        izdano_utc=datetime.now(UTC).isoformat(), lat=lat, lon=lon, ure=ure, najboljsa_ura=fc.best_hour(ure)
    )


@app.get("/api/scene", response_model=SceneResponse)
def scene():
    """Podatki za 3D kotlino: višina megle in PM2.5 po urah."""
    start = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    ure = []
    for i in range(24):
        t = start + timedelta(hours=i)
        pm = fc.typical_pm25(t)
        local_h = (t.hour + 1) % 24
        inv = local_h < 10 or local_h > 17  # TODO: iz tabele weather (inverzija)
        ure.append({"cas_utc": t.isoformat(), "pm25": pm, "inverzija": inv,
                    "visina_megle_m": 330 + pm if inv else 600 + (24 - pm) * 8})
    return SceneResponse(ure=ure)


@app.get("/api/daily-game", response_model=DailyGameResponse)
def daily_game():
    return DailyGameResponse(
        datum=date.today().isoformat(),
        vprasanje="Bo jutri ob 8h zrak v Ljubljani boljši ali slabši kot danes?",
        moznosti=["Boljši", "Enak", "Slabši"],
        vceraj=Yesterday(vprasanje="Bo danes popoldne megla?", pravilen_odgovor="Da"),
    )


@app.get("/api/facts", response_model=list[FactOut])
def facts():
    return [
        FactOut(besedilo="Ob temperaturni inverziji ostane onesnažen zrak ujet v kotlini kot pod pokrovko.", vir="ARSO"),
    ]


@app.get("/api/places", response_model=list[PlaceOut])
def places():
    # TODO: naložiti iz ARSOhack/04_prostor/osm_obcutljive_lokacije.csv
    return [PlaceOut(ime="UKC Ljubljana", tip="bolnisnica", lat=46.0546, lon=14.5229)]
