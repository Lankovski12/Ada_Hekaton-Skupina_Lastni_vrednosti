"""Iz zgodovinskih meritev ARSOhack izračuna povzetke za zavihek »Blogi« in jih shrani v frontend.

Zagon (v mapi backend/):
    python scripts/download_training_data.py     # enkrat: prenese meritve in inverzije
    python scripts/blog_statistika.py            # zapiše frontend/src/data/zgodovina.json

Potrebuje pandas (v requirements-dev.txt / training). Aplikacija sama pandas ne rabi – bere samo JSON.
Vir: ARSO (meritve PM10/PM2.5 in meteorološke postaje) prek paketa ARSOhack.
"""
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import REPO_DIR, TRAINING_DATA_DIR  # noqa: E402

PM_FILE = TRAINING_DATA_DIR / "01_meritve" / "arso_lj_pm_urno_2016_2026.csv.gz"
INV_FILE = TRAINING_DATA_DIR / "03_vreme_inverzija" / "inverzija_urno_2016_2026.csv"
OUT = REPO_DIR / "frontend" / "src" / "data" / "zgodovina.json"

BEZIGRAD = "E403"
ZIMA = [11, 12, 1, 2]
MESECI = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"]


def r1(x: float) -> float:
    return round(float(x), 1)


def main() -> None:
    pm = pd.read_csv(PM_FILE, parse_dates=["time_utc"], low_memory=False)
    # ARSO lokalni čas = UTC+1 brez poletnega premika
    pm["local"] = pm["time_utc"].dt.tz_convert(None) + pd.Timedelta(hours=1)
    bez = pm[pm.station_code == BEZIGRAD].copy()
    zadnje_leto = int(bez["local"].dt.year.max()) - 1  # zadnje celo leto

    # 1) desetletni trend: PM10 na Bežigradu (PM2.5 se tu meri šele od 2021)
    dnevno10 = bez.set_index("local")["pm10"].resample("D").mean()
    leta = []
    for y in range(2016, zadnje_leto + 1):
        d = dnevno10[str(y)]
        leta.append({"leto": y, "pm10": r1(d.mean()), "dniNad50": int((d > 50).sum())})

    # 2) PM2.5 po mesecih (Bežigrad, cela leta od 2021)
    b25 = bez[(bez["local"].dt.year >= 2021) & (bez["local"].dt.year <= zadnje_leto)].dropna(subset=["pm25"])
    meseci = [{"mesec": MESECI[m - 1], "pm25": r1(v)} for m, v in b25.groupby(b25["local"].dt.month)["pm25"].mean().items()]

    # 3) dnevni hod pozimi
    zima = b25[b25["local"].dt.month.isin(ZIMA)]
    ure = [{"ura": int(h), "pm25": r1(v)} for h, v in zima.groupby(zima["local"].dt.hour)["pm25"].mean().items()]

    # 4) inverzija pozimi (razlika temperature Bežigrad – Pasja ravan, 1019 m)
    inv = pd.read_csv(INV_FILE, parse_dates=["time_utc"], usecols=["time_utc", "inv_pasja_ravan"])
    zi = zima.merge(inv, on="time_utc").dropna(subset=["inv_pasja_ravan"])
    inverzija = {
        "z": r1(zi[zi.inv_pasja_ravan == 1]["pm25"].mean()),
        "brez": r1(zi[zi.inv_pasja_ravan == 0]["pm25"].mean()),
        "delezUr": round(float(zi.inv_pasja_ravan.mean()) * 100),
    }

    # 5) dnevi nad smernico WHO (PM2.5 dnevno > 15) v zadnjem letu
    dnevno25 = bez.set_index("local")["pm25"].resample("D").mean()[str(zadnje_leto)]
    who = {
        "leto": zadnje_leto,
        "dni": int((dnevno25 > 15).sum()),
        "izmed": int(dnevno25.notna().sum()),
        "prviDan": dnevno25.index[0].strftime("%Y-%m-%d"),
        "dnevno": [None if pd.isna(v) else round(float(v)) for v in dnevno25],  # za koledar
    }

    # 6) postaje: PM2.5, cela leta, ko so merile vse tri
    od = 2022
    p = pm[(pm["local"].dt.year >= od) & (pm["local"].dt.year <= zadnje_leto)].dropna(subset=["pm25"])
    postaje = [
        {"ime": n.replace("LJ ", ""), "tip": t, "pm25": r1(v)}
        for (n, t), v in p.groupby(["station_name", "station_type"])["pm25"].mean().sort_values(ascending=False).items()
    ]

    # 7) najslabši dan
    dan = dnevno10.idxmax()
    rekord = {"datum": dan.strftime("%Y-%m-%d"), "pm10": r1(dnevno10.max())}

    out = {
        "vir": "ARSO, meritve LJ Bežigrad, Celovška, Vič (paket ARSOhack)",
        "zadnjeLeto": zadnje_leto,
        "leta": leta,
        "meseci": meseci,
        "zimaUre": ure,
        "inverzija": inverzija,
        "who": who,
        "postaje": {"od": od, "do": zadnje_leto, "seznam": postaje},
        "rekord": rekord,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Zapisano: {OUT}")


if __name__ == "__main__":
    main()
