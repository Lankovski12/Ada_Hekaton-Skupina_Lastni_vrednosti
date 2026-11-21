"""Dnevni podatki za »časovni stroj« na 3D zemljevidu: PM po postajah in megla (inverzija) za vsak dan od 2016.

Zagon (v mapi backend/):
    python scripts/download_training_data.py     # enkrat
    python scripts/zemljevid_dnevi.py            # zapiše frontend/public/assets/map/dnevi.json

Vhod (data/ARSOhack/):
    01_meritve/arso_lj_pm_urno_2016_2026.csv.gz, arso_lj_pm_urno_2026_11_dopolnitev.csv   meritve ARSO
    03_vreme_inverzija/inverzija_urno_2016_2026.csv     ure z inverzijo (Bežigrad 299 m proti Pasji ravni 1019 m)
    03_vreme_inverzija/igra2_lj_inverzija_dnevno.csv    jutranja radiosondaža Ljubljana (višina inverzije, mešanja)
Izhod: stolpčni JSON, en element na dan (null = ni podatka).
Dan je po lokalnem času ARSO (UTC+1).
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import REPO_DIR, TRAINING_DATA_DIR  # noqa: E402

D = TRAINING_DATA_DIR
OUT = REPO_DIR / "frontend" / "public" / "assets" / "map" / "dnevi.json"
POSTAJE = ["E403", "E405", "E404"]  # Bežigrad, Celovška, Vič (glej arso_lj_postaje.geojson)
SONDA_NAD_DNOM = 21  # radiosonda na Bežigradu (299 m) je 21 m nad dnom kotline (278 m)


def local_day(t: pd.Series) -> pd.Series:
    return (t.dt.tz_convert(None) + pd.Timedelta(hours=1)).dt.floor("D")


def main() -> None:
    pm = pd.concat([
        pd.read_csv(D / "01_meritve" / "arso_lj_pm_urno_2016_2026.csv.gz", parse_dates=["time_utc"], low_memory=False),
        pd.read_csv(D / "01_meritve" / "arso_lj_pm_urno_2026_11_dopolnitev.csv", parse_dates=["time_utc"], low_memory=False),
    ])
    pm = pm.drop_duplicates(["time_utc", "station_code"], keep="last")
    pm["dan"] = local_day(pm["time_utc"])
    imena = pm.groupby("station_code")["station_name"].first().to_dict()
    kode = [k for k in POSTAJE if k in imena] or sorted(imena)

    # dnevno povprečje, samo če je vsaj 18 ur meritev
    def daily(col: str) -> pd.DataFrame:
        g = pm.dropna(subset=[col]).groupby(["dan", "station_code"])[col]
        d = g.mean().where(g.count() >= 18)
        return d.unstack("station_code").reindex(columns=kode)

    p25, p10 = daily("pm25"), daily("pm10")
    dnevi = pd.date_range(min(p25.index.min(), p10.index.min()), max(p25.index.max(), p10.index.max()), freq="D")
    p25, p10 = p25.reindex(dnevi), p10.reindex(dnevi)
    # odreži zadnje dni brez celodnevnih meritev (npr. današnji, še nepopoln dan)
    ima = p25.notna().any(axis=1) | p10.notna().any(axis=1)
    dnevi = dnevi[: int(np.flatnonzero(ima.to_numpy())[-1]) + 1]
    p25, p10 = p25.reindex(dnevi), p10.reindex(dnevi)

    # ure z inverzijo (Bežigrad – Pasja ravan)
    inv = pd.read_csv(D / "03_vreme_inverzija" / "inverzija_urno_2016_2026.csv", parse_dates=["time_utc"],
                      usecols=["time_utc", "inv_pasja_ravan"])
    inv["dan"] = local_day(inv["time_utc"])
    inv_ur = inv.dropna().groupby("dan")["inv_pasja_ravan"].sum().reindex(dnevi)

    # jutranja radiosondaža: kako visoko je ujet hladen zrak (m nad dnom kotline)
    snd = pd.read_csv(D / "03_vreme_inverzija" / "igra2_lj_inverzija_dnevno.csv", parse_dates=["time_utc"])
    snd["dan"] = local_day(snd["time_utc"])
    snd = snd.sort_values("hour_nominal").groupby("dan").first()  # najzgodnejša sondaža dneva

    def megla(r: pd.Series) -> float | None:
        if r.inv_type == "surface" and pd.notna(r.mixing_height_m_agl):
            return SONDA_NAD_DNOM + r.mixing_height_m_agl  # globina hladne prizemne plasti
        if r.inv_type == "elevated" and pd.notna(r.inv_base_m_agl):
            return SONDA_NAD_DNOM + r.inv_base_m_agl  # onesnaženje ujeto pod dvignjeno inverzijo
        return 0.0 if r.inv_type == "none" else None

    meg = snd.apply(megla, axis=1).reindex(dnevi)

    def col(s: pd.Series) -> list:
        return [None if pd.isna(v) else int(round(float(v))) for v in s]

    out = {
        "vir": "ARSO (meritve, meteorološke postaje), NOAA IGRA2 (radiosondaža Ljubljana), paket ARSOhack",
        "od": dnevi[0].strftime("%Y-%m-%d"),
        "do": dnevi[-1].strftime("%Y-%m-%d"),
        "postaje": [{"id": k, "ime": imena[k].replace("LJ ", "")} for k in kode],
        "pm25": [col(p25[k]) for k in kode],
        "pm10": [col(p10[k]) for k in kode],
        "invUr": col(inv_ur),
        "megla": col(meg),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n25 = int(np.isfinite(p25.to_numpy(dtype=float)).any(axis=1).sum())
    print(f"{len(dnevi)} dni ({out['od']} – {out['do']}), PM2.5 za {n25} dni → {OUT}")


if __name__ == "__main__":
    main()
