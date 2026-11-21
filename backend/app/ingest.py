"""Zajem podatkov v živo (brez ključev): ARSO XML, Open-Meteo vreme in CAMS napoved.

Kliče se ob zagonu in vsako uro ob :50 (glej main.py).
Viri so opisani v ARSOhack/v_zivo/README.md.
"""
import datetime as dt
import logging
import xml.etree.ElementTree as ET

import httpx
from sqlalchemy import select

from .config import LJ_LAT, LJ_LON
from .db import Measurement, SessionLocal, Station, Weather

log = logging.getLogger(__name__)

ARSO_XML = "https://www.arso.gov.si/xml/zrak/ones_zrak_urni_podatki_zadnji.xml"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
SENSOR_COMMUNITY_URL = "https://data.sensor.community/airrohr/v1/filter/area=46.05,14.5,15"

ARSO_OFFSET = dt.timedelta(hours=1)  # ARSO: lokalni čas UTC+1 brez poletnega premika

# Zadnja CAMS napoved (v pomnilniku; forecast.py jo uporabi, dokler nimamo svojega modela)
LATEST: dict = {"cams": None, "weather": None}


def _num(s: str | None) -> float | None:
    """ARSO zapiše vrednosti pod mejo zaznave kot '<2' – vrnemo polovico meje."""
    if not s or not s.strip():
        return None
    s = s.strip().replace(",", ".")
    if s.startswith("<"):
        return float(s[1:]) / 2
    try:
        return float(s)
    except ValueError:
        return None


def parse_arso_xml(content: bytes) -> list[dict]:
    rows = []
    for st in ET.fromstring(content).iter("postaja"):
        t_from = (st.findtext("datum_od") or "").strip()
        if not t_from:
            continue
        t_utc = dt.datetime.strptime(t_from, "%Y-%m-%d %H:%M") - ARSO_OFFSET
        lat, lon = st.get("wgs84_sirina"), st.get("wgs84_dolzina")
        rows.append({
            "station_id": st.get("sifra"),
            "ime": (st.findtext("merilno_mesto") or "").strip(),
            "lat": float(lat) if lat else None,
            "lon": float(lon) if lon else None,
            "time_utc": t_utc,
            "pm25": _num(st.findtext("pm2.5")),
            "pm10": _num(st.findtext("pm10")),
        })
    return rows


def fetch_arso() -> int:
    """Zadnja ura uradnih meritev za vse postaje ARSO -> stations + measurements."""
    try:
        r = httpx.get(ARSO_XML, timeout=30)
        r.raise_for_status()
    except httpx.HTTPError as e:
        log.warning("ARSO ni dosegljiv: %s", e)
        return 0
    rows = parse_arso_xml(r.content)
    n = 0
    with SessionLocal() as db:
        for row in rows:
            if row["lat"] is None:
                continue
            if db.get(Station, row["station_id"]) is None:
                db.add(Station(id=row["station_id"], ime=row["ime"], lat=row["lat"], lon=row["lon"], vir="arso"))
            for pol in ("pm25", "pm10"):
                if row[pol] is None:
                    continue
                exists = db.scalar(select(Measurement.id).where(
                    Measurement.station_id == row["station_id"],
                    Measurement.time_utc == row["time_utc"],
                    Measurement.onesnazevalo == pol,
                ))
                if exists:
                    continue
                db.add(Measurement(station_id=row["station_id"], time_utc=row["time_utc"], onesnazevalo=pol,
                                   vrednost=row[pol], vir="arso", vrsta="meritev"))
                n += 1
        db.commit()
    log.info("ARSO: %d novih meritev", n)
    return n


def fetch_sensor_community() -> None:
    """Občanski senzorji; vrednosti je treba umeriti (senzorji_umerjanje_koeficienti.csv), senzor 21901 je pokvarjen."""
    # TODO: httpx.get(SENSOR_COMMUNITY_URL) -> filtriraj 21901 -> umerjanje -> Measurement(vrsta='ocena')


def fetch_open_meteo() -> None:
    """Vremenska napoved (temperatura, veter, višina mejne plasti) -> weather."""
    params = {"latitude": LJ_LAT, "longitude": LJ_LON, "timezone": "UTC", "forecast_days": 3,
              "hourly": "temperature_2m,wind_speed_10m,boundary_layer_height,weather_code,visibility"}
    try:
        r = httpx.get(OPEN_METEO_URL, params=params, timeout=20)
        r.raise_for_status()
    except httpx.HTTPError as e:
        log.warning("Open-Meteo ni dosegljiv: %s", e)
        return
    h = r.json()["hourly"]
    LATEST["weather"] = h
    with SessionLocal() as db:
        for i, t in enumerate(h["time"]):
            t_utc = dt.datetime.fromisoformat(t)
            w = db.get(Weather, t_utc) or Weather(time_utc=t_utc)
            w.temp_dolina = h["temperature_2m"][i]
            w.veter = h["wind_speed_10m"][i]
            w.visina_mejne_plasti = h["boundary_layer_height"][i]
            db.merge(w)
        db.commit()
    log.info("Open-Meteo: %d ur vremena", len(h["time"]))


def fetch_cams() -> None:
    """CAMS Europe napoved PM2.5/PM10 (model, ~8 km) – rezervna napoved in značilka za naš model."""
    params = {"latitude": LJ_LAT, "longitude": LJ_LON, "timezone": "UTC", "forecast_days": 3,
              "hourly": "pm2_5,pm10", "domains": "cams_europe"}
    try:
        r = httpx.get(OPEN_METEO_AQ_URL, params=params, timeout=20)
        r.raise_for_status()
    except httpx.HTTPError as e:
        log.warning("CAMS ni dosegljiv: %s", e)
        return
    LATEST["cams"] = r.json()["hourly"]
    log.info("CAMS: %d ur napovedi", len(LATEST["cams"]["time"]))


def run_hourly() -> None:
    """En urni cikel: zajem -> napoved."""
    from .forecast import run_forecast

    log.info("Urni zajem se je začel")
    fetch_arso()
    fetch_sensor_community()
    fetch_open_meteo()
    fetch_cams()
    run_forecast()
    log.info("Urni zajem končan")
