"""The drones over the street canyons of ADR-0058 stage 7 in packages/app/public/city/drone-props.glb, on the city
kit's swatch palette like the other props files (the engine loads it after them and merges them, `mergeCityProps`).

One airframe for all three kinds: Berk Gedik's Cyberpunk Drone Concept Design (CC-BY 4.0, E4 of the user's second
pack, docs/plany/assety-paczka-2.md): a hull between two ducted fans, front to +Z. Each kind gets its livery from
the hull's role, navigation lights on its fans (red and green), a light under its hull in the kind's colour
and its own gear, drawn here as boxes, style `drone-<kind>`:
- `drone-patrol`: police or corporate patrol (Tessen), a silver hull with a red and blue light bar on top;
- `drone-delivery`: a courier, an amber hull with a dark teal parcel hung under it;
- `drone-ad`: an advertising drone, a dark hull with a screen hung under it (neon stripes on a black face, both
  sides, no brand).
The engine draws them in one shared mesh (`engine/.../drones/drone-views.ts`), its far version of a few boxes
procedural. Sizes: `DRONE_SIZE` of packages/engine/src/renderer/drones/drone-flight.ts as (width, height, length),
`SIZE` here (a test holds the two together): the model is fitted into it, foot on y = 0, centred on X/Z.

Colours per triangle from the textures: emissive texels as the nearest neon, the saturated red of the hull as the
kind's livery, orange cables as amber trim, the rest by the value of the mean texel. Node `extras`:
{"size", "styles", "credit": source id}.

Usage: python3 -I tools/city_kit.py --drones DIR --out DIR (DIR as filled by tools/assets/fetch.mjs).
"""
import os, zlib
import numpy as np
from city_ccby import flat_normals, simplify, weld
from city_kit_gltf import png_bytes, scene_triangles, write_glb
from city_kit_palette import GRID, SWATCHES, hsv, palette_images, swatch_uv
from city_props import material_image, nearest_neon, texel_mean
from city_street import box_tris
from city_street_e2 import drop_specks

SOURCE = ('sketchfab-cyberpunk-drone', 'cyberpunk_drone_concept_design.glb')

# (width, height, length) m and the fans' span (FRAME): DRONE_SIZE of packages/engine/src/renderer/drones/drone-flight.ts.
SIZE = {'patrol': (3.4, 1.25, 1.65), 'delivery': (3.0, 1.85, 1.45), 'ad': (3.4, 3.1, 1.45)}
# The airframe's width per kind (its fans' span); the rest of the size is the kind's gear.
FRAME = {'patrol': 3.4, 'delivery': 3.0, 'ad': 3.0}
# The hull's livery per kind.
HULL = {'patrol': 'paint', 'delivery': 'fabric-amber', 'ad': 'dark'}
# The light under the hull per kind: what the street sees of a drone at night.
BELLY = {'patrol': 'neon-blue', 'delivery': 'neon-amber', 'ad': 'neon-pink'}

NEAR_TRIS = 900
MAX_TRIS = 1500


def source_roles(path):
    """Triangles of the airframe and their roles: emissive as neon, the red hull as 'hull', the rest by value."""
    P, _, mat, uv, j, blob = scene_triangles(path)
    mats = j.get('materials', [])
    folder = os.path.dirname(path)
    images = {}
    roles = []
    for t in range(len(P)):
        mi = int(mat[t])
        if mi not in images:
            m = mats[mi] if mi >= 0 else {}
            images[mi] = (material_image(j, blob, m, folder, 'base'), material_image(j, blob, m, folder, 'emissive'))
        base, em = images[mi]
        bad = np.isnan(uv[t]).any()
        if em is not None and not bad and texel_mean(em, uv[t]).max() > 0.2:
            roles.append(nearest_neon(texel_mean(em, uv[t])))
            continue
        rgb = texel_mean(base, uv[t]) if base is not None and not bad else np.array([0.3, 0.3, 0.3])
        h, s, v = hsv(tuple(rgb))
        deg = h * 360
        if s > 0.45 and v > 0.25 and (deg >= 340 or deg < 15):
            roles.append('hull')
        elif s > 0.45 and v > 0.35 and 15 <= deg < 55:
            roles.append('fabric-amber')
        elif v < 0.1:
            roles.append('dark')
        elif v < 0.22:
            roles.append('trim')
        elif v < 0.45:
            roles.append('metal')
        else:
            roles.append('trim-light')
    return P, roles


def fit_frame(P, width):
    """Scaled to `width` across (uniformly), foot on y = 0, centred on X/Z."""
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    k = width / (hi[0] - lo[0])
    return (P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])) * k


def closed_box(cx, cy, cz, w, h, d):
    """`box_tris` with its bottom: what hangs under a drone is seen from the street."""
    x0, x1, y0, z0, z1 = cx - w / 2, cx + w / 2, cy, cz - d / 2, cz + d / 2
    a, b, c, e = (x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)
    return np.concatenate([box_tris(cx, cy, cz, w, h, d), np.array([[a, b, c], [a, c, e]], np.float64)])


def gear(kind, lift, frame_h):
    """The kind's own boxes: a light bar on the frame's top (`frame_h` over its foot), or the parcel or the screen
    hung `lift` metres below the frame."""
    out = []
    w, h, l = SIZE[kind]
    if kind == 'patrol':
        top = frame_h
        out += [(closed_box(-0.16, top + 0.04, 0, 0.3, 0.08, 0.22), 'neon-red'), (closed_box(0.16, top + 0.04, 0, 0.3, 0.08, 0.22), 'neon-blue')]
        out += [(closed_box(0, top, 0, 0.7, 0.04, 0.3), 'dark')]
    elif kind == 'delivery':
        out += [(closed_box(0, 0, 0, 0.8, lift - 0.12, 0.8), 'dumpster'), (closed_box(0, lift - 0.12, 0, 0.12, 0.14, 0.12), 'metal')]
        out += [(closed_box(0, lift * 0.45, 0.405, 0.8, 0.08, 0.01), 'neon-amber'), (closed_box(0, lift * 0.45, -0.405, 0.8, 0.08, 0.01), 'neon-amber')]
    else:
        face = lift - 0.3
        out += [(closed_box(0, 0, 0, w, face, 0.1), 'sign-back')]
        for k, role in enumerate(('neon-pink', 'neon-cyan', 'neon-violet', 'neon-pink')):
            y = 0.2 + k * (face - 0.4) / 4
            for side in (1, -1):
                out += [(closed_box(0, y, side * 0.055, w * (0.85 - 0.12 * (k % 2)), (face - 0.4) / 6, 0.01), role)]
        out += [(closed_box(sx * 0.6, face, 0, 0.08, 0.3, 0.08), 'metal') for sx in (-1, 1)]
    return out


def drone(kind, P0, roles0):
    """The kind's model: the airframe in its livery over its gear, (triangles, roles)."""
    P = fit_frame(P0, FRAME[kind])
    roles = [HULL[kind] if r == 'hull' else r for r in roles0]
    w, h, l = SIZE[kind]
    frame_h = float(P.reshape(-1, 3)[:, 1].max())
    lift = 0.0 if kind == 'patrol' else h - frame_h
    P = P + np.array([0, lift, 0])
    half = FRAME[kind] / 2
    # Navigation lights on the fans' outer rims (red port, green starboard) and the belly light.
    parts = gear(kind, lift, frame_h) + [
        (closed_box(-half + 0.12, lift + frame_h * 0.35, 0, 0.22, 0.12, 0.22), 'neon-red'),
        (closed_box(half - 0.12, lift + frame_h * 0.35, 0, 0.22, 0.12, 0.22), 'neon-green'),
        (closed_box(0, lift + 0.02, 0, 0.35, 0.05, 0.8), BELLY[kind]),
    ]
    P, roles = drop_specks(*simplify(P, roles, NEAR_TRIS - sum(len(t) for t, _ in parts)))
    P = np.concatenate([P] + [t for t, _ in parts])
    roles = list(roles) + [r for t, r in parts for _ in range(len(t))]
    return P, roles


def build_drones(folder, out_dir):
    P0, roles0 = source_roles(os.path.join(folder, *SOURCE))
    out, extras = [], {}
    for kind in ('patrol', 'delivery', 'ad'):
        key = f'drone-{kind}'
        P, roles = drone(kind, P0, roles0)
        flat = P.reshape(-1, 3)
        lo, hi = flat.min(0), flat.max(0)
        size = [round(float(x), 3) for x in hi - lo]
        w, h, l = SIZE[kind]
        if size[0] > w + 1e-3 or size[1] > h + 1e-3 or size[2] > l + 1e-3:
            raise ValueError(f'{key}: {size} over its size {SIZE[kind]}')
        m = weld(key, P, flat_normals(P), roles, swatch_uv, MAX_TRIS)
        out.append(m)
        extras[key] = {'size': size, 'styles': [key], 'credit': SOURCE[0]}
        print(f"{key:16s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {size} roles {','.join(sorted(set(roles)))}")
    albedo, glow = palette_images()
    dst = os.path.join(out_dir, 'drone-props.glb')
    write_glb(out, png_bytes(albedo), png_bytes(glow), dst, extras, SWATCHES, GRID)
    print(dst, f'{os.path.getsize(dst) // 1024} KB', 'crc', format(zlib.crc32(open(dst, 'rb').read()), '08x'))
