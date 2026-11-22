"""Zajem podatkov v živo (brez ključev): ARSO XML, Open-Meteo vreme in CAMS napoved.

Kliče se ob zagonu in vsako uro ob :50 (glej main.py).
Viri so opisani v ARSOhack/v_zivo/README.md.
"""
import csv
import datetime as dt
import io
import logging
import xml.etree.ElementTree as ET

import httpx
from sqlalchemy import select

from .config import ARSO_HISTORY_URL, ARSO_OFFSET_H, LJ_ALT, LJ_LAT, LJ_LON, PASJA_RAVAN
from .db import Measurement, SessionLocal, Station, Weather

log = logging.getLogger(__name__)

ARSO_XML = "https://www.arso.gov.si/xml/zrak/ones_zrak_urni_podatki_zadnji.xml"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

ARSO_OFFSET = dt.timedelta(hours=ARSO_OFFSET_H)  # ARSO: lokalni čas UTC+1 brez poletnega premika

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


def parse_arso_history_csv(text: str) -> list[dict]:
    """Zajem v oblaku (ARSOhack v_zivo): vse ure od 13. 11. 2026, isti stolpci kot 05_zadnji_dnevi/arso_live_urno_vse_postaje.csv.
    Če je ARSO uro objavil dvakrat, obdržimo zadnji zapis."""
    rows: dict[tuple, dict] = {}
    for r in csv.DictReader(io.StringIO(text)):
        t_from = (r.get("time_from_local") or "").strip()
        if not t_from or not r.get("station_code"):
            continue
        t_utc = dt.datetime.fromisoformat(t_from) - ARSO_OFFSET
        rows[(r["station_code"], t_utc)] = {
            "station_id": r["station_code"],
            "ime": (r.get("station_name") or "").strip(),
            "lat": float(r["lat"]) if r.get("lat") else None,
            "lon": float(r["lon"]) if r.get("lon") else None,
            "time_utc": t_utc,
            "pm25": _num(r.get("pm25")),
            "pm10": _num(r.get("pm10")),
        }
    return list(rows.values())


def store_arso_rows(rows: list[dict]) -> int:
    """Zapiše postaje in meritve PM2.5/PM10; obstoječih ur ne podvaja."""
    rows = [r for r in rows if r["lat"] is not None]
    if not rows:
        return 0
    n = 0
    with SessionLocal() as db:
        t_min = min(r["time_utc"] for r in rows)
        existing = set(db.execute(
            select(Measurement.station_id, Measurement.time_utc, Measurement.onesnazevalo)
            .where(Measurement.time_utc >= t_min)
        ).all())
        known = set(db.scalars(select(Station.id)).all())
        for row in rows:
            if row["station_id"] not in known:
                db.add(Station(id=row["station_id"], ime=row["ime"], lat=row["lat"], lon=row["lon"], vir="arso"))
                known.add(row["station_id"])
            for pol in ("pm25", "pm10"):
                if row[pol] is None or (row["station_id"], row["time_utc"], pol) in existing:
                    continue
                db.add(Measurement(station_id=row["station_id"], time_utc=row["time_utc"], onesnazevalo=pol,
                                   vrednost=row[pol], vir="arso", vrsta="meritev"))
                n += 1
        db.commit()
    return n


def fetch_arso() -> int:
    """Zadnja ura uradnih meritev za vse postaje ARSO -> stations + measurements."""
    try:
        r = httpx.get(ARSO_XML, timeout=30)
        r.raise_for_status()
    except httpx.HTTPError as e:
        log.warning("ARSO ni dosegljiv: %s", e)
        return 0
    n = store_arso_rows(parse_arso_xml(r.content))
    log.info("ARSO: %d novih meritev", n)
    return n


def fetch_arso_history() -> int:
    """Dopolni ure, ki jih zaledje ni ujelo (npr. ni teklo) – iz zajema v oblaku ARSOhack. -1 = ni dosegljivo."""
    try:
        r = httpx.get(ARSO_HISTORY_URL, timeout=60, follow_redirects=True)
        r.raise_for_status()
    except httpx.HTTPError as e:
        log.warning("Zgodovina ARSO (zajem v oblaku) ni dosegljiva: %s", e)
        return -1
    n = store_arso_rows(parse_arso_history_csv(r.text))
    log.info("ARSO zgodovina: %d novih meritev", n)
    return n


def fetch_open_meteo() -> None:
    """Vremenska napoved za Bežigrad in Pasjo ravan (1019 m) -> weather.

    Inverzija = na hribu topleje kot v mestu (ista definicija kot inv_pasja_ravan v ARSOhack).
    Višina mejne plasti pove, kako visoko se delci premešajo (vrh megle / onesnaženja).
    """
    params = {
        "latitude": f"{LJ_LAT},{PASJA_RAVAN[0]}",
        "longitude": f"{LJ_LON},{PASJA_RAVAN[1]}",
        "elevation": f"{LJ_ALT},{PASJA_RAVAN[2]}",
        "timezone": "UTC", "forecast_days": 3, "past_days": 1,
        "hourly": "temperature_2m,wind_speed_10m,boundary_layer_height",
    }
    try:
        r = httpx.get(OPEN_METEO_URL, params=params, timeout=20)
        r.raise_for_status()
    except httpx.HTTPError as e:
        log.warning("Open-Meteo ni dosegljiv: %s", e)
        return
    dolina, hrib = (x["hourly"] for x in r.json())
    LATEST["weather"] = dolina
    hrib_t = dict(zip(hrib["time"], hrib["temperature_2m"]))
    with SessionLocal() as db:
        for i, t in enumerate(dolina["time"]):
            t_utc = dt.datetime.fromisoformat(t)
            w = db.get(Weather, t_utc) or Weather(time_utc=t_utc)
            w.temp_dolina = dolina["temperature_2m"][i]
            w.temp_hrib = hrib_t.get(t)
            w.veter = dolina["wind_speed_10m"][i]
            w.visina_mejne_plasti = dolina["boundary_layer_height"][i]
            w.inverzija = None if w.temp_dolina is None or w.temp_hrib is None else w.temp_hrib > w.temp_dolina
            db.merge(w)
        db.commit()
    log.info("Open-Meteo: %d ur vremena (Bežigrad + Pasja ravan)", len(dolina["time"]))


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


_history_done = False


def run_hourly() -> None:
    """En urni cikel: meritve ARSO, vreme in napoved CAMS. Ob prvem zagonu dopolni še zgodovino ARSO."""
    global _history_done

    log.info("Urni zajem se je začel")
    if not _history_done:
        _history_done = fetch_arso_history() >= 0
    fetch_arso()
    fetch_open_meteo()
    fetch_cams()
    log.info("Urni zajem končan")
