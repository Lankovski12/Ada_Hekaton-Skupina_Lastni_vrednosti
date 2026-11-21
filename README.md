# Ada_Hekaton-Skupina_Lastni_vrednosti
Repozitoriji namenjen projektu, ki je nastal na Ada hekatonu. Avtorja projekta sta Lana Tkalčič in Adreja Žiberna. Izbrali sva si izziv podjetja Abelium z naslovom Zrak, ki ga dihamo.

## Zrak za otroke in starše

Spletna + mobilna aplikacija (ista Vue koda, na telefon s Capacitorjem) in Python zaledje (FastAPI),
ki vsako uro prebere meritve ARSO in vreme ter napove PM2.5 za 1–48 ur.
Otroci dobijo igre na pravih podatkih, starši napoved in nasvete. Profil (astma) ostane na napravi.

Podatki hekatona: https://github.com/vidacex/ARSOhack (glej `data/README.md`).

## Struktura

```
backend/                 Python zaledje
  app/main.py            FastAPI, endpointi (/api/now, /forecast, /scene, /daily-game, /facts, /places)
  app/ingest.py          zajem: ARSO, Sensor.Community, Open-Meteo (vsako uro ob :50)
  app/forecast.py        nalaganje modela, napoved
  app/db.py              SQLAlchemy modeli (SQLite)
  app/schemas.py         oblika JSON odgovorov (= frontend/src/lib/types.ts)
  training/train.py      učenje modela iz podatkov hekatona -> models/model.joblib
  scripts/dem_to_heightmap.py   DEM -> heightmap za 3D kotlino
  tests/                 pytest
frontend/                Vue 3 + TS + Vite + Pinia (+ kasneje Capacitor, TresJS)
  src/games/             igre (vsaka v svoji mapi)
  src/scenes/            3D / 2.5D scene (Kotlina)
  src/composables/       useAirData, useProfile
  src/views/             strani: Domov, Otroci, Starši, Profil
  public/assets/         3D modeli in teren
data/                    sem kloniraj ARSOhack (ni v gitu)
docs/                    arhitektura in zapiski
```

## Zagon

Zaledje:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload        # http://localhost:8000/docs
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                          # http://localhost:5173
```
