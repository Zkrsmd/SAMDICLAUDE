"""Second-pass background removal with rembg for product images whose background the
simple edge key in build-catalog.mjs could not remove (gradients, vignettes, lifestyle shots).
Run with the local tools venv:  .venv-tools/Scripts/python scripts/cutout-rembg.py
"""
import glob
import os
import sys

from PIL import Image
from rembg import new_session, remove

OUT = "public/products"
CACHE = "media-src/img"


def opaque_corners(path: str) -> bool:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    pts = [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2), (w // 2, 1), (w // 2, h - 2)]
    return sum(im.getpixel(p)[3] > 200 for p in pts) >= 4


def main() -> None:
    session = new_session(os.environ.get("REMBG_MODEL", "isnet-general-use"))
    only = os.environ.get("ONLY")  # e.g. ONLY=adidas- forces a re-cut of those files (soft floor shadows)
    files = sorted(glob.glob(f"{OUT}/*.webp"))
    targets = [p for p in files if os.path.basename(p).startswith(only)] if only else [p for p in files if opaque_corners(p)]
    print(f"{len(targets)} images need AI cut-out", flush=True)
    for i, out in enumerate(targets, 1):
        base = os.path.basename(out)[: -len(".webp")]
        src = next(iter(glob.glob(f"{CACHE}/{base}.*")), None)
        if not src:
            continue
        im = Image.open(src).convert("RGB")
        im.thumbnail((1400, 1400))
        cut = remove(im, session=session, post_process_mask=True)
        bbox = cut.getbbox()
        if bbox:
            cut = cut.crop(bbox)
        cut.save(out, "WEBP", quality=86)
        print(f"[{i}/{len(targets)}] {base}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
