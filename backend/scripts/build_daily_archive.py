"""Arhiv dni za igro »Vremenski vedeževalec« (vaja s starimi dnevi in rezerva, ko ni podatkov za včeraj).

Zagon (v mapi backend/):
    python scripts/download_training_data.py
    python scripts/build_daily_archive.py

Izhod: frontend/public/assets/daily/arhiv.json – seznam dni v isti obliki kot /api/vceraj:
    datum, vir, postaje [{id, ime, lat, lon, pm25, pm10}], ure (24 × PM2.5 Bežigrad po lokalnih urah),
    vreme {padavine_mm, veter_kmh, temp_c, mejna_plast_m}, prejsnji {pm25, vreme}

Viri: ARSO (Bežigrad urno), EEA (validirane in tekoče urne meritve), zajem ARSO XML (13.–21. 11. 2026, vse postaje),
ERA5 prek Open-Meteo (vreme in višina mejne plasti – model).
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import REPO_DIR, TRAINING_DATA_DIR  # noqa: E402

D = TRAINING_DATA_DIR
OUT = REPO_DIR / "frontend" / "public" / "assets" / "daily" / "arhiv.json"
LOCAL = pd.Timedelta(hours=1)  # ARSO: UTC+1 brez poletnega premika
RNG = np.random.default_rng(42)


def hourly_stations() -> pd.DataFrame:
    """Urne PM2.5/PM10 vseh postaj: stolpci time_local, id, ime, lat, lon, pm25, pm10."""
    frames = []
    # Bežigrad 2016–2026 (ARSO)
    b = pd.read_csv(D / "01_meritve" / "arso_lj_pm_urno_2016_2026.csv.gz",
                    usecols=["time_utc", "station_code", "station_name", "lat", "lon", "pm10", "pm25"], parse_dates=["time_utc"])
    b = b.rename(columns={"station_code": "id", "station_name": "ime"})
    frames.append(b)
    # EEA: druge postaje (2020–2026)
    for f in ["eea_si_validirano_urno_2020_2025.csv.gz", "eea_si_utd_2026.csv"]:
        e = pd.read_csv(D / "01_meritve" / f, usecols=["time_utc", "station_code", "station_name", "lat", "lon", "pollutant", "value"],
                        parse_dates=["time_utc"])
        e = e[e.pollutant.isin(["PM2.5", "PM10"]) & (e.station_name != "LJ Bežigrad")]
        e = e.pivot_table(index=["time_utc", "station_code", "station_name", "lat", "lon"], columns="pollutant", values="value").reset_index()
        e = e.rename(columns={"station_code": "id", "station_name": "ime", "PM2.5": "pm25", "PM10": "pm10"})
        frames.append(e)
    # zajem ARSO XML (vse postaje v Sloveniji, november 2026)
    z = pd.read_csv(D / "05_zadnji_dnevi" / "arso_live_urno_vse_postaje.csv", dtype=str)
    z = z.drop_duplicates(["station_code", "time_from_local"], keep="last")

    def num(s):
        s = s.fillna("").str.replace(",", ".")
        below = s.str.startswith("<")
        v = pd.to_numeric(s.str.lstrip("<"), errors="coerce")
        return v.where(~below, v / 2)

    z = pd.DataFrame({
        "time_utc": pd.to_datetime(z.time_from_local) - LOCAL,
        "id": z.station_code, "ime": z.station_name,
        "lat": pd.to_numeric(z.lat), "lon": pd.to_numeric(z.lon),
        "pm25": num(z.pm25), "pm10": num(z.pm10),
    })
    frames.append(z)
    h = pd.concat(frames, ignore_index=True)
    h["time_utc"] = pd.to_datetime(h.time_utc, utc=True).dt.tz_localize(None)
    h["time_local"] = h.time_utc + LOCAL
    # ista postaja ima lahko različne šifre (E403 / SI0003A) – poenotimo po imenu
    h["id"] = h.groupby("ime").id.transform("first")
    h = h.drop_duplicates(["ime", "time_local"], keep="last")
    return h


def weather() -> pd.DataFrame:
    w = pd.read_csv(D / "03_vreme_inverzija" / "era5_openmeteo_urno_2021_2026.csv.gz",
                    usecols=["time_utc", "point_id", "temperature_2m", "precipitation", "wind_speed_10m", "boundary_layer_height"],
                    parse_dates=["time_utc"])
    w = w[w.point_id == "E403"].copy()
    w["time_local"] = w.time_utc.dt.tz_localize(None) + LOCAL
    w["datum"] = w.time_local.dt.date
    w["ura"] = w.time_local.dt.hour
    g = w.groupby("datum")
    day = pd.DataFrame({
        "padavine_mm": g.precipitation.sum().round(1),
        "veter_kmh": g.wind_speed_10m.mean().round(1),
        "temp_c": g.temperature_2m.mean().round(1),
        # jutranja višina mejne plasti (ob 7h) – takrat je pokrovka navadno najnižja
        "mejna_plast_m": w[w.ura == 7].set_index("datum").boundary_layer_height.round(0),
    })
    return day


def build() -> list[dict]:
    h = hourly_stations()
    h["datum"] = h.time_local.dt.date
    h["ura"] = h.time_local.dt.hour
    h = h[h.time_local >= "2021-01-01"]
    w = weather()

    daily = h.groupby(["datum", "id", "ime"]).agg(lat=("lat", "first"), lon=("lon", "first"), pm25=("pm25", "mean"),
                                                   pm10=("pm10", "mean"), n=("pm25", "count")).reset_index()
    daily = daily[daily.n >= 18]
    bez = h[h.ime == "LJ Bežigrad"]
    bez_ure = bez.pivot_table(index="datum", columns="ura", values="pm25")
    bez_day = daily[daily.ime == "LJ Bežigrad"].set_index("datum").pm25

    candidates = []
    for datum, g in daily.groupby("datum"):
        if datum not in bez_ure.index or bez_ure.loc[datum].count() < 20 or len(g) < 5:
            continue
        candidates.append(datum)

    # izbor: največ zimskih dni (zanimivejši), nekaj ostalih in vsi novembrski dnevi 2026 z vsemi postajami
    cand = pd.Series(candidates)
    month = cand.map(lambda d: d.month)
    winter = cand[month.isin([11, 12, 1, 2])]
    other = cand[~month.isin([11, 12, 1, 2])]
    nov26 = cand[cand.map(lambda d: d.year == 2026 and d.month == 11)]
    pick = set(winter.sample(min(170, len(winter)), random_state=1)) | set(other.sample(min(60, len(other)), random_state=2)) | set(nov26)

    out = []
    for datum in sorted(pick):
        g = daily[daily.datum == datum]
        prev = datum - pd.Timedelta(days=1)
        ure = bez_ure.loc[datum].reindex(range(24))

        def vr(d):
            if d not in w.index:
                return None  # vreme (ERA5) sega do 12. 11. 2026
            return {k: (None if pd.isna(v) else float(v)) for k, v in w.loc[d].items()}

        out.append({
            "datum": datum.isoformat(),
            "vir": "arhiv ARSO",
            "postaje": [
                {"id": r.id, "ime": r.ime, "lat": round(r.lat, 4), "lon": round(r.lon, 4),
                 "pm25": round(float(r.pm25), 1), "pm10": None if pd.isna(r.pm10) else round(float(r.pm10), 1)}
                for r in g.itertuples() if not pd.isna(r.pm25)
            ],
            "ure": [None if pd.isna(v) else round(float(v), 1) for v in ure],
            "vreme": vr(datum),
            "prejsnji": {"pm25": round(float(bez_day.loc[prev]), 1), "vreme": vr(prev)} if prev in bez_day.index else None,
        })
    return out


def main() -> None:
    days = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"dnevi": days}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(days)} dni -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
