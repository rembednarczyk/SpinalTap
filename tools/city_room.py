"""The capsule room of ADR-0063 stage 3 in packages/app/public/city/room-props.glb, on the city kit's swatch palette
like the other props files (the engine loads it after them and merges them, `mergeCityProps`).

Source: igor.tesV's Futuristic Compact Room (CC-BY 4.0, the user's pack of ADR-0063): a corner of a small flat, two
walls (the back one with the bed alcove under the wall cabinets, a side one with the kitchen run) and a floor, open on
the other two sides and above, 1 unit = 0.2 m (the kitchen counter 0.9 m over the floor). Here it is
- cut down to the room: the window pod outside its side wall (a window into the neighbour's flat once the room
  stands in a tenement, ADR-0061) and the plates under its floor go;
- coloured per triangle from the mean texel of its textures: emissive texels as the nearest neon (the blue strip,
  the warm lamps), the rest by hue and value (`room_role`);
- simplified by vertex clustering to `TARGET_TRIS` (the interior's budget, `MAX_TRIS`), specks left out; the
  self-lit strips and screens keep their triangles (a clustering grid would close them);
- scaled to metres with its open side (where the game puts the door) to +Z, the floor on y = 0 and the room's
  floor centred on X/Z.
The walls the source leaves open, the ceiling and the front wall with the door are the game's: the simulation's
solids (`packages/sim/src/content/capsule-room.ts`), drawn by the engine next to this model.

Node `extras`: {"size", "styles": ["room-capsule"], "credit": source id, "floor": [x0, z0, x1, z1] the room's floor}.

Usage: python3 -I tools/city_kit.py --room DIR --out DIR (DIR as filled by tools/assets/fetch.mjs).
"""
import os, zlib
import numpy as np
from city_ccby import flat_normals, simplify, weld
from city_kit_gltf import png_bytes, scene_triangles, write_glb
from city_kit_palette import GRID, SW, SWATCHES, hsv, palette_images, swatch_uv
from city_props import material_image, nearest_neon, texel_mean
from city_street_e2 import drop_specks

SOURCE = ('sketchfab-futuristic-compact-room', 'futuristic_compact_room.glb')
KEY = 'room-capsule'

# Source units to metres, and the source's floor (its tiles' top) and the inner face of its side wall.
SCALE = 0.2
FLOOR = 2.7
SIDE_WALL = -9.15
# An interior's budget (ADR-0063): the room is one mesh seen from inside, a building's worth of triangles at most.
TARGET_TRIS = 6000
MAX_TRIS = 8000


def room_role(rgb):
    """A flat's colours: light greys and blue-greys are its panels, the rest by hue."""
    h, s, v = hsv(tuple(rgb))
    hd = h * 360
    if s < 0.22:
        return 'ac' if v > 0.62 else 'trim-light' if v > 0.42 else 'metal' if v > 0.28 else 'trim' if v > 0.14 else 'dark'
    if 170 <= hd < 250:
        return 'ac' if v > 0.62 and s < 0.35 else 'glass-blue' if v < 0.45 else 'fabric-teal'
    if 70 <= hd < 170:
        return 'plant' if v < 0.45 else 'fabric-teal'
    if 25 <= hd < 70:
        return 'fabric-amber'
    if hd >= 330 or hd < 25:
        return 'brick' if v < 0.45 else 'fabric-magenta'
    return 'fabric-magenta'


def source_roles(path):
    """Triangles of the room in source units and their roles."""
    P, _, mat, uv, j, blob = scene_triangles(path)
    mats = j.get('materials', [])
    folder = os.path.dirname(path)
    images = {}
    roles = []
    for t in range(len(P)):
        mi = int(mat[t])
        m = mats[mi] if mi >= 0 else {}
        if mi not in images:
            images[mi] = (material_image(j, blob, m, folder, 'base'), material_image(j, blob, m, folder, 'emissive'))
        base, em = images[mi]
        bad = np.isnan(uv[t]).any()
        if em is not None and not bad:
            e = texel_mean(em, uv[t]) * np.array(m.get('emissiveFactor', [1, 1, 1]))
            if e.max() > 0.2:
                roles.append(nearest_neon(e))
                continue
        if base is not None and not bad:
            rgb = texel_mean(base, uv[t])
        else:
            rgb = np.array(m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [0.5, 0.5, 0.5, 1])[:3])
        roles.append(room_role(rgb))
    return P, roles


def crop(P, roles):
    """The room alone: no triangle whose centre lies outside its side wall, none wholly under its floor, and
    the walls cut at the floor (the plates under it go)."""
    c = P.mean(1)
    keep = (c[:, 0] >= SIDE_WALL) & (P[:, :, 1].max(1) > FLOOR + 0.01)
    P = P[keep].copy()
    P[:, :, 1] = np.maximum(P[:, :, 1], FLOOR)
    return P, [r for r, k in zip(roles, keep) if k]


def to_metres(P):
    """Metres, the floor on y = 0, the room's floor centred on X/Z (the open side stays at +Z)."""
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    centre = np.array([(lo[0] + hi[0]) / 2, FLOOR, (lo[2] + hi[2]) / 2])
    return (P - centre) * SCALE


def build_room(folder, out_dir):
    P, roles = source_roles(os.path.join(folder, *SOURCE))
    P, roles = crop(P, roles)
    P = to_metres(P)
    # The lights are thin strips a clustering grid would close: they keep their triangles.
    lit = np.array([SWATCHES[SW[r]][2] == 'glow' for r in roles])
    Q, rest = drop_specks(*simplify(P[~lit], [r for r, g in zip(roles, lit) if not g], TARGET_TRIS - int(lit.sum())))
    P = np.concatenate([Q, P[lit]])
    roles = list(rest) + [r for r, g in zip(roles, lit) if g]
    m = weld(KEY, P, flat_normals(P), roles, swatch_uv, MAX_TRIS)
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    size = [round(float(x), 3) for x in hi - lo]
    floor = [round(float(lo[0]), 3), round(float(lo[2]), 3), round(float(hi[0]), 3), round(float(hi[2]), 3)]
    extras = {KEY: {'size': size, 'styles': [KEY], 'credit': SOURCE[0], 'floor': floor}}
    print(f"{KEY:16s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {size} roles {','.join(sorted(set(roles)))}")
    albedo, glow = palette_images()
    dst = os.path.join(out_dir, 'room-props.glb')
    write_glb([m], png_bytes(albedo), png_bytes(glow), dst, extras, SWATCHES, GRID)
    print(dst, f'{os.path.getsize(dst) // 1024} KB', 'crc', format(zlib.crc32(open(dst, 'rb').read()), '08x'))
