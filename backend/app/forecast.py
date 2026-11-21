"""Napoved PM2.5 za 1–48 ur.

Če obstaja naučen model (models/model.joblib iz training/train.py), ga uporabimo.
Sicer vrnemo osnovo »vztrajnost + tipičen dnevni hod«, da API vedno nekaj vrne.
"""
import logging
import math
from datetime import UTC, datetime, timedelta
from functools import lru_cache

from .config import MODEL_PATH

log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def load_model():
    if not MODEL_PATH.exists():
        log.info("Model %s ne obstaja – uporabljam osnovno napoved", MODEL_PATH)
        return None
    import joblib

    return joblib.load(MODEL_PATH)


def _start_of_hour(now: datetime | None = None) -> datetime:
    now = now or datetime.now(UTC)
    return now.replace(minute=0, second=0, microsecond=0)


def typical_pm25(t: datetime) -> float:
    """Tipičen zimski dnevni hod (lokalni čas ≈ UTC+1). Samo za demo / rezervo."""
    h = (t.hour + 1) % 24
    evening = math.exp(-((h - 20) ** 2) / 8) * 30
    morning = math.exp(-((h - 8) ** 2) / 4) * 18
    day = t.toordinal()
    factor = 0.7 + 0.5 * abs(math.sin(day * 1.7))
    return round((10 + evening + morning) * factor, 1)


def predict(lat: float, lon: float, hours: int = 48) -> list[dict]:
    start = _start_of_hour()
    model = load_model()
    out = []
    for i in range(1, hours + 1):
        t = start + timedelta(hours=i)
        if model is not None:
            # TODO: sestavi značilke (lag 1/3/24 h, ura, dan, Open-Meteo, CAMS) in pokliči model.predict
            pm25 = typical_pm25(t)
        else:
            pm25 = typical_pm25(t)
        out.append({"cas_utc": t.isoformat(), "pm25": pm25, "pm10": round(pm25 * 1.3, 1)})
    return out


def best_hour(hours: list[dict]) -> str:
    """Najčistejša ura podnevi (7–20 h lokalno)."""
    day = [h for h in hours if 7 <= (datetime.fromisoformat(h["cas_utc"]).hour + 1) % 24 <= 20]
    return min(day or hours, key=lambda h: h["pm25"])["cas_utc"]


def run_forecast() -> None:
    """Pokliče se vsako uro: izračuna napoved in jo zapiše v tabelo forecasts."""
    # TODO: zapis v db.Forecast
    log.info("Napoved izračunana (%d ur)", len(predict(46.05, 14.51)))
