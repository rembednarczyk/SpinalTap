"""Alchemia 2077, the food hall on Plac Ofiar Getta (ADR-0063 stage 4), in packages/app/public/city/alchemia-props.glb, on
the city kit's swatch palette like the other props files (the engine loads it after them and merges them).

Sources (tools/assets/sources.json, the user's pack of ADR-0063, both CC-BY 4.0):
- igor.tesV's Cyberpunk Building: a two-storey block with an outside stair, 1 unit = 0.7 m here (its red door 3.5 m,
  its roof 11.5 m over the ground): the hall, `alchemia-hall`, with the name on its roof;
- Just_Eh's HW 4 Cyberpunk Sci-fi Building: five small shopfronts side by side on their own plinths, 1 unit = 1.25 m
  (a door 2.1 m, 8.9 m to the ridge): the food stalls, `alchemia-stall-1` ... `-5`, one per shopfront (`crop`).
Each model is
- coloured per triangle from the mean texel of its textures: emissive texels as the nearest neon, the rest by hue
  and value (`room_role` of tools/city_room.py: no tinted swatch, the building is drawn as one piece);
- simplified by vertex clustering to a building's budget (ADR-0063: about 8 000 triangles; the stalls take less,
  five of them stand in a row); the self-lit parts keep their triangles up to a share of the budget;
- scaled to metres with its front (the shop window, the hall's door) to +Z, its foot on y = 0 and its bounding box
  centred on X/Z.
The hall gets the name ALCHEMIA in neon tubes on the front of its roof (`name_sign`): a proper name, the same in
every language, so the strokes are geometry here and no text of the game's catalogues.

Node `extras`: {"size", "styles": [key], "credit": source id}.

Usage: python3 -I tools/city_kit.py --alchemia DIR --out DIR (DIR as filled by tools/assets/fetch.mjs).
"""
import os, zlib
import numpy as np
from city_ccby import flat_normals, simplify, weld
from city_kit_gltf import png_bytes, scene_triangles, write_glb
from city_kit_palette import GRID, SW, SWATCHES, hsv, palette_images, swatch_uv
from city_props import material_image, nearest_neon, texel_mean, to_srgb
from city_room import room_role
from city_street_e2 import drop_specks

HALL = ('sketchfab-cyberpunk-building', 'cyberpunk_building.glb')
STALLS = ('sketchfab-hw4-cyberpunk-building', 'hw_4_cyberpunk_sci-fi_building.glb')

# key, source, scale (units to metres), crop (x0, x1) in source units or None, triangle target
MODELS = [
    ('alchemia-hall', HALL, 0.7, None, 3600),
    ('alchemia-stall-1', STALLS, 1.25, (-27.0, -17.5), 1500),
    ('alchemia-stall-2', STALLS, 1.25, (-17.5, -6.0), 1500),
    ('alchemia-stall-3', STALLS, 1.25, (-6.0, 5.5), 1500),
    ('alchemia-stall-4', STALLS, 1.25, (5.5, 17.0), 1500),
    ('alchemia-stall-5', STALLS, 1.25, (17.0, 27.5), 1500),
]
# A building's budget (ADR-0063).
MAX_TRIS = 8000
# The self-lit parts (thin neon tubes, screens) keep their triangles up to this share of the target.
LIT_SHARE = 0.3
# Self-lit glass (a lit shop window: the dimmer glow the kit gives whole walls of it).
GLASS = 'shop-teal'
# A self-lit face larger than this (m²) is a lit window, not a tube.
BIG_LIT = 0.8

# The hall's name on its roof: neon tubes over the front of the roof, metres, in the baked model's frame.
NAME = 'ALCHEMIA'
NAME_NEON = 'neon-cyan'
NAME_BACK = 'sign-back'
LETTER = (0.55, 1.1)     # width, height
GAP = 0.2
TUBE = 0.09
# The flat roof the name stands on at its front edge, source units (x0, x1, top y, front z): the roof falls from there
# to the front of the upper storey, the stair runs past x1.
HALL_ROOF = (-5.81, 2.32, 16.44, 1.27)

# Strokes of the letters on a unit box (x right, y up).
STROKES = {
    'A': [((0, 0), (0.5, 1)), ((0.5, 1), (1, 0)), ((0.22, 0.42), (0.78, 0.42))],
    'L': [((0, 1), (0, 0)), ((0, 0), (1, 0))],
    'C': [((1, 1), (0, 1)), ((0, 1), (0, 0)), ((0, 0), (1, 0))],
    'H': [((0, 0), (0, 1)), ((1, 0), (1, 1)), ((0, 0.5), (1, 0.5))],
    'E': [((1, 1), (0, 1)), ((0, 1), (0, 0)), ((0, 0), (1, 0)), ((0, 0.5), (0.75, 0.5))],
    'M': [((0, 0), (0, 1)), ((0, 1), (0.5, 0.45)), ((0.5, 0.45), (1, 1)), ((1, 1), (1, 0))],
    'I': [((0.5, 0), (0.5, 1)), ((0.2, 0), (0.8, 0)), ((0.2, 1), (0.8, 1))],
}


def lit_role(rgb, area):
    """A self-lit texel: a neon tube or lamp, or on a face of more than `BIG_LIT` m² a lit window in the kit's dimmer
    shop glow (a whole storey of saturated neon would outshine the street's signs)."""
    if area <= BIG_LIT:
        return nearest_neon(rgb)
    hd = hsv(tuple(rgb))[0] * 360
    return 'shop-warm' if 15 <= hd < 75 else 'shop-teal' if 75 <= hd < 260 else 'shop-pink'


def source_roles(path, crop, scale):
    """Triangles of a model in source units (optionally only those whose centre lies in an X range) and their roles."""
    P, _, mat, uv, j, blob = scene_triangles(path)
    if crop:
        cx = P[:, :, 0].mean(1)
        sel = (cx >= crop[0]) & (cx <= crop[1])
        P, mat, uv = P[sel], mat[sel], uv[sel]
    area = np.linalg.norm(np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]), axis=1) / 2
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
        ef = np.array(m.get('emissiveFactor', [0, 0, 0]))
        if em is None and ef.max() > 0.2:
            # Just_Eh's lamps and signs glow by their factor alone; his glass is lit shop window.
            roles.append(GLASS if m.get('name', '').startswith('Glass') else lit_role(ef, area[t] * scale * scale))
            continue
        if em is not None and not bad:
            e = texel_mean(em, uv[t]) * np.array(m.get('emissiveFactor', [1, 1, 1]))
            if e.max() > 0.2:
                roles.append(lit_role(e, area[t] * scale * scale))
                continue
        factor = to_srgb(np.array(m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])[:3]))
        rgb = texel_mean(base, uv[t]) * factor if base is not None and not bad else factor
        roles.append(room_role(rgb))
    return P, roles


def box_tris(a, b, t):
    """A square tube of side `t` from point a to point b (in the XY plane at z = a[2]), as 12 triangles."""
    a, b = np.array(a, float), np.array(b, float)
    d = b - a
    d /= np.linalg.norm(d)
    s = np.array([-d[1], d[0], 0.0]) * t / 2
    n = np.array([0, 0, t / 2])
    a, b = a - d * t / 2, b + d * t / 2
    c = [a - s - n, a + s - n, a + s + n, a - s + n, b - s - n, b + s - n, b + s + n, b - s + n]
    quads = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (0, 4, 7, 3)]
    tris = []
    for q in quads:
        tris.append([c[q[0]], c[q[1]], c[q[2]]])
        tris.append([c[q[0]], c[q[2]], c[q[3]]])
    return tris


def name_sign(x_mid, y, z):
    """ALCHEMIA in tubes standing on the roof at height y, centred on x_mid, its face at z; a dark rail under it."""
    w, h = LETTER
    total = len(NAME) * w + (len(NAME) - 1) * GAP
    x0 = x_mid - total / 2
    lift = 0.25
    tris, roles = [], []
    for i, ch in enumerate(NAME):
        ox = x0 + i * (w + GAP)
        for (u0, v0), (u1, v1) in STROKES[ch]:
            for t in box_tris((ox + u0 * w, y + lift + v0 * h, z), (ox + u1 * w, y + lift + v1 * h, z), TUBE):
                tris.append(t)
                roles.append(NAME_NEON)
    # The rail the letters stand on and its two feet on the roof.
    for a, b in (((x0, y + lift - 0.08, z - 0.12), (x0 + total, y + lift - 0.08, z - 0.12)),
                 ((x0 + 0.4, y, z - 0.12), (x0 + 0.4, y + lift, z - 0.12)),
                 ((x0 + total - 0.4, y, z - 0.12), (x0 + total - 0.4, y + lift, z - 0.12))):
        for t in box_tris(a, b, 0.12):
            tris.append(t)
            roles.append(NAME_BACK)
    return np.array(tris), roles


def bake(key, source, scale, crop, target, folder):
    P, roles = source_roles(os.path.join(folder, *source), crop, scale)
    if crop:
        # Triangles reaching past the crop (a cable strung to the next shopfront) go.
        wide = (P[:, :, 0].max(1) - P[:, :, 0].min(1)) > (crop[1] - crop[0])
        P, roles = P[~wide], [r for r, w in zip(roles, wide) if not w]
    lit = np.array([SWATCHES[SW[r]][2] == 'glow' for r in roles])
    lit_target = int(target * LIT_SHARE)
    L, lroles = simplify(P[lit], [r for r, g in zip(roles, lit) if g], lit_target)
    Q, rest = drop_specks(*simplify(P[~lit], [r for r, g in zip(roles, lit) if not g], target - len(L)))
    P = np.concatenate([Q, L]) * scale
    roles = list(rest) + list(lroles)
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    centre = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    P = P - centre
    if key == 'alchemia-hall':
        x0, x1, y, front = np.array(HALL_ROOF) * scale - centre[[0, 0, 1, 2]]
        S, sroles = name_sign(float(x0 + x1) / 2, float(y), float(front) - TUBE)
        P = np.concatenate([P, S])
        roles = roles + sroles
    return P, roles


def build_alchemia(folder, out_dir):
    models, extras = [], {}
    for key, source, scale, crop, target in MODELS:
        P, roles = bake(key, source, scale, crop, target, folder)
        m = weld(key, P, flat_normals(P), roles, swatch_uv, MAX_TRIS)
        flat = P.reshape(-1, 3)
        size = [round(float(x), 3) for x in flat.max(0) - flat.min(0)]
        extras[key] = {'size': size, 'styles': [key], 'credit': source[0]}
        models.append(m)
        print(f"{key:18s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {size} roles {','.join(sorted(set(roles)))}")
    albedo, glow = palette_images()
    dst = os.path.join(out_dir, 'alchemia-props.glb')
    write_glb(models, png_bytes(albedo), png_bytes(glow), dst, extras, SWATCHES, GRID)
    print(dst, f'{os.path.getsize(dst) // 1024} KB', 'crc', format(zlib.crc32(open(dst, 'rb').read()), '08x'))
