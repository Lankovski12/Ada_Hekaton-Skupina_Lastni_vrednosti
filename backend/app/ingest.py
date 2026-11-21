"""Zajem podatkov: ARSO, Sensor.Community, Open-Meteo.

Kliče se vsako uro ob :50 (glej main.py). Vsaka funkcija prebere vir in zapiše v bazo.
TODO: dopolnita z dejanskimi URL-ji / formati (glej README-je v ARSOhack/01_meritve, 03_vreme_inverzija).
"""
import logging

import httpx

log = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"  # CAMS napoved
SENSOR_COMMUNITY_URL = "https://data.sensor.community/airrohr/v1/filter/area=46.05,14.51,10"

LJ = {"latitude": 46.05, "longitude": 14.51}


def fetch_arso() -> None:
    """Urne meritve PM10/PM2.5 z ARSO postaj v Ljubljani."""
    # TODO: prebrati ARSO XML/JSON in zapisati v Measurement (vir='arso', vrsta='meritev')
    log.info("ARSO: še ni implementirano")


def fetch_sensor_community() -> None:
    """Občanski senzorji; vrednosti popravi z umerjanjem (senzorji_umerjanje_koeficienti.csv)."""
    # TODO: httpx.get(SENSOR_COMMUNITY_URL) -> umerjanje -> Measurement (vrsta='ocena')
    log.info("Sensor.Community: še ni implementirano")


def fetch_open_meteo() -> dict | None:
    """Vremenska napoved (temperatura, veter, višina mejne plasti) za značilke modela."""
    params = {
        **LJ,
        "hourly": "temperature_2m,wind_speed_10m,boundary_layer_height",
        "forecast_days": 3,
        "timezone": "UTC",
    }
    try:
        r = httpx.get(OPEN_METEO_URL, params=params, timeout=15)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as e:
        log.warning("Open-Meteo ni dosegljiv: %s", e)
        return None


def fetch_cams() -> dict | None:
    """CAMS napoved PM2.5/PM10 prek Open-Meteo (dodatna značilka)."""
    params = {**LJ, "hourly": "pm2_5,pm10", "forecast_days": 3, "timezone": "UTC"}
    try:
        r = httpx.get(OPEN_METEO_AQ_URL, params=params, timeout=15)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as e:
        log.warning("CAMS ni dosegljiv: %s", e)
        return None


def run_hourly() -> None:
    """En urni cikel: zajem -> napoved -> zapis v forecasts."""
    from .forecast import run_forecast

    log.info("Urni zajem se je začel")
    fetch_arso()
    fetch_sensor_community()
    fetch_open_meteo()
    fetch_cams()
    run_forecast()
    log.info("Urni zajem končan")
