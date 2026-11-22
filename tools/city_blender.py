"""The room detail of ADR-0098 in packages/app/public/city/room-detail*-props.glb (one file a district, each room's
module names it, `FILE`), on the city kit's swatch
palette like the other props files (the engine loads it after them and merges them, `mergeCityProps`).

The models are built by Blender without a window from the scripts in tools/blender/ (`build.py`, one module a
room after its card in docs/pomieszczenia/): their faces' materials are named by the palette's roles. Here each
model's triangles are read off Blender's glTF, its roles turned into the palette's UVs, welded and written with
its node `extras` {"size", "styles": [key]}. Deterministic: the same scripts give the same file.

Usage: python3 tools/city_blender.py OUT_DIR [BLENDER]   (BLENDER defaults to `blender` on the PATH)
"""
import os
import subprocess
import sys
import tempfile
import zlib

import numpy as np
from city_ccby import weld
from city_kit_gltf import png_bytes, scene_triangles, write_glb
from city_kit_palette import GRID, SW, SWATCHES, palette_images, swatch_uv

HERE = os.path.dirname(os.path.abspath(__file__))
MAX_TRIS = 60000


def build(blender):
    out = os.path.join(tempfile.mkdtemp(), 'room-detail.glb')
    run = subprocess.run([blender, '-b', '--factory-startup', '--python', os.path.join(HERE, 'blender', 'build.py'), '--', out],
                         capture_output=True, text=True)
    line = next((l for l in run.stdout.splitlines() if l.startswith('BUILT')), None)
    if run.returncode != 0 or line is None:
        sys.exit(run.stdout[-4000:] + run.stderr[-4000:])
    return out, line.split()[2:]


def bake(path, key):
    P, N, mat, _, j, _ = scene_triangles(path, keep=lambda name: name == key)
    names = [m.get('name', 'trim') for m in j.get('materials', [])]
    roles = [names[i] if 0 <= i < len(names) and names[i] in SW else 'trim' for i in mat]
    flat = P.reshape(-1, 3)
    size = [round(float(v), 3) for v in flat.max(0) - flat.min(0)]
    return P, N, roles, size


def main():
    out_dir = sys.argv[1]
    blender = sys.argv[2] if len(sys.argv) > 2 else 'blender'
    path, pairs = build(blender)
    files = {}
    for pair in pairs:
        key, name = pair.split('=')
        files.setdefault(name, []).append(key)
    albedo, glow = palette_images()
    for name, keys in files.items():
        out, extras = [], {}
        for key in keys:
            P, N, roles, size = bake(path, key)
            m = weld(key, P, N, roles, swatch_uv, MAX_TRIS)
            out.append(m)
            extras[key] = {'size': size, 'styles': [key]}
            print(f"{key:24s} verts {len(m['pos']):6d} tris {len(m['ind']) // 3:6d} size {size} roles {','.join(sorted(set(roles)))}")
        dst = os.path.join(out_dir, name)
        write_glb(out, png_bytes(albedo), png_bytes(glow), dst, extras, SWATCHES, GRID)
        print(dst, f'{os.path.getsize(dst) // 1024} KB', 'crc', format(zlib.crc32(open(dst, 'rb').read()), '08x'))


if __name__ == '__main__':
    main()
