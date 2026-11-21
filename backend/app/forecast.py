"""Napoved PM2.5 za 1–48 ur.

Vrstni red:
1. naš model (models/model.joblib iz training/train.py) – TODO
2. CAMS napoved iz Open-Meteo (ingest.LATEST["cams"])
3. tipičen dnevni hod (demo), da API vedno nekaj vrne
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
        log.info("Model %s ne obstaja – uporabljam CAMS ali demo napoved", MODEL_PATH)
        return None
    import joblib

    return joblib.load(MODEL_PATH)


def start_of_hour(now: datetime | None = None) -> datetime:
    now = now or datetime.now(UTC)
    return now.replace(minute=0, second=0, microsecond=0)


def typical_pm25(t: datetime) -> float:
    """Tipičen zimski dnevni hod (lokalni čas ≈ UTC+1). Samo za demo / rezervo."""
    h = (t.hour + 1) % 24
    evening = math.exp(-((h - 20) ** 2) / 8) * 30
    morning = math.exp(-((h - 8) ** 2) / 4) * 18
    factor = 0.7 + 0.5 * abs(math.sin(t.toordinal() * 1.7))
    return round((10 + evening + morning) * factor, 1)


def _cams_lookup() -> dict[datetime, tuple[float | None, float | None]]:
    from .ingest import LATEST

    cams = LATEST.get("cams")
    if not cams:
        return {}
    return {
        datetime.fromisoformat(t).replace(tzinfo=UTC): (cams["pm2_5"][i], cams["pm10"][i])
        for i, t in enumerate(cams["time"])
    }


def predict(lat: float, lon: float, hours: int = 48) -> tuple[list[dict], str]:
    """Vrne (ure, ime_modela)."""
    start = start_of_hour()
    cams = _cams_lookup()
    # TODO: ko bo model naučen: sestavi značilke (lag 1/3/24 h, ura, dan, vreme, CAMS) in pokliči model.predict
    model_name = "cams" if cams else "demo"
    out = []
    for i in range(1, hours + 1):
        t = start + timedelta(hours=i)
        pm25, pm10 = cams.get(t, (None, None))
        if pm25 is None:
            pm25 = typical_pm25(t)
            pm10 = None
        out.append({"cas_utc": t.isoformat(), "pm25": round(pm25, 1), "pm10": round(pm10 or pm25 * 1.3, 1)})
    return out, model_name


def best_hour(hours: list[dict]) -> str:
    """Najčistejša ura podnevi (7–20 h lokalno)."""
    day = [h for h in hours if 7 <= (datetime.fromisoformat(h["cas_utc"]).hour + 1) % 24 <= 20]
    return min(day or hours, key=lambda h: h["pm25"])["cas_utc"]


def run_forecast() -> None:
    """Pokliče se vsako uro: izračuna napoved in jo zapiše v tabelo forecasts."""
    ure, name = predict(46.05, 14.51)
    # TODO: zapis v db.Forecast (izdano_utc, ciljni_utc, pm25, pm10, model=name)
    log.info("Napoved izračunana (%d ur, model=%s)", len(ure), name)
