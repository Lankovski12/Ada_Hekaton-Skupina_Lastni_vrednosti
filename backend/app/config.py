"""Nastavitve zaledja. Vrednosti lahko povoziš z okoljskimi spremenljivkami (.env)."""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

# Pot do kloniranega repozitorija s podatki hekatona (github.com/vidacex/ARSOhack)
DATA_DIR = Path(os.getenv("ARSO_DATA_DIR", REPO_DIR / "data" / "ARSOhack"))

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'zrak.db'}")
MODEL_PATH = Path(os.getenv("MODEL_PATH", BACKEND_DIR / "models" / "model.joblib"))

# Frontend (Vite dev strežnik, Capacitor WebView)
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:4173,capacitor://localhost,http://localhost",
).split(",")

# Zajem vsako uro ob :50 (lahko izklopiš za razvoj)
SCHEDULER_ENABLED = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
INGEST_MINUTE = int(os.getenv("INGEST_MINUTE", "50"))
