# data/

Sem kloniraj repozitorij s podatki hekatona (ni v gitu, ker je velik):

```bash
git clone https://github.com/vidacex/ARSOhack.git data/ARSOhack
```

Zaledje ga najde prek `ARSO_DATA_DIR` (privzeto `data/ARSOhack`).

Najpomembnejše datoteke za nas:

| Datoteka | Za kaj |
|---|---|
| `01_meritve/arso_lj_pm_urno_2016_2026.csv.gz` | učenje napovedi (PM2.5, PM10) |
| `01_meritve/senzorji_umerjanje_koeficienti.csv` | umerjanje Sensor.Community |
| `02_modeli/cams_openmeteo_urno_2016_2026.csv.gz` | CAMS kot značilka |
| `03_vreme_inverzija/inverzija_urno_2016_2026.csv` | inverzija za model in 3D meglo |
| `04_prostor/dem_lj_kotlina_30m.tif` | 3D teren kotline |
| `04_prostor/osm_obcutljive_lokacije.csv` | vrtci, šole, bolnišnice |
