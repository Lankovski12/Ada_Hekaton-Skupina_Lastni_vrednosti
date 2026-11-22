# Ada_Hekaton-Skupina_Lastni_vrednosti
Repozitoriji namenjen projektu, ki je nastal na Ada hekatonu. Avtorja projekta sta Lana Tkalčič in Adreja Žiberna. Izbrali sva si izziv podjetja Abelium z naslovom Zrak, ki ga dihamo.

## Zrak za otroke in starše

Spletna + mobilna aplikacija (ista Vue koda, na telefon s Capacitorjem) in Python zaledje (FastAPI),
ki vsako uro prebere meritve ARSO in vreme ter napove PM2.5 za 1–48 ur.
Stran je za dve skupini:

| Zavihek | Za koga | Kaj |
|---|---|---|
| Domov | oba | kakšen je zrak zdaj, en nasvet za starše in eno sporočilo za otroka |
| Za otroke (`/igre`) | otroci | igre na pravih podatkih (Zmajček, Vremenski vedeževalec, Naredi pokrovko) |
| Za starše (`/moj-zrak`) | starši | načrt dneva: kdaj na igrišče, kdaj prezračiti, kdaj igra v hiši |
| Šola in vrtec (`/zemljevid`) | starši | zrak v okolici otrokove šole ali vrtca |
| Zakaj je zrak slab? (`/grafi`) | oba, za skupno branje | kotlina, inverzija in 10 let meritev ARSO |

Družinski profil (ime otroka, astma) ostane samo na napravi.

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
| ure, ki jih zaledje ni ujelo (od 13. 11. 2026) | zajem v oblaku ARSOhack (`/arso/history.csv`) | ob zagonu |
| vreme, višina mejne plasti, inverzija | Open-Meteo (živo): Bežigrad + Pasja ravan 1019 m, inverzija = na hribu topleje kot v mestu | vsako uro |
| napoved PM2.5 za 48 h | CAMS prek Open-Meteo, kasneje naš model | vsako uro |
| igra »Vremenski vedeževalec« – včerajšnji rezultat | meritve ARSO Bežigrad ob 8h (iz baze) | vsako uro |
| zgodbe na strani Podatki in kviz | `zgodovina.json` iz ARSOhack (`scripts/blog_statistika.py`) | statično |
| rezerva brez interneta | povprečje meritev ARSO za isti mesec in uro (`zgodovina.json` → `klima`), označeno kot »običajno« | statično |
| vrtci, šole, bolnišnice | `backend/data/osm_obcutljive_lokacije.csv` (iz ARSOhack, v gitu) | statično |
| 3D zemljevid | DEM, kataster stavb, OSM iz ARSOhack (`scripts/zemljevid_3d.py`) | statično |
| »Izberi svojo šolo« na zemljevidu | model ARSO GRAL 15 m (kurišča, promet relativno), radiosondaža, relief, četrtne skupnosti iz ARSOhack (`scripts/zemljevid_sole.py`) | statično |
| zgodovina 2016–2026 | ARSOhack (`scripts/download_training_data.py`) | enkrat |

Vsaka številka v aplikaciji ima oznako MERITEV, MODEL ali OCENA (komponenta `VirZnacka`).
Nikjer ni izmišljenih številk: če žive meritve ali napovedi ni, aplikacija pokaže povprečje meritev ARSO
za ta mesec in uro in to jasno napiše. Po novih podatkih ARSOhack osveži statistike:

```bash
cd backend
python scripts/download_training_data.py
python scripts/blog_statistika.py   # zapiše frontend/src/data/zgodovina.json in backend/data/zgodovina.json
```

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
  src/views/             Domov, Otroci, Starši, Profil
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
