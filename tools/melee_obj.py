"""Melee weapon OBJs for the game from Quaternius' "Low poly medieval weapons" (CC0).

  python3 -I tools/melee_obj.py PACK_DIR OUT_DIR
  python3 tools/obj2glb.py OUT_DIR/baton.obj packages/app/public/weapons/baton.glb 0.53 --vertex-colors
  python3 tools/obj2glb.py OUT_DIR/blade.obj packages/app/public/weapons/blade.glb 0.8 --vertex-colors

PACK_DIR is the unzipped pack (the `MedievalPack` folder of `tools/assets/fetch.mjs DIR --only
quaternius-medieval-weapons`). The pack colours its models through tiny palette textures; each
face takes the texel under its UV centre and becomes a flat-coloured face of an OBJ with one MTL
colour per palette entry, which obj2glb bakes into vertex colours. The OBJs come out in the
weapon file frame of the game (weapon-mount.ts): the tip along +X, the back (spine) up along +Y.

* baton (telescopic baton): the Club. Its spikes fold flat into the shaft, the shaft gets the
  stepped profile of a telescopic baton (grip, two segments, tip cap) and steel and rubber colours.
* blade (shirasaya): the Katana, recoloured to a plain wooden mount (pale grip, dark collar).

Nothing in the pack is executed: the OBJ and PNG files are read as data.
"""
import math
import os
import sys
import zlib


def read_png_rgb(path):
    """Palette textures are small 8-bit RGB(A) PNGs; this reads them without third-party code."""
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', path
    pos, idat, w, h, ctype = 8, b'', 0, 0, 0
    while pos < len(data):
        n = int.from_bytes(data[pos:pos + 4], 'big')
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + n]
        pos += 12 + n
        if kind == b'IHDR':
            w, h = int.from_bytes(body[0:4], 'big'), int.from_bytes(body[4:8], 'big')
            assert body[8] == 8 and body[12] == 0, 'only 8-bit, non-interlaced PNGs'
            ctype = body[9]
        elif kind == b'IDAT':
            idat += body
    bpp = {2: 3, 6: 4}[ctype]
    raw = zlib.decompress(idat)
    rows, prev, i = [], bytearray(w * bpp), 0
    for _ in range(h):
        f = raw[i]
        line = bytearray(raw[i + 1:i + 1 + w * bpp])
        i += 1 + w * bpp
        for x in range(len(line)):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append([tuple(line[x * bpp:x * bpp + 3]) for x in range(w)])
        prev = line
    return rows


def read_obj(path, texture):
    """Vertices and faces, each face with the palette colour under its UV centre."""
    tex = read_png_rgb(texture)
    h, w = len(tex), len(tex[0])
    V, T, F = [], [], []
    for line in open(path, encoding='utf-8', errors='replace'):
        p = line.split()
        if not p: continue
        if p[0] == 'v': V.append([float(c) for c in p[1:4]])
        elif p[0] == 'vt': T.append([float(c) for c in p[1:3]])
        elif p[0] == 'f':
            idx = [[int(c) if c else 0 for c in t.split('/')] for t in p[1:]]
            u = sum(T[t[1] - 1][0] for t in idx) / len(idx)
            v = sum(T[t[1] - 1][1] for t in idx) / len(idx)
            col = tex[min(h - 1, max(0, int((1 - v) * h)))][min(w - 1, max(0, int(u * w)))]
            F.append(([t[0] - 1 for t in idx], col))
    return V, F


def write_obj(path, V, F, colours):
    """OBJ + MTL, one material per colour name; `colours` maps a name to linear-ish 0..255 RGB."""
    base = os.path.splitext(path)[0]
    with open(base + '.mtl', 'w') as m:
        for name, c in colours.items():
            m.write(f'newmtl {name}\nKd {c[0] / 255:.4f} {c[1] / 255:.4f} {c[2] / 255:.4f}\n')
    with open(path, 'w') as o:
        o.write(f'mtllib {os.path.basename(base)}.mtl\n')
        for v in V: o.write(f'v {v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n')
        for name in colours:
            o.write(f'usemtl {name}\n')
            for idx, col in F:
                if col == name: o.write('f ' + ' '.join(str(i + 1) for i in idx) + '\n')


def frame(V, axes):
    """Re-axes the vertices: `axes[k]` is (source axis, sign) of the output axis k."""
    return [[v[a] * s for a, s in axes] for v in V]


# Club: long axis +Y (head up). Radii of the telescopic profile per height, in club units.
BATON_GRIP_END = 0.75
BATON_PROFILE = [(0.75, 0.098), (1.9, 0.084), (2.0, 0.07), (2.44, 0.07), (2.54, 0.058), (2.9, 0.058)]
BATON_COLOURS = {'rubber': (28, 28, 30), 'steel': (92, 96, 104), 'cap': (150, 154, 160)}


def baton(pack, out):
    V, F = read_obj(os.path.join(pack, 'OBJ', 'Club.obj'), os.path.join(pack, 'Blends', 'Textures', 'ClubTexture.png'))
    # The shaft's axis: the centre of the grip rings.
    cx = sum(v[0] for v in V if v[1] < BATON_GRIP_END) / max(1, sum(1 for v in V if v[1] < BATON_GRIP_END))
    cz = sum(v[2] for v in V if v[1] < BATON_GRIP_END) / max(1, sum(1 for v in V if v[1] < BATON_GRIP_END))

    def radius_at(y):
        for (y0, r0), (y1, r1) in zip(BATON_PROFILE, BATON_PROFILE[1:]):
            if y0 <= y <= y1: return r0 + (r1 - r0) * (y - y0) / max(1e-9, y1 - y0)
        return None

    for v in V:
        dx, dz = v[0] - cx, v[2] - cz
        r = math.hypot(dx, dz) or 1.0
        if v[1] < BATON_GRIP_END:
            k = 0.82  # the grip keeps its rings, a little slimmer
        elif v[1] > BATON_PROFILE[-1][0]:
            k = 0.3  # the rounded cap of the tip
        else:
            k = radius_at(v[1]) / r  # every vertex of the head, spikes too, onto the profile
        v[0], v[2] = cx + dx * k, cz + dz * k
    faces = []
    for idx, _ in F:
        y = sum(V[i][1] for i in idx) / len(idx)
        faces.append((idx, 'rubber' if y < BATON_GRIP_END else 'cap' if y > BATON_PROFILE[-1][0] else 'steel'))
    # Tip (head) along +X, the club's Z up.
    write_obj(os.path.join(out, 'baton.obj'), frame(V, [(1, 1), (2, 1), (0, 1)]), faces, BATON_COLOURS)


# Katana: long axis +Z (tip), the edge on the convex +X side, flat sides facing Y.
BLADE_COLOURS = {'steel': (205, 208, 214), 'wood': (190, 164, 120), 'collar': (62, 64, 70)}
BLADE_SOURCE = {(209, 209, 209): 'steel', (44, 44, 44): 'wood', (210, 200, 0): 'collar'}


def blade(pack, out):
    V, F = read_obj(os.path.join(pack, 'OBJ', 'Katana.obj'), os.path.join(pack, 'Blends', 'Textures', 'KatanaTexture.png'))
    faces = [(idx, BLADE_SOURCE.get(col, 'steel')) for idx, col in F]
    # Tip along +X, the back (spine, on the concave -X side) up along +Y.
    write_obj(os.path.join(out, 'blade.obj'), frame(V, [(2, 1), (0, -1), (1, -1)]), faces, BLADE_COLOURS)


if __name__ == '__main__':
    pack, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    baton(pack, out)
    blade(pack, out)
    print('wrote', os.path.join(out, 'baton.obj'), os.path.join(out, 'blade.obj'))
