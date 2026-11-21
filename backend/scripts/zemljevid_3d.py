"""Iz prostorskih podatkov ARSOhack pripravi lahke datoteke za 3D zemljevid na zavihku »Blogi«.

Zagon (v mapi backend/):
    python scripts/zemljevid_3d.py

Vhod (data/ARSOhack/04_prostor/, prenese jih download_training_data.py):
    dem_lj_kotlina_30m.tif            relief (Copernicus DEM, model površja)
    kn_stavbe.gpkg                    tlorisi stavb (GURS, Kataster nepremičnin)
    osm_obcutljive_lokacije.geojson   vrtci, šole, bolnišnice ... (© OpenStreetMap contributors, ODbL)
    mol_meja.geojson                  meja Mestne občine Ljubljana
Izhod (frontend/public/assets/map/):
    teren.bin    Uint16, nadmorska višina v decimetrih, mreža 100 m (vrstice od severa proti jugu)
    teren.json   opis mreže, izhodišče, meja MOL, merilne postaje
    stavbe.bin   Int16 zaporedje: [n, višina_dm, vrsta, x0, y0, x1, y1, ...] za vsako stavbo (koordinate v 0,5 m od izhodišča)
                 vrsta: 0 navadna, 1 vrtec, 2 šola, 3 bolnišnica, 4 zdravstveni dom, 5 dom za starejše
    lokacije.json  občutljive lokacije z višino nad dnom kotline

Vse koordinate so v D96/TM (EPSG:3794, metri), premaknjene v izhodišče = središče MOL (x proti vzhodu, y proti severu).
Potrebuje: numpy, rasterio, geopandas, pyogrio, shapely, pyproj (samo za pripravo – aplikacija jih ne rabi).
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import REPO_DIR, STATIC_DATA_DIR, TRAINING_DATA_DIR  # noqa: E402

SRC = TRAINING_DATA_DIR / "04_prostor"
OUT = REPO_DIR / "frontend" / "public" / "assets" / "map"

CELL = 100.0  # velikost celice terena v metrih (nizko-poligonski videz)
MARGIN = 3000.0  # teren sega 3 km čez mejo MOL, da se vidijo hribi okoli
DNO = 278.0  # dno kotline (2. percentil DEM, glej README ARSOhack)
UNIT = 0.5  # enota koordinat stavb v stavbe.bin (m)
MIN_AREA = 20.0  # manjše stavbe (lope, garaže) izpustimo
SIMPLIFY = 1.5  # poenostavitev tlorisov (m)
VRSTE = {"vrtec": 1, "sola": 2, "bolnisnica": 3, "zdravstveni_dom": 4, "dom_za_starejse": 5}
# raba stavbe v katastru (prevladujoca_raba_id) -> skupina in privzeta vrsta
RABA = {43: ("izobrazevanje", "sola"), 24: ("izobrazevanje", "sola"), 44: ("zdravje", "bolnisnica"), 25: ("zdravje", "zdravstveni_dom")}
SKUPINA = {"vrtec": "izobrazevanje", "sola": "izobrazevanje", "bolnisnica": "zdravje", "zdravstveni_dom": "zdravje",
           "dom_za_starejse": "zdravje"}


def main() -> None:
    import geopandas as gpd
    import pyogrio
    import rasterio
    from rasterio.warp import Resampling, reproject
    from shapely.geometry import MultiPolygon

    OUT.mkdir(parents=True, exist_ok=True)

    # --- meja MOL in izhodišče ---
    mol = gpd.read_file(SRC / "mol_meja.geojson").to_crs(3794)
    e0, n0, e1, n1 = mol.total_bounds
    ox, oy = round((e0 + e1) / 2), round((n0 + n1) / 2)
    me0, mn0 = np.floor((e0 - MARGIN) / CELL) * CELL, np.floor((n0 - MARGIN) / CELL) * CELL
    me1, mn1 = np.ceil((e1 + MARGIN) / CELL) * CELL, np.ceil((n1 + MARGIN) / CELL) * CELL
    cols, rows = int((me1 - me0) / CELL) + 1, int((mn1 - mn0) / CELL) + 1

    # --- teren: DEM (WGS84, 30 m) -> mreža D96/TM 100 m ---
    dst = np.zeros((rows, cols), dtype="float32")
    with rasterio.open(SRC / "dem_lj_kotlina_30m.tif") as ds:
        src = ds.read(1).astype("float32")
        src[src == ds.nodata] = np.nan
        transform = rasterio.Affine(CELL, 0, me0 - CELL / 2, 0, -CELL, mn1 + CELL / 2)
        reproject(src, dst, src_transform=ds.transform, src_crs=ds.crs, src_nodata=np.nan,
                  dst_transform=transform, dst_crs="EPSG:3794", dst_nodata=np.nan, resampling=Resampling.average)
    dst = np.where(np.isfinite(dst), dst, np.nanmin(dst))
    (OUT / "teren.bin").write_bytes(np.round(dst * 10).astype("<u2").tobytes())

    def terrain_at(e: float, n: float) -> float:
        c = int(round((e - me0) / CELL))
        r = int(round((mn1 - n) / CELL))
        return float(dst[min(max(r, 0), rows - 1), min(max(c, 0), cols - 1)])

    # meja MOL kot poenostavljena črta
    outline = mol.geometry.iloc[0].simplify(60)
    if isinstance(outline, MultiPolygon):
        outline = max(outline.geoms, key=lambda g: g.area)
    meja = [[round(x - ox), round(y - oy)] for x, y in outline.exterior.coords]

    # merilne postaje ARSO
    post = json.loads((STATIC_DATA_DIR / "arso_lj_postaje.geojson").read_text(encoding="utf-8"))
    postaje = [
        {
            "id": f["properties"]["station_code"],
            "ime": f["properties"]["station_name"].replace("LJ ", ""),
            "x": round(f["properties"]["d96_e"] - ox),
            "y": round(f["properties"]["d96_n"] - oy),
        }
        for f in post["features"]
    ]

    (OUT / "teren.json").write_text(json.dumps({
        "vir": "Copernicus DEM GLO-30 (© DLR / Airbus, EU/ESA); GURS Kataster nepremičnin; © OpenStreetMap contributors; MOL",
        "crs": "EPSG:3794",
        "izhodisce": [ox, oy],
        "celica": CELL,
        "stolpci": cols,
        "vrstice": rows,
        "zahod": me0 - ox,  # x prvega stolpca
        "sever": mn1 - oy,  # y prve vrstice
        "zMin": round(float(dst.min()), 1),
        "zMax": round(float(dst.max()), 1),
        "dno": DNO,
        "meja": meja,
        "postaje": postaje,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # --- stavbe MOL ---
    st = pyogrio.read_dataframe(SRC / "kn_stavbe.gpkg", layer="stavbe_tlorisi", where="obcina_sifra='061'",
                                columns=["stevilo_etaz", "visina_h1", "visina_h3", "prevladujoca_raba_id"])
    st = st.reset_index(drop=True)
    vrsta = np.zeros(len(st), dtype=int)

    # katere stavbe so vrtci, šole, bolnišnice ...: točka OSM v stavbi ali najbližja stavba do 40 m
    osm = gpd.read_file(SRC / "osm_obcutljive_lokacije.geojson").to_crs(3794)
    tocke = osm[["kategorija", "geometry"]]
    v = gpd.sjoin(tocke, st[["geometry"]], predicate="within", how="inner")
    for kat, idx in zip(v.kategorija, v.index_right):
        vrsta[idx] = VRSTE[kat]
    ostale = tocke.drop(index=v.index.unique())
    bl = gpd.sjoin_nearest(ostale, st[["geometry"]], max_distance=40, how="inner")
    for kat, idx in zip(bl.kategorija, bl.index_right):
        if vrsta[idx] == 0:
            vrsta[idx] = VRSTE[kat]
    # ostale stavbe z izobraževalno ali zdravstveno rabo: vrsta najbližje lokacije iste skupine (do 200 m), sicer privzeta
    raba = st[(vrsta == 0) & st.prevladujoca_raba_id.isin(list(RABA))]
    for skupina in ("izobrazevanje", "zdravje"):
        sub = raba[raba.prevladujoca_raba_id.map(lambda r: RABA[int(r)][0]) == skupina]
        pts = tocke[tocke.kategorija.map(SKUPINA) == skupina]
        if sub.empty:
            continue
        nn = gpd.sjoin_nearest(sub[["prevladujoca_raba_id", "geometry"]], pts, max_distance=200, how="left")
        nn = nn[~nn.index.duplicated()]
        for idx, r, kat in zip(nn.index, nn.prevladujoca_raba_id, nn.kategorija):
            vrsta[idx] = VRSTE[kat] if isinstance(kat, str) else VRSTE[RABA[int(r)][1]]

    out: list[int] = []
    n_st = 0
    n_obc = 0
    for geom, etaze, h1, h3, vr in zip(st.geometry, st.stevilo_etaz, st.visina_h1, st.visina_h3, vrsta):
        if geom is None or geom.is_empty:
            continue
        poly = max(geom.geoms, key=lambda g: g.area) if geom.geom_type == "MultiPolygon" else geom
        if poly.area < MIN_AREA:
            continue
        poly = poly.simplify(SIMPLIFY)
        if poly.is_empty or poly.geom_type != "Polygon":
            continue
        ring = list(poly.exterior.coords)[:-1]
        if len(ring) < 3 or len(ring) > 400:
            continue
        # višina: iz višin KN (H3 - H1), sicer iz števila etaž
        h = None
        if h1 and h3 and h1 > 0 and 2 < h3 - h1 < 150:
            h = h3 - h1
        if h is None:
            h = (etaze if etaze and 0 < etaze < 60 else 1) * 3.0 + 1.0
        out.append(len(ring))
        out.append(int(round(h * 10)))
        out.append(int(vr))
        n_obc += int(vr > 0)
        for x, y in ring:
            out.append(int(round((x - ox) / UNIT)))
            out.append(int(round((y - oy) / UNIT)))
        n_st += 1
    (OUT / "stavbe.bin").write_bytes(np.array(out, dtype="<i2").tobytes())

    # --- občutljive lokacije ---
    lok = []
    for _, r in osm.iterrows():
        e, n = r.geometry.x, r.geometry.y
        if not (me0 <= e <= me1 and mn0 <= n <= mn1):
            continue
        z = terrain_at(e, n)
        lok.append({
            "ime": (r.ime or "").strip() or None,
            "kat": r.kategorija,
            "naslov": (r.naslov or "").strip() or None,
            "x": round(e - ox),
            "y": round(n - oy),
            "z": round(z),
            "nadDnom": round(z - DNO),
        })
    (OUT / "lokacije.json").write_text(json.dumps(lok, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"Teren {cols}×{rows} celic po {CELL:.0f} m, {n_st} stavb ({n_obc} občutljivih), {len(lok)} lokacij → {OUT}")


if __name__ == "__main__":
    main()
