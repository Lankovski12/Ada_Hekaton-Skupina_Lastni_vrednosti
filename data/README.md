# data/ (ni v gitu)

Sem `backend/scripts/download_training_data.py` prenese **samo** tiste datoteke iz
[ARSOhack](https://github.com/vidacex/ARSOhack), ki jih rabijo skripte v `backend/scripts/` (statistike, 3D teren, zemljevid, igre).
Celotnega repozitorija ni treba klonirati, aplikacija (Docker) pa teh datotek sploh ne potrebuje.

```bash
cd backend
python scripts/download_training_data.py
```
