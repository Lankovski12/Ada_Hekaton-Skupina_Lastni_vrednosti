"""Povzetki zgodovinskih meritev ARSO (paket ARSOhack) – data/zgodovina.json.

Datoteko zapiše scripts/blog_statistika.py iz:
  01_meritve/arso_lj_pm_urno_2016_2026.csv.gz       (PM2.5/PM10, Bežigrad)
  03_vreme_inverzija/inverzija_urno_2016_2026.csv   (inverzija Bežigrad – Pasja ravan)
  03_vreme_inverzija/era5_openmeteo_urno_2021_2026  (višina mejne plasti)

Uporabimo jih kot rezervo, kadar ni žive meritve ali napovedi (namesto izmišljenih številk),
in za »Ali ste vedeli?« (/api/facts).
"""
import json
from datetime import datetime, timedelta
from functools import lru_cache

from .config import ARSO_OFFSET_H, STATIC_DATA_DIR

PATH = STATIC_DATA_DIR / "zgodovina.json"


@lru_cache(maxsize=1)
def data() -> dict:
    return json.loads(PATH.read_text(encoding="utf-8"))


def _mh(t: datetime) -> tuple[int, int]:
    """Mesec (0–11) in ura v lokalnem času ARSO (UTC+1) za čas v UTC."""
    local = t + timedelta(hours=ARSO_OFFSET_H)
    return local.month - 1, local.hour


def typical(t: datetime, key: str) -> float | None:
    """Povprečje meritev za ta mesec in uro (key: pm25, pm10, inverzija, mejnaPlast)."""
    tab = data().get("klima", {}).get(key)
    if not tab:
        return None
    m, h = _mh(t)
    return tab[m][h]


def label() -> str:
    d = data()
    return f"ARSO Bežigrad {d['pm25Od']}–{d['zadnjeLeto']}"
