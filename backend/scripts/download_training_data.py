"""Prenese SAMO datoteke iz ARSOhack, ki jih rabimo za učenje modela in 3D teren (~150 MB namesto ~1 GB).

Zagon (v mapi backend/):  python scripts/download_training_data.py
Shrani v:                 data/ARSOhack/<ista pot kot v repozitoriju>
Aplikacija (Docker) teh datotek NE potrebuje – uporablja žive podatke ARSO in Open-Meteo.
"""
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import TRAINING_DATA_DIR  # noqa: E402

BASE = "https://raw.githubusercontent.com/vidacex/ARSOhack/main/"
FILES = [
    # meritve ARSO (cilj, ki ga napovedujemo)
    "01_meritve/arso_lj_pm_urno_2016_2026.csv.gz",
    "01_meritve/arso_lj_pm_urno_2026_11_dopolnitev.csv",
    # vreme in inverzija (značilke)
    "03_vreme_inverzija/inverzija_urno_2016_2026.csv",
    "03_vreme_inverzija/igra2_lj_inverzija_dnevno.csv",  # radiosondaža (scripts/zemljevid_dnevi.py)
    "03_vreme_inverzija/era5_openmeteo_urno_2016_2020.csv.gz",
    "03_vreme_inverzija/era5_openmeteo_urno_2021_2026.csv.gz",
    # CAMS (značilka + primerjava)
    "02_modeli/cams_openmeteo_urno_2016_2026.csv.gz",
    # 3D teren kotline in 3D zemljevid (scripts/zemljevid_3d.py)
    "04_prostor/dem_lj_kotlina_30m.tif",
    "04_prostor/kn_stavbe.gpkg",
    "04_prostor/osm_obcutljive_lokacije.geojson",
    "04_prostor/mol_meja.geojson",
]


def main() -> None:
    for rel in FILES:
        dst = TRAINING_DATA_DIR / rel
        if dst.exists():
            print(f"✓ že obstaja  {rel}")
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        print(f"↓ prenašam    {rel}")
        urllib.request.urlretrieve(BASE + rel, dst)
    print(f"Končano: {TRAINING_DATA_DIR}")


if __name__ == "__main__":
    main()
