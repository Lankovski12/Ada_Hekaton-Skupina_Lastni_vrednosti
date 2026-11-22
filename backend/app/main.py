"""FastAPI zaledje – vsi endpointi samo berejo. V Dockerju streže tudi zgrajen Vue frontend.

Zagon brez Dockerja:  uvicorn app.main:app --reload   (v mapi backend/)
Dokumentacija API:    http://localhost:8000/docs
"""
import logging
import threading
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from . import forecast as fc
from . import klima
from .config import (
    CORS_ORIGINS,
    FRONTEND_DIST,
    INGEST_MINUTE,
    INGEST_ON_STARTUP,
    LJ_ALT,
    LJ_STATIONS,
    SCHEDULER_ENABLED,
)
from .db import Measurement, SessionLocal, Station, Weather, init_db
from .ingest import run_hourly
from .schemas import (
    ForecastResponse,
    NowResponse,
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
        threading.Thread(target=run_hourly, daemon=True).start()  # ob prvem zagonu dopolni tudi zgodovino ARSO
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
    return {"ok": True, "ima_meritve": n is not None}


def _typical_now() -> NowResponse:
    """Ni meritev (zaledje brez interneta): povprečje meritev ARSO za ta mesec in uro, jasno označeno (vir='ocena')."""
    t = fc.start_of_hour()
    pm25, pm10 = fc.typical(t)
    return NowResponse(cas_utc=t.isoformat(), postaje=[
        StationNow(id="klima", ime=f"Ljubljana – običajno ob tej uri ({klima.label()})", lat=46.0655, lon=14.5127,
                   pm25=pm25, pm10=pm10, vir="ocena", cas_utc=t.isoformat())
    ])


@app.get("/api/now", response_model=NowResponse)
def now(lat: float = Query(46.05), lon: float = Query(14.51)):
    """Zadnja meritev ARSO za ljubljanske postaje. Če meritev še ni, povprečje meritev za ta mesec in uro (vir='ocena')."""
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
        return _typical_now()
    return NowResponse(cas_utc=max(p.cas_utc for p in postaje), postaje=postaje)


@app.get("/api/forecast", response_model=ForecastResponse)
def forecast(lat: float = 46.05, lon: float = 14.51, h: int = Query(48, ge=1, le=48)):
    ure, model = fc.predict(lat, lon, h)
    return ForecastResponse(izdano_utc=datetime.now(UTC).isoformat(), lat=lat, lon=lon, ure=ure,
                            najboljsa_ura=fc.best_hour(ure), model=model)


MEGLA_MIN, MEGLA_MAX = LJ_ALT + 30, 1200  # meje prikaza v Kotlina.vue (dno kotline ~300 m, hribi ~1000 m)


@app.get("/api/scene", response_model=SceneResponse)
def scene():
    """Kotlina za naslednjih 24 ur: PM2.5 iz napovedi, inverzija in višina mejne plasti iz Open-Meteo.

    inverzija = na Pasji ravni (1019 m) topleje kot na Bežigradu; vrh megle = Bežigrad + višina mejne plasti.
    Brez povezave: običajne razmere za ta mesec in uro iz ARSOhack (vir='klima').
    """
    ure, _ = fc.predict(46.05, 14.51, 24)
    times = [datetime.fromisoformat(u["cas_utc"]).replace(tzinfo=None) for u in ure]
    with SessionLocal() as db:
        weather = {w.time_utc: w for w in db.scalars(select(Weather).where(Weather.time_utc.in_(times)))}
    out, vse_vreme = [], True
    for u, t in zip(ure, times):
        w = weather.get(t)
        inv = w.inverzija if w else None
        blh = w.visina_mejne_plasti if w else None
        if inv is None or blh is None:
            vse_vreme = False
            # v vsaj četrtini takih ur (isti mesec in ura) je bila v preteklosti inverzija
            inv = (klima.typical(t, "inverzija") or 0) >= 0.25 if inv is None else inv
            blh = klima.typical(t, "mejnaPlast") if blh is None else blh
        visina = min(MEGLA_MAX, max(MEGLA_MIN, LJ_ALT + (blh or 0)))
        out.append({"cas_utc": u["cas_utc"], "pm25": u["pm25"], "inverzija": bool(inv), "visina_megle_m": visina})
    return SceneResponse(ure=out, vir="open-meteo" if vse_vreme else "klima")


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


@app.get("/api/pokrovka")
def pokrovka():
    """Včerajšnji jutranji temperaturi v dolini in na Pasji ravni za igro Naredi pokrovko (404 = igra vzame arhiv)."""
    from fastapi import HTTPException

    from .pokrovka import vceraj as pokrovka_vceraj

    d = pokrovka_vceraj()
    if d is None:
        raise HTTPException(404, "Podatkov za včeraj ni.")
    return d


# --- Frontend (Vue build) na istem naslovu: http://localhost:8000/ ---
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        f = FRONTEND_DIST / full_path
        if full_path and f.is_file() and FRONTEND_DIST in f.resolve().parents:
            return FileResponse(f)
        # index.html se ne sme shraniti v brskalniku: po novi gradnji imajo datoteke v /assets nova imena
        return FileResponse(FRONTEND_DIST / "index.html", headers={"Cache-Control": "no-cache"})  # Vue router
