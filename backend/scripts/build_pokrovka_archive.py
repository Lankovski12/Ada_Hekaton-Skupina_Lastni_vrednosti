"""Arhiv jutranjih temperatur v dolini in na hribu za igro »Naredi pokrovko«.

Zagon (v mapi backend/):  python scripts/build_pokrovka_archive.py
Izhod: frontend/public/assets/pokrovka/arhiv.json

Na dan ob 7. uri (lokalno, ARSO UTC+1): temperatura Ljubljana Bežigrad (299 m) in Pasja ravan (1019 m),
vlaga v dolini, povprečje PM2.5 dneva. Višino pokrovke izračunamo iz obeh temperatur z istim pravilom kot igra
(app/pokrovka.py) in jo primerjamo z višino mešanja iz radiosondaže (IGRA2), da vidimo, ali poenostavitev drži.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import REPO_DIR, TRAINING_DATA_DIR  # noqa: E402
from app.pokrovka import visina_pokrovke  # noqa: E402

D = TRAINING_DATA_DIR
OUT = REPO_DIR / "frontend" / "public" / "assets" / "pokrovka" / "arhiv.json"


def main() -> None:
    t = pd.read_csv(D / "03_vreme_inverzija" / "inverzija_urno_2016_2026.csv",
                    usecols=["time_utc", "temp_lj_bezigrad", "temp_pasja_ravan", "rh_lj_bezigrad"], parse_dates=["time_utc"])
    t = t[t.time_utc.dt.hour == 6].dropna()  # 06 UTC = 7h po ARSO
    t["datum"] = t.time_utc.dt.date

    pm = pd.read_csv(D / "01_meritve" / "arso_lj_pm_urno_2016_2026.csv.gz", usecols=["time_utc", "station_code", "pm25", "pm10"],
                     parse_dates=["time_utc"])
    pm = pm[pm.station_code == "E403"]
    pm["datum"] = (pm.time_utc + pd.Timedelta(hours=1)).dt.date
    pmd = pm.groupby("datum").agg(pm25=("pm25", "mean"), pm10=("pm10", "mean"))

    s = pd.read_csv(D / "03_vreme_inverzija" / "igra2_lj_inverzija_dnevno.csv", usecols=["time_utc", "hour_nominal", "mixing_height_m_agl"],
                    parse_dates=["time_utc"])
    s = s[s.hour_nominal == 6]
    s["datum"] = s.time_utc.dt.date
    s = s.set_index("datum").mixing_height_m_agl

    t = t.join(pmd, on="datum").join(s.rename("sonda_m"), on="datum")
    t["pokrovka_m"] = [visina_pokrovke(a, b) for a, b in zip(t.temp_lj_bezigrad, t.temp_pasja_ravan)]

    # preverba poenostavitve proti radiosondaži (samo zima, ko je pokrovka pomembna)
    w = t[t.time_utc.dt.month.isin([11, 12, 1, 2]) & t.sonda_m.notna()]
    r = np.corrcoef(np.log(w.pokrovka_m), np.log(w.sonda_m.clip(lower=10)))[0, 1]
    print(f"Zima, {len(w)} dni: korelacija log(igra) ~ log(sonda) = {r:.2f}; "
          f"mediana igra {w.pokrovka_m.median():.0f} m, sonda {w.sonda_m.median():.0f} m")

    # izbor: zimski dnevi od 2021 z izmerjenim PM2.5, mešanica inverzij in navadnih dni
    c = t[(t.time_utc >= "2021-01-01") & t.time_utc.dt.month.isin([10, 11, 12, 1, 2, 3]) & t.pm25.notna()]
    inv = c[c.temp_pasja_ravan > c.temp_lj_bezigrad]
    nor = c[c.temp_pasja_ravan <= c.temp_lj_bezigrad]
    pick = pd.concat([inv.sample(min(150, len(inv)), random_state=1), nor.sample(min(70, len(nor)), random_state=2)]).sort_values("time_utc")
    out = [{
        "datum": r.datum.isoformat(),
        "vir": "meritve ARSO",
        "t_dolina": round(float(r.temp_lj_bezigrad), 1),
        "t_hrib": round(float(r.temp_pasja_ravan), 1),
        "vlaga": round(float(r.rh_lj_bezigrad)),
        "pm25": round(float(r.pm25), 1),
    } for r in pick.itertuples()]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"dnevi": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(out)} dni ({len(inv)} z inverzijo na voljo) -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
