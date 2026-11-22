"""Podatki za »Izberi svojo šolo ali vrtec« na zavihku Zemljevid.

Zagon (v mapi backend/, po zemljevid_3d.py in zemljevid_dnevi.py):
    python scripts/download_training_data.py
    python scripts/zemljevid_sole.py

Vhod:
    frontend/public/assets/map/lokacije.json        šole in vrtci z lego (zemljevid_3d.py)
    frontend/public/assets/map/dnevi.json           megla (višina hladne plasti) vsako jutro (zemljevid_dnevi.py)
    data/ARSOhack/02_modeli/gral/gral_kurisca_statistika_15m.tif   MODEL ARSO GRAL: prispevek malih kurišč (leto 2021)
    data/ARSOhack/02_modeli/gral/gral_promet_statistika_15m.tif    MODEL ARSO GRAL: osebna vozila (samo relativno!)
    data/ARSOhack/04_prostor/mol_cetrtne_skupnosti.geojson         četrtne skupnosti MOL
Izhod:
    frontend/public/assets/map/sole.json

Za vsako šolo in vrtec vzamemo povprečje veljavnih celic GRAL v krogu 100 m (ne ene same celice 15 m), ker
ARSO zaradi varstva podatkov izloči celice z malo stavbami (NaN) in ker otroci niso samo v eni točki.
Promet ima po README ARSO vsaj 10-krat previsoko lestvico, zato shranimo samo razmerje do povprečne šole.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import REPO_DIR, TRAINING_DATA_DIR  # noqa: E402

MAP = REPO_DIR / "frontend" / "public" / "assets" / "map"
GRAL = TRAINING_DATA_DIR / "02_modeli" / "gral"
CS = TRAINING_DATA_DIR / "04_prostor" / "mol_cetrtne_skupnosti.geojson"
POLMER = 100.0  # m
POLMER_SIRSE = 300.0  # m, če v 100 m ni veljavnih celic (izločene zaradi varstva podatkov)
ZIMA = {11, 12, 1, 2}


def main() -> None:
    import rasterio
    from pyproj import Transformer
    from shapely.geometry import Point, shape
    from shapely.ops import transform

    teren = json.loads((MAP / "teren.json").read_text(encoding="utf-8"))
    ox, oy = teren["izhodisce"]
    lok = json.loads((MAP / "lokacije.json").read_text(encoding="utf-8"))
    dnevi = json.loads((MAP / "dnevi.json").read_text(encoding="utf-8"))

    # zimska jutra z znano višino hladne plasti (radiosondaža)
    od = np.datetime64(dnevi["od"])
    meseci = [int(str(od + np.timedelta64(i, "D"))[5:7]) for i in range(len(dnevi["megla"]))]
    megle = np.array([m for m, mes in zip(dnevi["megla"], meseci) if mes in ZIMA and m is not None], dtype=float)

    gj = json.loads(CS.read_text(encoding="utf-8"))
    src = int(gj.get("crs", {}).get("properties", {}).get("name", "EPSG:4326").split(":")[-1].replace("CRS84", "4326"))
    v_d96 = Transformer.from_crs(src, 3794, always_xy=True).transform
    cs = [
        (f["properties"]["cs_ime"].replace("ČETRTNA SKUPNOST", "").strip().title(), transform(v_d96, shape(f["geometry"])))
        for f in gj["features"]
    ]
    to_utm = Transformer.from_crs(3794, 32633, always_xy=True)

    def okolica(path: Path, pasovi: list[int], pts: list[tuple[float, float]], polmer: float) -> np.ndarray:
        """povprečje veljavnih celic v krogu polmer okoli vsake točke; NaN, če ni nobene"""
        out = np.full((len(pts), len(pasovi)), np.nan)
        with rasterio.open(path) as r:
            data = r.read(pasovi)  # (pasovi, vrstice, stolpci)
            inv = ~r.transform
            k = int(np.ceil(polmer / r.res[0]))
            yy, xx = np.mgrid[-k : k + 1, -k : k + 1]
            maska = (xx * r.res[0]) ** 2 + (yy * r.res[1]) ** 2 <= polmer**2
            for i, (e, n) in enumerate(pts):
                c, rr = inv * (e, n)
                c, rr = int(c), int(rr)
                if not (k <= rr < r.height - k and k <= c < r.width - k):
                    continue
                okno = data[:, rr - k : rr + k + 1, c - k : c + k + 1][:, maska]
                if np.isfinite(okno[0]).sum() >= 3:
                    out[i] = np.nanmean(okno, axis=1)
        return out

    # samo šole in vrtci, ki jih lahko starš prepozna (ime, ki ni samo »Vrtec«, ali naslov); brez podvojenih
    sole, videno = [], set()
    for i, l in enumerate(lok):
        ime = (l["ime"] or "").strip()
        if l["kat"] not in ("sola", "vrtec") or (ime.lower() in ("", "vrtec", "šola", "sola") and not l["naslov"]):
            continue
        kljuc = (ime.lower(), round(l["x"] / 100), round(l["y"] / 100))
        if kljuc in videno:
            continue
        videno.add(kljuc)
        sole.append((i, l))
    d96 = [(l["x"] + ox, l["y"] + oy) for _, l in sole]
    utm = [to_utm.transform(e, n) for e, n in d96]
    # kurišča: januar, večer jan–feb, ure nad 25 µg/m³; promet: letno povprečje (samo relativno)
    kur = okolica(GRAL / "gral_kurisca_statistika_15m.tif", [3, 4, 7], utm, POLMER)
    sirse = okolica(GRAL / "gral_kurisca_statistika_15m.tif", [3, 4, 7], utm, POLMER_SIRSE)
    sirsa = ~np.isfinite(kur[:, 0]) & np.isfinite(sirse[:, 0])
    kur[sirsa] = sirse[sirsa]
    pro = okolica(GRAL / "gral_promet_statistika_15m.tif", [1], utm, POLMER)[:, 0]

    jan = kur[:, 0]
    veljavni = np.isfinite(jan)
    pro_povp = np.nanmean(pro)

    def rang(v: float, vse: np.ndarray) -> float:
        """delež šol in vrtcev z MANJŠO vrednostjo (0 = najmanj izpostavljena, 1 = najbolj)"""
        vse = vse[np.isfinite(vse)]
        return round(float((vse < v).mean()), 3)

    out = []
    for k, (i, l) in enumerate(sole):
        p = Point(*d96[k])
        hit = [ime for ime, g in cs if g.contains(p)]
        zapis = {
            "id": i,  # indeks v lokacije.json (za bucike na zemljevidu)
            "ime": l["ime"] or (("Vrtec" if l["kat"] == "vrtec" else "Šola") + (f", {l['naslov']}" if l["naslov"] else "")),
            "kat": l["kat"],
            "naslov": l["naslov"],
            "x": l["x"],
            "y": l["y"],
            "nadDnom": l["nadDnom"],
            "cs": hit[0] if hit else None,
            # delež zimskih jutr (nov–feb), ko je bila lega pod plastjo hladnega zraka
            "podMeglo": round(float((megle >= max(l["nadDnom"], 1)).mean()), 3) if len(megle) else None,
        }
        if veljavni[k]:
            zapis["kurisca"] = {
                "januar": round(float(kur[k, 0]), 1),
                "vecer": round(float(kur[k, 1]), 1),
                "urNad25": int(round(float(kur[k, 2]))),
                "rang": rang(kur[k, 0], jan),
                "polmer": int(POLMER_SIRSE if sirsa[k] else POLMER),
            }
        if np.isfinite(pro[k]):
            zapis["promet"] = {"relativno": round(float(pro[k] / pro_povp), 2), "rang": rang(pro[k], pro)}
        out.append(zapis)

    out.sort(key=lambda s: s["ime"].lower())
    meta = {
        "vir": "ARSO: model GRAL (prispevek malih kurišč in osebnih vozil, leto 2021, 15 m), radiosondaža NOAA IGRA2, "
        "relief Copernicus DEM, © OpenStreetMap contributors; paket ARSOhack",
        "polmer_m": POLMER,
        "zimskihJuter": int(len(megle)),
        "kurisca": {
            "januarMediana": round(float(np.nanmedian(jan)), 1),
            "januarMax": round(float(np.nanmax(jan)), 1),
        },
        "sole": out,
    }
    (MAP / "sole.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(out)} šol in vrtcev, {int(veljavni.sum())} z vrednostjo GRAL kurišča, "
          f"{int(np.isfinite(pro).sum())} s prometom, {len(megle)} zimskih jutr → {MAP / 'sole.json'}")


if __name__ == "__main__":
    main()
