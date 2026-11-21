"""Nastavitve zaledja. Vrednosti lahko povoziš z okoljskimi spremenljivkami (.env / docker-compose.yml)."""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

# Majhne statične datoteke, ki jih aplikacija rabi vedno (so v gitu): backend/data/
STATIC_DATA_DIR = BACKEND_DIR / "data"

# Velike zgodovinske datoteke iz ARSOhack – SAMO za učenje modela (training/), ne za delovanje aplikacije.
TRAINING_DATA_DIR = Path(os.getenv("TRAINING_DATA_DIR", REPO_DIR / "data" / "ARSOhack"))

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'zrak.db'}")
MODEL_PATH = Path(os.getenv("MODEL_PATH", BACKEND_DIR / "models" / "model.joblib"))

# Zgrajen Vue frontend (v Dockerju ga FastAPI streže na istem naslovu kot API)
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", REPO_DIR / "frontend" / "dist"))

# Frontend v razvoju (Vite) in Capacitor WebView
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:4173,capacitor://localhost,http://localhost",
).split(",")

# Zajem vsako uro ob :50 + enkrat ob zagonu
SCHEDULER_ENABLED = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
INGEST_ON_STARTUP = os.getenv("INGEST_ON_STARTUP", "true").lower() == "true"
INGEST_MINUTE = int(os.getenv("INGEST_MINUTE", "50"))

# Ljubljana (koordinate in višine iz ARSOhack: arso_lj_postaje.geojson, arso_meteo_postaje.geojson)
LJ_LAT, LJ_LON, LJ_ALT = 46.0655, 14.5127, 299  # LJ Bežigrad
PASJA_RAVAN = (46.0979, 14.2282, 1019)  # hrib nad kotlino: topleje kot v mestu = inverzija (kot inv_pasja_ravan)
LJ_STATIONS = {"E403": "LJ Bežigrad", "E405": "LJ Celovška", "E404": "LJ Vič"}
ARSO_OFFSET_H = 1  # ARSO: lokalni čas UTC+1 brez poletnega premika

# Vse ure, ki jih je ARSO objavil od 13. 11. 2026 (zajem v oblaku ARSOhack, ker XML vrne samo zadnjo uro)
ARSO_HISTORY_URL = os.getenv(
    "ARSO_HISTORY_URL", "https://ada-hack-zrak.live-event-recap-spike.workers.dev/arso/history.csv"
)
