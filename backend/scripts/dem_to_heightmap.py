"""Enkratna pretvorba DEM kotline v heightmap.png + teren.json za 3D sceno (TresJS).

Zagon (v mapi backend/):  python scripts/dem_to_heightmap.py
Vhod:  data/ARSOhack/04_prostor/dem_lj_kotlina_30m.tif
Izhod: frontend/public/assets/terrain/heightmap.png, teren.json
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import REPO_DIR, TRAINING_DATA_DIR as DATA_DIR  # noqa: E402

SRC = DATA_DIR / "04_prostor" / "dem_lj_kotlina_30m.tif"
OUT = REPO_DIR / "frontend" / "public" / "assets" / "terrain"


def main() -> None:
    import numpy as np
    import rasterio
    from PIL import Image

    with rasterio.open(SRC) as ds:
        z = ds.read(1).astype("float32")
        bounds = ds.bounds
        crs = str(ds.crs)
    z = np.where(np.isfinite(z), z, np.nanmin(z))
    zmin, zmax = float(z.min()), float(z.max())
    img = ((z - zmin) / (zmax - zmin) * 65535).astype("uint16")

    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(img).save(OUT / "heightmap.png")
    (OUT / "teren.json").write_text(
        json.dumps({"crs": crs, "bounds": list(bounds), "zmin": zmin, "zmax": zmax, "shape": list(z.shape)}, indent=2)
    )
    print(f"Shranjeno v {OUT}")


if __name__ == "__main__":
    main()
