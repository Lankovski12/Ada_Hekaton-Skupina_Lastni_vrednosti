"""FastAPI zaledje – vsi endpointi samo berejo. V Dockerju streže tudi zgrajen Vue frontend.

Zagon brez Dockerja:  uvicorn app.main:app --reload   (v mapi backend/)
Dokumentacija API:    http://localhost:8000/docs
"""
import csv
import logging
import threading
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from functools import lru_cache

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from . import forecast as fc
from .config import (
    CORS_ORIGINS,
    FRONTEND_DIST,
    INGEST_MINUTE,
    INGEST_ON_STARTUP,
    LJ_STATIONS,
    SCHEDULER_ENABLED,
    STATIC_DATA_DIR,
)
from .db import Measurement, SessionLocal, Station, init_db
from .ingest import backfill_zajem, run_hourly
from .schemas import (
    FactOut,
    ForecastResponse,
    NowResponse,
    PlaceOut,
    SceneResponse,
    StationNow,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if INGEST_ON_STARTUP:
        # v ozadju, da strežnik takoj odgovarja; najprej dopolni zadnje dni iz zajema organizatorjev
        def first_run():
            backfill_zajem()
            run_hourly()

        threading.Thread(target=first_run, daemon=True).start()
    scheduler = None
    if SCHEDULER_ENABLED:
        from apscheduler.schedulers.background import BackgroundScheduler

        scheduler = BackgroundScheduler(timezone="UTC")
        scheduler.add_job(run_hourly, "cron", minute=INGEST_MINUTE, id="urni-zajem")
        scheduler.start()
    yield
    if scheduler:
        scheduler.shutdown()


app = FastAPI(title="Zrak, ki ga dihamo – API", version="0.2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])


@app.get("/api/health")
def health():
    with SessionLocal() as db:
        n = db.scalar(select(Measurement.id).limit(1))
    return {"ok": True, "model": fc.load_model() is not None, "ima_meritve": n is not None}


def _demo_now() -> NowResponse:
    t = fc.start_of_hour()
    base = fc.typical_pm25(t)
    demo = [("E403", "LJ Bežigrad", 46.0655, 14.5127, 1.0), ("E405", "LJ Celovška", 46.0636, 14.4914, 1.2),
            ("E404", "LJ Vič", 46.0425, 14.4874, 0.9)]
    return NowResponse(cas_utc=t.isoformat(), postaje=[
        StationNow(id=i, ime=n, lat=la, lon=lo, pm25=round(base * f), pm10=round(base * f * 1.3), vir="model",
                   cas_utc=t.isoformat())
        for i, n, la, lo, f in demo
    ])


@app.get("/api/now", response_model=NowResponse)
def now(lat: float = Query(46.05), lon: float = Query(14.51)):
    """Zadnja meritev ARSO za ljubljanske postaje. Če meritev še ni, demo vrednosti (vir='model')."""
    # TODO: najbližje postaje glede na lat/lon (zdaj vedno Ljubljana)
    postaje = []
    with SessionLocal() as db:
        for sid in LJ_STATIONS:
            st = db.get(Station, sid)
            if st is None:
                continue
            vals = {}
            t_last = None
            for pol in ("pm25", "pm10"):
                m = db.scalars(select(Measurement).where(Measurement.station_id == sid, Measurement.onesnazevalo == pol)
                               .order_by(Measurement.time_utc.desc()).limit(1)).first()
                if m:
                    vals[pol] = m.vrednost
                    t_last = max(t_last or m.time_utc, m.time_utc)
            if t_last is None:
                continue
            cas = t_last.replace(tzinfo=UTC).isoformat()
            postaje.append(StationNow(id=sid, ime=st.ime, lat=st.lat, lon=st.lon, pm25=vals.get("pm25"),
                                      pm10=vals.get("pm10"), vir="meritev", cas_utc=cas))
    if not postaje:
        return _demo_now()
    return NowResponse(cas_utc=max(p.cas_utc for p in postaje), postaje=postaje)


@app.get("/api/forecast", response_model=ForecastResponse)
def forecast(lat: float = 46.05, lon: float = 14.51, h: int = Query(48, ge=1, le=48)):
    ure, _model = fc.predict(lat, lon, h)
    return ForecastResponse(izdano_utc=datetime.now(UTC).isoformat(), lat=lat, lon=lon, ure=ure,
                            najboljsa_ura=fc.best_hour(ure))


@app.get("/api/scene", response_model=SceneResponse)
def scene():
    """Podatki za kotlino in igro: višina plasti smoga, PM2.5, inverzija in megla po urah (naslednjih 24 ur)."""
    from .ingest import LATEST

    ure, _ = fc.predict(46.05, 14.51, 24)
    w = LATEST.get("weather")
    wx = {}
    if w:
        for i, t in enumerate(w["time"]):
            wx[datetime.fromisoformat(t).replace(tzinfo=UTC)] = {
                "blh": w["boundary_layer_height"][i],
                "code": w["weather_code"][i] if "weather_code" in w else None,
                "vis": w["visibility"][i] if "visibility" in w else None,
            }
    out = []
    for u in ure:
        t = datetime.fromisoformat(u["cas_utc"])
        pm = u["pm25"]
        x = wx.get(t)
        if x and x["blh"] is not None:
            # nizka mejna plast = zrak se ne meša (inverzija); vrh plasti ~ dno kotline (290 m) + mejna plast
            inv = x["blh"] < 350
            top = 290 + max(60, min(x["blh"], 1200))
            megla = (x["code"] in (45, 48)) or (x["vis"] is not None and x["vis"] < 1000)
        else:
            local_h = (t.hour + 1) % 24
            inv = local_h < 10 or local_h > 17
            top = 330 + pm if inv else 600 + max(0, 24 - pm) * 8
            megla = False
        out.append({"cas_utc": u["cas_utc"], "pm25": pm, "inverzija": inv, "megla": megla, "visina_megle_m": top})
    return SceneResponse(ure=out)


@app.get("/api/vceraj")
def vceraj():
    """Včerajšnji dan za igro Vremenski vedeževalec (meritve ARSO + vreme Open-Meteo).
    404, če meritev za včeraj še ni dovolj – igra takrat vzame dan iz arhiva."""
    from fastapi import HTTPException

    from .daily import yesterday

    d = yesterday()
    if d is None:
        raise HTTPException(404, "Za včeraj še ni dovolj meritev.")
    return d


@app.get("/api/facts", response_model=list[FactOut])
def facts():
    return [
        FactOut(besedilo="Smernica WHO (2021) za dnevno povprečje PM2.5.", stevilka="15 µg/m³", vir="WHO"),
        FactOut(besedilo="Ob temperaturni inverziji ostane onesnažen zrak ujet v kotlini kot pod pokrovko.", vir="ARSO"),
    ]


TIP = {"vrtec": "vrtec", "sola": "sola", "bolnisnica": "bolnisnica", "zdravstveni_dom": "zdravstveni_dom",
       "dom_za_starejse": "dom_za_starejse"}


@lru_cache(maxsize=1)
def _places() -> list[PlaceOut]:
    path = STATIC_DATA_DIR / "osm_obcutljive_lokacije.csv"
    with path.open(encoding="utf-8") as fh:
        return [
            PlaceOut(ime=r["ime"] or r["naslov"] or r["kategorija"], tip=TIP.get(r["kategorija"], r["kategorija"]),
                     lat=float(r["lat"]), lon=float(r["lon"]))
            for r in csv.DictReader(fh)
        ]


@app.get("/api/places", response_model=list[PlaceOut])
def places(tip: str | None = None, limit: int = Query(50, le=1000)):
    """Vrtci, šole, bolnišnice … iz OpenStreetMap (© OpenStreetMap contributors, ODbL)."""
    rows = [p for p in _places() if tip is None or p.tip == tip]
    return rows[:limit]


# --- Frontend (Vue build) na istem naslovu: http://localhost:8000/ ---
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        f = FRONTEND_DIST / full_path
        if full_path and f.is_file() and FRONTEND_DIST in f.resolve().parents:
            return FileResponse(f)
        return FileResponse(FRONTEND_DIST / "index.html")  # Vue router
