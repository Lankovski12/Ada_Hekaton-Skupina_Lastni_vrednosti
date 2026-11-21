# backend/data/

Majhne statične datoteke, ki jih aplikacija rabi vedno (iz [ARSOhack](https://github.com/vidacex/ARSOhack)):

| Datoteka | Vir | Za kaj |
|---|---|---|
| `osm_obcutljive_lokacije.csv` | © OpenStreetMap contributors (ODbL) | vrtci, šole, bolnišnice, domovi za starejše → `/api/places` |
| `arso_lj_postaje.geojson` | ARSO | ljubljanske merilne postaje |

Velike zgodovinske datoteke (samo za učenje modela) prenese `scripts/download_training_data.py`.
