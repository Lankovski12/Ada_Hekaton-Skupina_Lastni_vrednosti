"""Prenese satelitsko sliko območja igre in jo shrani kot teksturo terena.

Zagon (v mapi backend/, na računalniku z internetom):
    python scripts/download_satelit.py

Vir: Sentinel-2 cloudless (EOX IT Services GmbH), ~10 m na piksel, brez oblakov.
Licenca: s2cloudless 2016 je CC BY 4.0; novejši letniki (2018+) so CC BY-NC-SA 4.0 (nekomercialno, kar hekaton je).
Navedba: "Sentinel-2 cloudless – https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data)".

Izhod: frontend/public/assets/terrain/satelit.jpg (igra jo naloži sama; če je ni, uporabi barve iz podatkov).
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import REPO_DIR  # noqa: E402

TERRAIN = REPO_DIR / "frontend" / "public" / "assets" / "terrain"
WMS = "https://tiles.maps.eox.at/wms"
# poskusimo od najnovejšega letnika proti starejšim
LAYERS = ["s2cloudless-2024", "s2cloudless-2023", "s2cloudless-2022", "s2cloudless-2021", "s2cloudless-2020", "s2cloudless"]
WIDTH = 4096


def main() -> None:
    meta = json.loads((TERRAIN / "teren.json").read_text(encoding="utf-8"))
    (lon0, lon1), (lat0, lat1) = meta["lon"], meta["lat"]
    height = round(WIDTH * meta["visina_m"] / meta["sirina_m"])
    for layer in LAYERS:
        params = {
            "service": "WMS", "request": "GetMap", "version": "1.1.1", "layers": layer, "styles": "",
            "srs": "EPSG:4326", "bbox": f"{lon0},{lat0},{lon1},{lat1}",
            "width": WIDTH, "height": height, "format": "image/jpeg",
        }
        url = f"{WMS}?{urllib.parse.urlencode(params)}"
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                data = r.read()
                if not r.headers.get("Content-Type", "").startswith("image/"):
                    print(f"{layer}: strežnik ni vrnil slike, poskušam naslednji letnik")
                    continue
        except Exception as e:  # noqa: BLE001
            print(f"{layer}: {e}")
            continue
        out = TERRAIN / "satelit.jpg"
        out.write_bytes(data)
        (TERRAIN / "satelit.txt").write_text(
            f"Sentinel-2 cloudless ({layer}) – https://s2maps.eu by EOX IT Services GmbH "
            "(Contains modified Copernicus Sentinel data)\n",
            encoding="utf-8",
        )
        print(f"Shranjeno: {out} ({WIDTH}×{height}, {len(data) // 1024} KB, sloj {layer})")
        return
    raise SystemExit("Satelitske slike ni bilo mogoče prenesti.")


if __name__ == "__main__":
    main()
