"""Podatki o včerajšnjem dnevu za igro »Vremenski vedeževalec«.

Oblika je enaka kot dnevi v frontend/public/assets/daily/arhiv.json (scripts/build_daily_archive.py),
zato igra vprašanja sestavi sama, ne glede na to, ali je dan iz arhiva ali od včeraj.
"""
import datetime as dt
import logging
from functools import lru_cache

import httpx
from sqlalchemy import select

from .config import LJ_LAT, LJ_LON
from .db import Measurement, SessionLocal, Station

log = logging.getLogger(__name__)

LOCAL = dt.timedelta(hours=1)  # ARSO: UTC+1 brez poletnega premika
BEZIGRAD = "E403"
MIN_UR = 18  # postaja mora imeti vsaj toliko ur meritev za dnevno povprečje


def _local_day_bounds(day: dt.date) -> tuple[dt.datetime, dt.datetime]:
    start = dt.datetime.combine(day, dt.time()) - LOCAL  # v UTC
    return start, start + dt.timedelta(days=1)


def _day_measurements(day: dt.date) -> tuple[list[dict], list[float | None], float | None]:
    start, end = _local_day_bounds(day)
    with SessionLocal() as db:
        rows = db.execute(
            select(Measurement.station_id, Measurement.time_utc, Measurement.onesnazevalo, Measurement.vrednost).where(
                Measurement.time_utc >= start, Measurement.time_utc < end, Measurement.vir == "arso"
            )
        ).all()
        stations = {s.id: s for s in db.scalars(select(Station)).all()}
    per: dict[str, dict[str, list[float]]] = {}
    ure: list[float | None] = [None] * 24
    for sid, t, pol, v in rows:
        per.setdefault(sid, {}).setdefault(pol, []).append(v)
        if sid == BEZIGRAD and pol == "pm25":
            ure[int(((t - start).total_seconds()) // 3600)] = round(v, 1)
    postaje = []
    for sid, vals in per.items():
        pm25 = vals.get("pm25", [])
        st = stations.get(sid)
        if st is None or len(pm25) < MIN_UR:
            continue
        pm10 = vals.get("pm10", [])
        postaje.append({
            "id": sid, "ime": st.ime, "lat": st.lat, "lon": st.lon,
            "pm25": round(sum(pm25) / len(pm25), 1),
            "pm10": round(sum(pm10) / len(pm10), 1) if len(pm10) >= MIN_UR else None,
        })
    bez = next((p["pm25"] for p in postaje if p["id"] == BEZIGRAD), None)
    return postaje, ure, bez


@lru_cache(maxsize=8)
def _weather(day: dt.date) -> dict | None:
    """Vreme za lokalni dan iz Open-Meteo (pretekli dnevi). Višina mejne plasti je ocena modela."""
    params = {
        "latitude": LJ_LAT, "longitude": LJ_LON, "timezone": "UTC",
        "hourly": "temperature_2m,precipitation,wind_speed_10m,boundary_layer_height",
        "start_date": (day - dt.timedelta(days=1)).isoformat(), "end_date": (day + dt.timedelta(days=1)).isoformat(),
    }
    try:
        r = httpx.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=20)
        r.raise_for_status()
        h = r.json()["hourly"]
    except (httpx.HTTPError, KeyError) as e:
        log.warning("Vreme za %s ni dosegljivo: %s", day, e)
        return None
    start, end = _local_day_bounds(day)
    idx = [i for i, t in enumerate(h["time"]) if start <= dt.datetime.fromisoformat(t) < end]
    if len(idx) < 20:
        return None
    pick = lambda k: [h[k][i] for i in idx if h[k][i] is not None]  # noqa: E731
    blh7 = next((h["boundary_layer_height"][i] for i in idx
                 if (dt.datetime.fromisoformat(h["time"][i]) + LOCAL).hour == 7), None)
    return {
        "padavine_mm": round(sum(pick("precipitation")), 1),
        "veter_kmh": round(sum(pick("wind_speed_10m")) / max(1, len(pick("wind_speed_10m"))), 1),
        "temp_c": round(sum(pick("temperature_2m")) / max(1, len(pick("temperature_2m"))), 1),
        "mejna_plast_m": blh7,
    }


def yesterday(today: dt.date | None = None) -> dict | None:
    """Včerajšnji dan iz shranjenih meritev ARSO; None, če meritev še ni dovolj (igra takrat vzame arhiv)."""
    today = today or (dt.datetime.now(dt.UTC) + LOCAL).date()
    day = today - dt.timedelta(days=1)
    postaje, ure, bez = _day_measurements(day)
    if bez is None or len(postaje) < 4 or sum(v is not None for v in ure) < MIN_UR:
        return None
    prev_postaje, _, prev_bez = _day_measurements(day - dt.timedelta(days=1))
    return {
        "datum": day.isoformat(),
        "vir": "meritve ARSO",
        "postaje": postaje,
        "ure": ure,
        "vreme": _weather(day),
        "prejsnji": {"pm25": prev_bez, "vreme": _weather(day - dt.timedelta(days=1))} if prev_bez is not None else None,
    }
