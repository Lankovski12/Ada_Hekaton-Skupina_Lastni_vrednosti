"""Učenje modela za napoved PM2.5 (1–48 h) na podatkih hekatona.

Zagon (v mapi backend/):  python -m training.train
Rezultat: models/model.joblib + izpis MAE proti vztrajnosti (»jutri bo kot danes«).
"""
from pathlib import Path

import pandas as pd

from app.config import DATA_DIR, MODEL_PATH

MERITVE = DATA_DIR / "01_meritve" / "arso_lj_pm_urno_2016_2026.csv.gz"
INVERZIJA = DATA_DIR / "03_vreme_inverzija" / "inverzija_urno_2016_2026.csv"
HORIZONTI = [1, 3, 6, 12, 24, 48]


def load() -> pd.DataFrame:
    if not MERITVE.exists():
        raise SystemExit(f"Ni podatkov: {MERITVE}\nKloniraj ARSOhack v data/ (glej data/README.md).")
    df = pd.read_csv(MERITVE)
    print(df.head())
    print(df.columns.tolist())
    return df


def features(df: pd.DataFrame) -> pd.DataFrame:
    # TODO: lag 1/3/24 h, ura, dan v tednu, vreme (Open-Meteo/ERA5), inverzija, CAMS
    return df


def main() -> None:
    df = features(load())
    # TODO: za vsak horizont naučiti model (LightGBM / sklearn), izračunati MAE in MAE vztrajnosti
    # import joblib; joblib.dump(model, MODEL_PATH)
    Path(MODEL_PATH).parent.mkdir(parents=True, exist_ok=True)
    print(f"Model bo shranjen v {MODEL_PATH} ({len(df)} vrstic)")


if __name__ == "__main__":
    main()
