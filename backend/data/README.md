# backend/data/

Majhne statične datoteke, ki jih aplikacija rabi vedno (iz [ARSOhack](https://github.com/vidacex/ARSOhack)):

| Datoteka | Vir | Za kaj |
|---|---|---|
| `arso_lj_postaje.geojson` | ARSO | ljubljanske merilne postaje |
| `zgodovina.json` | ARSO prek ARSOhack (`scripts/blog_statistika.py`) | rezervna napoved in kotlina, ko ni živih podatkov (povprečja po mesecu in uri) |

Velike zgodovinske datoteke (samo za pripravo podatkov v `scripts/`) prenese `scripts/download_training_data.py`.
