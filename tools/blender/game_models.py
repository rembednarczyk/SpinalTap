"""The game's own models read into the room detail's scripts (ADR-0098, `docs/zasady-lokacji.md` §8: the game's models
before boxes of our own): a model of a baked props file (`packages/app/public/city/*.glb`, written by `tools/city_kit_gltf.py`)
as triangles in the game's frame, each with its palette role read back off its UVs.

Runs inside Blender's Python (json, struct and numpy only). The files are glTF: right-handed, the engine reads them into
its left-handed frame by negating z and turns a model's front to its yaw; a room-detail model goes the other way through
`shapes.Model` (x mirrored). So a triangle of the file at glTF (x, y, z) comes out at the same place as one the scripts
put at game (-x, y, z), and that is the frame these triangles are given in. Each triangle is wound so its corners turn
round its own normal (counter-clockwise seen from outside, numerically), the way `Model.tri` takes them.
"""
import json
import os
import struct
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CITY = os.path.join(HERE, '..', '..', 'packages', 'app', 'public', 'city')

# The palette's roles in swatch order, on its grid of the texture (`tools/city_kit_palette.py`, numpy only).
sys.path.insert(0, os.path.join(HERE, '..'))
from city_kit_palette import GRID, SWATCHES  # noqa: E402

ROLES = [name for name, _, _ in SWATCHES]

_TYPES = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
_WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
_SCALE = {5120: 127.0, 5121: 255.0, 5122: 32767.0, 5123: 65535.0}


def _glb(path):
    data = open(path, 'rb').read()
    jl = struct.unpack('<I', data[12:16])[0]
    j = json.loads(data[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', data[off:off + 4])[0]
    return j, data[off + 8:off + 8 + bl]


def _accessor(j, blob, i):
    a = j['accessors'][i]
    view = j['bufferViews'][a['bufferView']]
    t = _TYPES[a['componentType']]
    n = _WIDTH[a['type']]
    stride = view.get('byteStride', 0)
    start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    item = np.dtype(t).itemsize * n
    if stride and stride != item:
        rows = [np.frombuffer(blob, t, n, start + k * stride) for k in range(a['count'])]
        arr = np.array(rows)
    else:
        arr = np.frombuffer(blob, t, a['count'] * n, start).reshape(a['count'], n)
    arr = arr.astype(np.float64)
    if a.get('normalized'):
        arr = np.maximum(arr / _SCALE[a['componentType']], -1.0)
    return arr


def triangles(file, key):
    """The model `key` of `file` (a node of that name, at the origin) as [((a, b, c), role)] in the game's frame."""
    j, blob = _glb(os.path.join(CITY, file))
    node = next(n for n in j['nodes'] if n.get('name') == key)
    out = []
    for prim in j['meshes'][node['mesh']]['primitives']:
        attrs = prim['attributes']
        pos = _accessor(j, blob, attrs['POSITION'])
        nor = _accessor(j, blob, attrs['NORMAL'])
        uv = _accessor(j, blob, attrs['TEXCOORD_0'])
        idx = _accessor(j, blob, prim['indices']).astype(int).reshape(-1, 3)
        # glTF to the game's frame of the scripts: x mirrored (see above).
        pos = pos * np.array([-1.0, 1.0, 1.0])
        nor = nor * np.array([-1.0, 1.0, 1.0])
        for i0, i1, i2 in idx:
            a, b, c = pos[i0], pos[i1], pos[i2]
            n = nor[i0] + nor[i1] + nor[i2]
            if np.dot(np.cross(b - a, c - a), n) < 0:
                b, c = c, b
            u, v = (uv[i0] + uv[i1] + uv[i2]) / 3
            cell = int(u * GRID) + GRID * int(v * GRID)
            role = ROLES[cell] if 0 <= cell < len(ROLES) else 'trim'
            out.append(((tuple(a), tuple(b), tuple(c)), role))
    return out
