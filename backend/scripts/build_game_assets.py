"""Pripravi majhne datoteke za 3D igro »Zmajček čisti nebo« (enkrat, rezultat je v gitu).

Zagon (v mapi backend/):
    python scripts/download_training_data.py   # prenese DEM in emisije
    python scripts/build_game_assets.py

Izhod v frontend/public/assets/terrain/:
    teren.json   meje, velikost mrež, višine
    teren.bin    višine terena (Uint16, decimetri), mreža NX × NZ, vrstica 0 = sever
    mesto.bin    gostota stavb (Uint8 0–255), mreža SX × SZ  -> barva mesta na terenu
    smog.bin     izpusti PM10 kurišča + promet (Uint8 0–255), mreža SX × SZ -> kje je smog gostejši
    slabi_dnevi.json  resnični dnevi z veliko PM2.5 in inverzijo (igra jih uporabi, ko je danes zrak čist)

Viri: Copernicus DEM GLO-30, ARSO inventar emisij (mreža 250 m), GURS KN (število stavb). Glej ARSOhack/04_prostor.
"""
import csv
import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import REPO_DIR, TRAINING_DATA_DIR  # noqa: E402

DEM = TRAINING_DATA_DIR / "04_prostor" / "dem_lj_kotlina_30m.tif"
EMISIJE = TRAINING_DATA_DIR / "04_prostor" / "emisije" / "emisije_mreza_250m_skupaj.csv"
MERITVE = TRAINING_DATA_DIR / "01_meritve" / "arso_lj_pm_urno_2016_2026.csv.gz"
SONDAZA = TRAINING_DATA_DIR / "03_vreme_inverzija" / "igra2_lj_inverzija_dnevno.csv"
OUT = REPO_DIR / "frontend" / "public" / "assets" / "terrain"

# Območje igre: Ljubljana s Šmarno goro, Rožnikom, Golovcem in Barjem
LON_MIN, LON_MAX = 14.38, 14.66
LAT_MIN, LAT_MAX = 45.975, 46.135
NX, NZ = 288, 240  # teren (~75 m)
SX, SZ = 96, 80  # smog in mesto (~225 m)

LAT0 = (LAT_MIN + LAT_MAX) / 2
M_PER_DEG_LAT = 111_320
M_PER_DEG_LON = 111_320 * math.cos(math.radians(LAT0))


def grid(nx: int, nz: int):
    """Središča celic; vrstica 0 = sever (tako kot slike)."""
    lons = LON_MIN + (np.arange(nx) + 0.5) / nx * (LON_MAX - LON_MIN)
    lats = LAT_MAX - (np.arange(nz) + 0.5) / nz * (LAT_MAX - LAT_MIN)
    return np.meshgrid(lons, lats)


def sample_dem() -> np.ndarray:
    import rasterio

    with rasterio.open(DEM) as ds:
        z = ds.read(1).astype("float64")
        z[z < -1000] = np.nan
        inv = ~ds.transform
        lon, lat = grid(NX, NZ)
        col, row = inv * (lon, lat)
    col -= 0.5
    row -= 0.5
    c0 = np.clip(np.floor(col).astype(int), 0, z.shape[1] - 2)
    r0 = np.clip(np.floor(row).astype(int), 0, z.shape[0] - 2)
    fc, fr = col - c0, row - r0
    h = (z[r0, c0] * (1 - fc) * (1 - fr) + z[r0, c0 + 1] * fc * (1 - fr)
         + z[r0 + 1, c0] * (1 - fc) * fr + z[r0 + 1, c0 + 1] * fc * fr)
    return np.nan_to_num(h, nan=np.nanmin(h))


def blur(a: np.ndarray, passes: int = 2) -> np.ndarray:
    for _ in range(passes):
        p = np.pad(a, 1, mode="edge")
        a = (p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:] + p[1:-1, :-2] + p[1:-1, 1:-1] + p[1:-1, 2:]
             + p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]) / 9
    return a


def to_u8(a: np.ndarray, q: float = 0.98) -> np.ndarray:
    top = np.quantile(a[a > 0], q) if (a > 0).any() else 1
    return (np.clip(a / top, 0, 1) * 255).astype(np.uint8)


def emissions():
    kurisca = np.zeros((SZ, SX))
    promet = np.zeros((SZ, SX))
    stavbe = np.zeros((SZ, SX))
    with EMISIJE.open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            lat, lon = float(r["lat"]), float(r["lon"])
            i = int((lon - LON_MIN) / (LON_MAX - LON_MIN) * SX)
            k = int((LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * SZ)
            if 0 <= i < SX and 0 <= k < SZ:
                kurisca[k, i] += float(r["kurisca_pm10_kg_leto"] or 0)
                promet[k, i] += float(r["promet_pm10_kg_leto"] or 0)
                stavbe[k, i] += float(r["st_stavb"] or 0)
    # pozimi so glavni vir kurišča, promet doda obvoznico in vpadnice; koren, da tudi redka naselja dobijo nekaj smoga
    k = to_u8(np.sqrt(blur(kurisca, 2))).astype(float)
    p = to_u8(np.sqrt(blur(promet, 1))).astype(float)
    smog = np.clip(0.7 * k + 0.45 * p, 0, 255).astype(np.uint8)
    return smog, to_u8(blur(stavbe, 2), 0.9)


def bad_days(n: int = 12) -> list[dict]:
    """Najbolj onesnaženi zimski dnevi na Bežigradu (od 2021, ko se meri PM2.5) z višino inverzije iz radiosondaže."""
    import pandas as pd

    m = pd.read_csv(MERITVE, usecols=["time_utc", "station_code", "pm10", "pm25"], parse_dates=["time_utc"])
    m = m[(m.station_code == "E403") & (m.time_utc >= "2021-01-01")]
    m["datum"] = (m.time_utc + pd.Timedelta(hours=1)).dt.date
    d = m.groupby("datum").agg(pm25=("pm25", "mean"), pm10=("pm10", "mean"), ur=("pm25", "count")).reset_index()
    d = d[d.ur >= 20]
    s = pd.read_csv(SONDAZA, parse_dates=["time_utc"])
    s["datum"] = s.time_utc.dt.date
    s = s.groupby("datum").first().reset_index()[["datum", "inv_type", "inv_top_m_agl", "mixing_height_m_agl"]]
    d = d.merge(s, on="datum", how="inner")
    d = d[d.inv_type.isin(["surface", "elevated"])].sort_values("pm25", ascending=False)
    out = []
    used_months = set()
    for r in d.itertuples():
        key = (r.datum.year, r.datum.month)
        if key in used_months:  # raje različni meseci kot pet dni iste epizode
            continue
        used_months.add(key)
        # globina prizemne stabilne plasti (višina mešanja) dobro opiše »jezero« smoga v kotlini
        mh = float(r.mixing_height_m_agl) if r.mixing_height_m_agl == r.mixing_height_m_agl else 250.0
        out.append({
            "datum": r.datum.isoformat(),
            "pm25": round(float(r.pm25), 1),
            "pm10": round(float(r.pm10), 1),
            "inverzija": True,
            "visina_mesanja_m": round(mh),
            "vrh_m": round(299 + min(max(mh, 160), 380)),  # m n. v., omejeno za igro
        })
        if len(out) >= n:
            break
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    h = sample_dem()
    (OUT / "teren.bin").write_bytes(np.round(h * 10).astype("<u2").tobytes())
    smog, mesto = emissions()
    (OUT / "smog.bin").write_bytes(smog.tobytes())
    (OUT / "mesto.bin").write_bytes(mesto.tobytes())
    meta = {
        "lon": [LON_MIN, LON_MAX],
        "lat": [LAT_MIN, LAT_MAX],
        "lat0": LAT0,
        "sirina_m": (LON_MAX - LON_MIN) * M_PER_DEG_LON,
        "visina_m": (LAT_MAX - LAT_MIN) * M_PER_DEG_LAT,
        "teren": {"nx": NX, "nz": NZ, "enota": "dm", "min_m": float(h.min()), "max_m": float(h.max())},
        "mreza": {"nx": SX, "nz": SZ},
        "viri": "Copernicus DEM GLO-30; ARSO inventar emisij PM10 (kurišča, promet); GURS KN",
    }
    (OUT / "teren.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    dnevi = bad_days()
    (OUT / "slabi_dnevi.json").write_text(json.dumps(dnevi, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{len(dnevi)} slabih dni, npr. {dnevi[0] if dnevi else '-'}")
    print(f"Shranjeno v {OUT}: višine {h.min():.0f}–{h.max():.0f} m")


if __name__ == "__main__":
    main()
