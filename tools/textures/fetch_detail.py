"""Detail layers of the toon shader from Poly Haven (ADR-0092).

Downloads each layer's 1K diffuse map (CC0, md5 checked) into a scratch directory, keeps its
luminance with the low frequencies taken out (the palette gives the colour and the shading the
light), normalises it round 0.5 and packs four layers into one RGBA PNG under
`packages/app/public/textures/`. It also writes `layers.json` there: each layer's file, channel and
tile size in metres, which the engine's table is checked against.

    python3 -I tools/textures/fetch_detail.py <scratch dir>

Network only with the User-Agent below; no retry after HTTP 429. The downloads are data: this
script reads them, nothing in them is run.
"""

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request

import numpy as np
from PIL import Image

UA = "SekiSenshi-topo/1.0"
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPEC = os.path.join(ROOT, "tools", "textures", "detail-layers.json")
OUT = os.path.join(ROOT, "packages", "app", "public", "textures")


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code == 429:
            sys.exit(f"429 from {url}: stopping, no retry")
        raise


def fetch(asset: str, scratch: str) -> tuple[str, float]:
    """The asset's diffuse JPEG on disk and the side of its tile in metres."""
    info = json.loads(get(f"https://api.polyhaven.com/info/{asset}"))
    files = json.loads(get(f"https://api.polyhaven.com/files/{asset}"))
    jpg = files["Diffuse"]["1k"]["jpg"]
    path = os.path.join(scratch, f"{asset}_diff_1k.jpg")
    if not os.path.exists(path) or hashlib.md5(open(path, "rb").read()).hexdigest() != jpg["md5"]:
        data = get(jpg["url"])
        if hashlib.md5(data).hexdigest() != jpg["md5"]:
            sys.exit(f"md5 mismatch for {asset}")
        with open(path, "wb") as f:
            f.write(data)
        time.sleep(1)
    dims = info.get("dimensions") or [2000, 2000]
    return path, round(float(dims[0]) / 1000.0, 3)


def box_blur_wrap(a: np.ndarray, r: int) -> np.ndarray:
    """A box blur of radius r that wraps round the edges (the textures tile)."""
    k = 2 * r + 1
    c = np.cumsum(np.concatenate([a[:, -r - 1 :], a, a[:, :r]], axis=1), axis=1)
    a = (c[:, k:] - c[:, :-k]) / k
    c = np.cumsum(np.concatenate([a[-r - 1 :, :], a, a[:r, :]], axis=0), axis=0)
    return (c[k:, :] - c[:-k, :]) / k


def layer(path: str, size: int) -> np.ndarray:
    """Luminance with its large blotches taken out, round 0.5, as bytes of size × size."""
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722])
    n = lum.shape[0]
    low = lum
    for _ in range(3):
        low = box_blur_wrap(low, max(2, n // 16))
    hi = lum - low
    hi = hi / (4.0 * max(hi.std(), 1e-4))
    d = np.clip(0.5 + hi, 0.0, 1.0)
    img = Image.fromarray((d * 255.0 + 0.5).astype(np.uint8), "L").resize((size, size), Image.Resampling.LANCZOS)
    return np.asarray(img)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    scratch = sys.argv[1]
    os.makedirs(scratch, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    spec = json.load(open(SPEC))
    size = int(spec["size"])
    table = {}
    for name, assets in spec["textures"].items():
        planes = []
        for ch, asset in enumerate(assets):
            path, metres = fetch(asset, scratch)
            planes.append(layer(path, size))
            table[asset] = {"file": f"textures/detail-{name}.png", "channel": "rgba"[ch], "metres": metres}
        while len(planes) < 4:
            planes.append(np.full((size, size), 128, np.uint8))
        Image.fromarray(np.stack(planes, axis=-1), "RGBA").save(os.path.join(OUT, f"detail-{name}.png"), optimize=True)
        print(f"detail-{name}.png: {', '.join(assets)}")
    with open(os.path.join(OUT, "layers.json"), "w") as f:
        json.dump(table, f, indent=2, sort_keys=True)
        f.write("\n")


if __name__ == "__main__":
    main()
