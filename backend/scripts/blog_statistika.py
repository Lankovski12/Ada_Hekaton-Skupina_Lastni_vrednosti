"""Iz zgodovinskih meritev ARSOhack izračuna povzetke za zavihek »Blogi« in jih shrani v frontend.

Zagon (v mapi backend/):
    python scripts/download_training_data.py     # enkrat: prenese meritve in inverzije
    python scripts/blog_statistika.py            # zapiše frontend/src/data/zgodovina.json in backend/data/zgodovina.json

Isti JSON uporabljata frontend (zgodbe, rezervni podatki brez interneta) in zaledje
(/api/facts, rezervna napoved, ko CAMS ni dosegljiv) – tako nikjer ni izmišljenih številk.

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
PM_DOPOLNITEV = TRAINING_DATA_DIR / "01_meritve" / "arso_lj_pm_urno_2026_11_dopolnitev.csv"
INV_FILE = TRAINING_DATA_DIR / "03_vreme_inverzija" / "inverzija_urno_2016_2026.csv"
ERA5_FILE = TRAINING_DATA_DIR / "03_vreme_inverzija" / "era5_openmeteo_urno_2021_2026.csv.gz"
OUTS = [REPO_DIR / "frontend" / "src" / "data" / "zgodovina.json", REPO_DIR / "backend" / "data" / "zgodovina.json"]

BEZIGRAD = "E403"
ZIMA = [11, 12, 1, 2]
MESECI = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"]


def r1(x: float) -> float:
    return round(float(x), 1)


def main() -> None:
    pm = pd.read_csv(PM_FILE, parse_dates=["time_utc"], low_memory=False)
    if PM_DOPOLNITEV.exists():  # november 2026 (ARSO XML / EEA), isti stolpci
        dop = pd.read_csv(PM_DOPOLNITEV, parse_dates=["time_utc"], low_memory=False)
        pm = pd.concat([pm, dop[[c for c in pm.columns if c in dop.columns]]], ignore_index=True)
        pm = pm.drop_duplicates(subset=["time_utc", "station_code"], keep="first")
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

    # 2) PM2.5 po mesecih (Bežigrad, cela leta, odkar se meri PM2.5)
    pm25_od = int(bez.dropna(subset=["pm25"])["local"].dt.year.min())
    b25 = bez[(bez["local"].dt.year >= pm25_od) & (bez["local"].dt.year <= zadnje_leto)].dropna(subset=["pm25"])
    meseci = [{"mesec": MESECI[m - 1], "pm25": r1(v)} for m, v in b25.groupby(b25["local"].dt.month)["pm25"].mean().items()]

    # 3) dnevni hod pozimi
    zima = b25[b25["local"].dt.month.isin(ZIMA)]
    ure = [{"ura": int(h), "pm25": r1(v)} for h, v in zima.groupby(zima["local"].dt.hour)["pm25"].mean().items()]

    # 4) inverzija pozimi (razlika temperature Bežigrad – Pasja ravan, 1019 m)
    inv = pd.read_csv(INV_FILE, parse_dates=["time_utc"], usecols=["time_utc", "inv_pasja_ravan", "precip_lj_bezigrad"])
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

    # 8) tipičen dan: povprečje po mesecu in uri (Bežigrad) – rezervna vrednost, kadar ni meritve ali napovedi
    b_kl = bez[(bez["local"].dt.year >= pm25_od) & (bez["local"].dt.year <= zadnje_leto)]
    klima = {}
    for pol in ("pm25", "pm10"):
        g = b_kl.groupby([b_kl["local"].dt.month, b_kl["local"].dt.hour])[pol].mean()
        klima[pol] = [[r1(g.loc[(m, h)]) for h in range(24)] for m in range(1, 13)]
    # delež ur z inverzijo (Bežigrad hladnejši od Pasje ravni), vsa leta
    inv_l = inv.dropna(subset=["inv_pasja_ravan"]).copy()
    inv_l["local"] = inv_l["time_utc"].dt.tz_convert(None) + pd.Timedelta(hours=1)
    g = inv_l.groupby([inv_l["local"].dt.month, inv_l["local"].dt.hour])["inv_pasja_ravan"].mean()
    klima["inverzija"] = [[round(float(g.loc[(m, h)]), 2) for h in range(24)] for m in range(1, 13)]
    # mediana višine mejne plasti nad Bežigradom (ERA5 prek Open-Meteo), m nad tlemi
    if ERA5_FILE.exists():
        e = pd.read_csv(ERA5_FILE, parse_dates=["time_utc"], usecols=["time_utc", "point_id", "boundary_layer_height"])
        e = e[e.point_id == BEZIGRAD].dropna(subset=["boundary_layer_height"])
        e["local"] = e["time_utc"].dt.tz_convert(None) + pd.Timedelta(hours=1)
        g = e.groupby([e["local"].dt.month, e["local"].dt.hour])["boundary_layer_height"].median()
        klima["mejnaPlast"] = [[round(float(g.loc[(m, h)])) for h in range(24)] for m in range(1, 13)]

    # 9) primeri za domačo stran (namesto izmišljenih številk)
    inv = inv.sort_values("time_utc")
    inv["dez6h"] = inv["precip_lj_bezigrad"].rolling(6, min_periods=1).sum()  # padavine zadnjih 6 ur
    bi = b_kl.merge(inv, on="time_utc").dropna(subset=["pm25"])
    m_, h_ = bi["local"].dt.month, bi["local"].dt.hour
    vecer_inv = bi[m_.isin(ZIMA) & h_.between(18, 23) & (bi.inv_pasja_ravan == 1)]
    poletje_dez = bi[m_.isin([6, 7, 8]) & h_.between(6, 10) & (bi.dez6h >= 1)]
    primeri = {
        "inverzijaVecer": r1(vecer_inv["pm25"].mean()),  # zimski večer (18–23 h) z inverzijo
        "inverzijaVecerUr": int(len(vecer_inv)),
        "poletjeDez": r1(poletje_dez["pm25"].mean()),  # poletno jutro (6–10 h) po vsaj 1 mm dežja
        "poletjeDezUr": int(len(poletje_dez)),
    }

    out = {
        "vir": "ARSO, meritve LJ Bežigrad, Celovška, Vič (paket ARSOhack)",
        "zadnjeLeto": zadnje_leto,
        "pm25Od": pm25_od,
        "leta": leta,
        "meseci": meseci,
        "zimaUre": ure,
        "inverzija": inverzija,
        "who": who,
        "postaje": {"od": od, "do": zadnje_leto, "seznam": postaje},
        "rekord": rekord,
        "klima": klima,
        "primeri": primeri,
    }
    for path in OUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"Zapisano: {path}")


if __name__ == "__main__":
    main()
