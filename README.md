# Ada_Hekaton-Skupina_Lastni_vrednosti
Repozitoriji namenjen projektu, ki je nastal na Ada hekatonu. Avtorja projekta sta Lana Tkalčič in Adreja Žiberna. Izbrali sva si izziv podjetja Abelium z naslovom Zrak, ki ga dihamo.

## Zrak za otroke in starše

Aplikacija je namenjena **družinam z otroki v Ljubljani**. Otroci so na onesnažen zrak bolj občutljivi
(dihajo hitreje, pljuča se jim še razvijajo), zato se vse vrti okrog enega vprašanja:
**kdaj se lahko otrok varno igra zunaj?**

- **Za otroke:** oblaček maskota v otroškem jeziku pove, kakšen je zrak danes, igre pa učijo na pravih podatkih.
- **Za starše:** nasvet za danes (igrišče, zračenje, ostati doma), napoved za 48 ur z najboljšo uro za ven,
  vrtci in šole v bližini ter dejstva o otrocih in zraku.
- **Družinski profil:** ime otroka in astma (strožje meje) ostaneta samo na napravi.

Spletna + mobilna aplikacija (ista Vue koda, na telefon s Capacitorjem) in Python zaledje (FastAPI),
ki vsako uro prebere meritve ARSO in vreme ter napove PM2.5 za 1–48 ur.

Podatki hekatona: https://github.com/vidacex/ARSOhack (glej `data/README.md`).

## Zagon z enim ukazom (Docker)

```bash
docker compose up --build
```

Odpri http://localhost:8000 (aplikacija) ali http://localhost:8000/docs (API).
Ena slika zgradi Vue frontend in ga streže skupaj s Python zaledjem. Ob zagonu in nato vsako uro ob :50
zaledje prebere žive meritve ARSO ter vreme in napoved CAMS (Open-Meteo). Brez interneta kaže demo vrednosti.

## Katere podatke uporablja aplikacija

| Kaj | Od kod | Kdaj |
|---|---|---|
| trenutne meritve PM2.5/PM10 | ARSO XML (živo, brez ključa) | vsako uro |
| vreme, višina mejne plasti | Open-Meteo (živo) | vsako uro |
| napoved PM2.5 za 48 h | CAMS prek Open-Meteo, kasneje naš model | vsako uro |
| vrtci, šole, bolnišnice | `backend/data/osm_obcutljive_lokacije.csv` (iz ARSOhack, v gitu) | statično |
| zgodovina 2016–2026 | ARSOhack, samo za učenje modela (`scripts/download_training_data.py`) | enkrat |

Celotnega ARSOhack repozitorija ni treba klonirati.

## Struktura

```
Dockerfile, docker-compose.yml   vse v eni sliki
backend/                 Python zaledje (FastAPI)
  app/main.py            endpointi + streženje frontenda
  app/ingest.py          zajem: ARSO XML, Open-Meteo, CAMS (ob zagonu in vsako uro ob :50)
  app/forecast.py        napoved (naš model -> CAMS -> demo)
  app/db.py              SQLAlchemy modeli (SQLite)
  app/schemas.py         oblika JSON odgovorov (= frontend/src/lib/types.ts)
  data/                  majhne statične datoteke (lokacije, postaje)
  training/train.py      učenje modela -> models/model.joblib
  scripts/               prenos podatkov za učenje, DEM -> heightmap
  tests/                 pytest
frontend/                Vue 3 + TS + Vite + Pinia
  src/scenes/            DataSculpture (oblak delcev), Kotlina
  src/games/             igre (vsaka v svoji mapi)
  src/composables/       useAirData, useProfile
  src/views/             Domov, Za otroke, Za starše, Družinski profil
data/                    podatki za učenje (ni v gitu)
docs/                    arhitektura
```

## Razvoj brez Dockerja

Zaledje (terminal 1):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Frontend (terminal 2, sprotno osveževanje; `/api` gre na zaledje):

```bash
cd frontend
npm install
npm run dev
```
