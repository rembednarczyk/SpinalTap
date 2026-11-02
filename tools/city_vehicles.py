"""The street's vehicles of ADR-0058 stage 4 in packages/app/public/city/vehicle-props.glb, on the city kit's
swatch palette like the other props files (the engine loads it after them and merges them, `mergeCityProps`).

The sim's vehicles keep their bodies (`VEHICLE_SIZE` in packages/core/src/ports/types.ts, `SIZE` here; a test
holds the two together): a vehicle model is a look the renderer picks for a body, fitted to it, never a new
body. Near models, one per look, style `veh-<body>`:
- `veh-cyber`: 4d_Bob's Cyberpunk car (CC-BY 4.0, E5 of the user's second pack), a hatchback's body;
- `veh-dirty`: 3D Error 404's Dirty car (CC-BY 4.0, E5), an old saloon, a sedan's body;
- `veh-suv`, `veh-pickup`: Kenney Car Kit's SUV and pickup (CC0), a van's body;
- `veh-garbage`: Kenney Car Kit's garbage truck (CC0), a delivery's body;
- `veh-trolleybus`: Quaternius' bus (Public Transport Pack, CC0) lengthened to Lublin's 12 m trolleybus
  (its middle stretched, the cab and the tail kept), the roof's gear and the booms drawn by the engine.
Each near model also has `<key>-lite` (the phone's, style `veh-lite`) and `<key>-far` (style `veh-far`, a few
boxes after its silhouette, slice by slice along its length); so have the city kit's own cars (`car-sedan`...,
read from packages/app/public/city/city-kit.glb itself), whose near models stay in the kit.

Colours per triangle: Kenney's from its colormap (`city_kit.car_roles`), a textured model's by the value of its
mean texel (`bands`; emissive texels become the nearest neon), an OBJ's by material name. The `paint` swatch is
tinted per vehicle by the engine; the trolleybus's livery is tinted by swatch (`wall` its red roof, `wall-dark`
its green skirt). Node `extras`: {"size", "styles", "credit": source id for CC-BY}.

Usage: python3 -I tools/city_kit.py --vehicles DIR --out DIR (DIR as filled by tools/assets/fetch.mjs).
"""
import os, zlib
import numpy as np
from PIL import Image
from city_ccby import flat_normals, simplify, weld
from city_kit import car_roles
from city_kit_gltf import accessor, png_bytes, read_glb, scene_triangles, write_glb
from city_kit_palette import GRID, SWATCHES, hsv, palette_images, swatch_uv
from city_props import material_image, nearest_neon, texel_mean
from city_street import box_tris
from city_street_e2 import drop_specks, is_ccby

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.join(HERE, '..', 'packages', 'app', 'public', 'city', 'city-kit.glb')

# VEHICLE_SIZE of packages/core/src/ports/types.ts as (width, height, length), metres.
SIZE = {
    'sedan': (1.82, 1.45, 4.5), 'hatchback': (1.75, 1.4, 4.1), 'taxi': (1.82, 1.6, 4.6),
    'van': (1.95, 1.95, 5.0), 'delivery': (2.05, 2.45, 5.8), 'trolleybus': (2.55, 3.4, 12.0),
}
# The trolleybus's body up to its roof; the roof's gear and the booms above are the engine's.
TROLLEY_BODY = 3.05

CYBER = ('sketchfab-cyberpunk-car', 'cyberpunk_car.glb')
DIRTY = ('sketchfab-dirty-car', 'dirty_car.glb')
KENNEY = 'kenney-car-kit-2'
BUS = ('quaternius-public-transport', 'OBJ/Bus.obj')

# A textured car by the value of its mean texel: (upper bound, role) in turn.
CYBER_BANDS = [(0.06, 'tyre'), (0.1, 'trim'), (0.16, 'paint'), (0.25, 'metal'), (9, 'trim-light')]
DIRTY_BANDS = [(0.12, 'tyre'), (0.3, 'trim'), (0.45, 'metal'), (9, 'paint')]

# key, body, source, file, yaw (deg about Y, front to +Z), options
#   bands: value bands of a textured model; materials: material name -> role (or 'bands:<list>' by value)
#   obj: an OBJ's material name -> role; lights: the role whose front half is headlight, rear half taillight
#   glass: (lowest height share, highest |normal y|, z share range) where the paint above the belt is glass
#   roof: role of the up-facing triangles of the top tenth; lengthen: (z0, z1) shares of the length stretched
#   proportional: its height scaled as its length (not stretched to the body's)
VEHICLES = [
    ('veh-cyber', 'hatchback', CYBER, 180, {'proportional': True, 'bands': CYBER_BANDS, 'glass': (0.6, 0.85, (-0.3, 0.3))}),
    ('veh-dirty', 'sedan', DIRTY, 0, {'proportional': True, 'bands': DIRTY_BANDS, 'materials': {'large_car_glass_mat': 'glass-dark', 'large_car_wheels_mat': 'tyre'}}),
    ('veh-suv', 'van', (KENNEY, 'x/Models/GLB format/suv.glb'), 0, {'kenney': True}),
    ('veh-pickup', 'van', (KENNEY, 'x/Models/GLB format/truck.glb'), 0, {'kenney': True}),
    ('veh-garbage', 'delivery', (KENNEY, 'x/Models/GLB format/garbage-truck.glb'), 0, {'kenney': True}),
    ('veh-trolleybus', 'trolleybus', BUS, -90, {
        'obj': {'Top': 'paint', 'Material': 'tyre', 'Bottom': 'wall-dark', 'Bumper': 'trim', 'Windows': 'glass-dark', 'Details': 'metal', 'Lights': 'lights'},
        'lights': 'lights', 'roof': 'wall', 'lengthen': (0.22, 0.72)}),
]
# The city kit's own cars (front -Z in the kit): their phone and far versions.
KIT_CARS = [('car-sedan', 'sedan'), ('car-hatchback', 'hatchback'), ('car-taxi', 'taxi'), ('car-van', 'van'), ('car-delivery', 'delivery')]

NEAR_TRIS, LITE_TRIS = 1000, 350
MAX_TRIS = 1500


def turn(P, yaw):
    a = np.radians(yaw)
    R = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    return (P.reshape(-1, 3) @ R.T).reshape(-1, 3, 3)


def band_role(v, bands):
    return next(r for top, r in bands if v < top)


def textured_roles(path, opts):
    """Roles of a textured glTF car: emissive texels as neon, materials by name, the rest by value bands."""
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
        named = opts.get('materials', {}).get(m.get('name', ''))
        bad = np.isnan(uv[t]).any()
        if em is not None and not bad and texel_mean(em, uv[t]).max() > 0.2:
            roles.append(nearest_neon(texel_mean(em, uv[t])))
            continue
        rgb = texel_mean(base, uv[t]) if base is not None and not bad else np.array([0.5, 0.5, 0.5])
        h, s, v = hsv(tuple(rgb))
        if named == 'tyre':
            roles.append('tyre' if v < 0.3 else 'metal')
        elif named:
            roles.append(named)
        elif s > 0.45 and v > 0.35 and (h * 360 >= 340 or h * 360 < 15):
            roles.append('taillight')
        elif s > 0.45 and v > 0.5 and 20 <= h * 360 < 55:
            roles.append('neon-amber')
        else:
            roles.append(band_role(v, opts['bands']))
    return P, roles


def kenney_roles(path):
    P, _, _, uv, _, _ = scene_triangles(path)
    tex = np.asarray(Image.open(os.path.join(os.path.dirname(path), 'Textures', 'colormap.png')).convert('RGB')).astype(np.float64) / 255
    h, w = tex.shape[:2]
    m = uv.mean(1)
    px = np.clip((m[:, 0] % 1) * w, 0, w - 1).astype(int)
    py = np.clip((m[:, 1] % 1) * h, 0, h - 1).astype(int)
    return P, car_roles(P, tex[py, px])


def fit(P, body, height=None):
    """Into the body's box per axis, foot on y = 0, centred on X/Z; `height` in place of the body's."""
    w, hgt, l = SIZE[body]
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    return (P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])) * (np.array([w, height or hgt, l]) / (hi - lo))


def lengthen(P, z0, z1, length):
    """Stretches the part between the shares z0 and z1 of the length so the whole is `length` long; the rest moves."""
    flat = P.reshape(-1, 3).copy()
    lo, hi = flat[:, 2].min(), flat[:, 2].max()
    a, b = lo + (hi - lo) * z0, lo + (hi - lo) * z1
    k = (length - (hi - lo) + (b - a)) / (b - a)
    z = flat[:, 2]
    flat[:, 2] = np.where(z < a, z, np.where(z > b, z + (b - a) * (k - 1), a + (z - a) * k))
    return flat.reshape(-1, 3, 3)


def tidy(P, roles, opts):
    """Lights split front and back, glass above a sports car's belt, the roof's role."""
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    c = P.mean(1)
    n = flat_normals(P)[:, 0]
    out = []
    for t, r in enumerate(roles):
        if r == opts.get('lights'):
            r = 'headlight' if c[t, 2] > 0 else 'taillight'
        if 'glass' in opts and r == 'paint':
            y0, ny, (za, zb) = opts['glass']
            zs = (c[t, 2] - lo[2]) / (hi[2] - lo[2]) - 0.5
            if c[t, 1] > lo[1] + y0 * (hi[1] - lo[1]) and abs(n[t, 1]) < ny and za <= zs <= zb:
                r = 'glass-dark'
        if 'roof' in opts and n[t, 1] > 0.9 and c[t, 1] > hi[1] - 0.1 * (hi[1] - lo[1]):
            r = opts['roof']
        out.append(r)
    return out


def far_lod(P, roles):
    """A few boxes after the silhouette: per slice along the length its body up to the belt and its cabin (glass)
    or load above, a dark skirt, the lamps front and back. Some 100-170 triangles."""
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    length, c = hi[2] - lo[2], P.mean(1)
    area = np.linalg.norm(np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]), axis=1)
    roles = np.array(roles)
    slices = 3 if length < 6.5 else 5
    edges = np.linspace(lo[2], hi[2], slices + 1)
    out, out_roles = [], []

    def add(tris, role):
        out.append(tris)
        out_roles.extend([role] * len(tris))

    def dominant(sel):
        """The paint where it covers a fair share, else the most used role (lamps and tyres aside)."""
        acc = {}
        for r, a in zip(roles[sel], area[sel]):
            if r not in ('tyre', 'headlight', 'taillight'):
                acc[r] = acc.get(r, 0) + a
        if acc.get('paint', 0) >= 0.1 * sum(acc.values()):
            return 'paint'
        return max(acc, key=acc.get) if acc else 'paint'
    skirt = 0.3
    for z0, z1 in zip(edges[:-1], edges[1:]):
        sel = (c[:, 2] >= z0) & (c[:, 2] <= z1)
        if not sel.any():
            continue
        ys = P[sel][:, :, 1].reshape(-1)
        top = float(np.percentile(ys, 97))
        half = float(np.percentile(np.abs(P[sel][:, :, 0].reshape(-1)), 97))
        glass = sel & (roles == 'glass-dark')
        belt = float(np.percentile(c[glass, 1], 10)) if area[glass].sum() > 0.04 * area[sel].sum() else top
        belt = min(max(belt, skirt + 0.2), top)
        add(box_tris(0, skirt, (z0 + z1) / 2, 2 * half, belt - skirt, z1 - z0), dominant(sel & (c[:, 1] < belt)))
        if top - belt > 0.08:
            add(box_tris(0, belt, (z0 + z1) / 2, 2 * half * 0.9, top - belt, z1 - z0), 'glass-dark' if belt < top - 0.08 and glass.any() else dominant(sel & (c[:, 1] >= belt)))
    add(box_tris(0, 0, (lo[2] + hi[2]) / 2, (hi[0] - lo[0]) * 0.86, skirt, length * 0.9), 'tyre')
    for role, z in (('headlight', hi[2] + 0.01), ('taillight', lo[2] - 0.01)):
        sel = roles == role
        if not sel.any():
            continue
        y = float(c[sel, 1].mean())
        x = float(np.abs(c[sel, 0]).mean())
        for sx in (-1, 1):
            add(box_tris(sx * max(x, 0.3), y - 0.06, z, 0.3, 0.12, 0.04), role)
    return np.concatenate(out).astype(np.float64), out_roles


def ear_clip(poly):
    """Triangles of a planar polygon (Bus.obj has concave n-gons a fan would cut across), by ear clipping in
    the plane of its Newell normal."""
    pts = np.array(poly)
    n = sum(np.cross(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts)))
    n = n / max(np.linalg.norm(n), 1e-12)
    # A right-handed basis (u, v, n) of its plane: the polygon runs counter-clockwise in (u, v).
    u = np.cross(n, [1, 0, 0] if abs(n[0]) < 0.9 else [0, 1, 0])
    u /= np.linalg.norm(u)
    uv = np.stack([pts @ u, pts @ np.cross(n, u)], 1)
    idx = list(range(len(pts)))
    out = []

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    guard = 0
    while len(idx) > 3 and guard < 1000:
        guard += 1
        for k in range(len(idx)):
            a, b, c = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            if cross(uv[a], uv[b], uv[c]) <= 1e-12:
                continue
            if any(cross(uv[a], uv[b], uv[p]) >= 0 and cross(uv[b], uv[c], uv[p]) >= 0 and cross(uv[c], uv[a], uv[p]) >= 0 for p in idx if p not in (a, b, c)):
                continue
            out.append([pts[a], pts[b], pts[c]])
            idx.pop(k)
            break
        else:
            break
    for k in range(1, len(idx) - 1):
        out.append([pts[idx[0]], pts[idx[k]], pts[idx[k + 1]]])
    return out


def obj_polygons(path):
    """Triangles of an OBJ and the material name of each, n-gons ear-clipped."""
    V, P, mats, cur = [], [], [], ''
    for line in open(path, encoding='utf-8', errors='replace'):
        p = line.split()
        if not p:
            continue
        if p[0] == 'v':
            V.append([float(x) for x in p[1:4]])
        elif p[0] == 'usemtl':
            cur = ' '.join(p[1:])
        elif p[0] == 'f':
            idx = [int(t.split('/')[0]) for t in p[1:]]
            tris = ear_clip([V[i - 1 if i > 0 else len(V) + i] for i in idx])
            P += tris
            mats += [cur] * len(tris)
    return np.array(P, np.float64), mats


def kit_car(key):
    """A car of city-kit.glb as triangles and roles (its swatch by UV), turned front to +Z."""
    j, blob = read_glb(KIT)
    node = next(n for n in j['nodes'] if n.get('name') == key)
    pr = j['meshes'][node['mesh']]['primitives'][0]
    pos = accessor(j, blob, pr['attributes']['POSITION'])
    uv = accessor(j, blob, pr['attributes']['TEXCOORD_0'])
    ind = accessor(j, blob, pr['indices']).astype(np.int64).reshape(-1, 3)
    names = [s['name'] for s in j['asset']['extras']['swatches']]
    grid = j['asset']['extras']['grid']
    cell = np.floor(uv[ind].mean(1) * grid).astype(int)
    roles = [names[y * grid + x] for x, y in cell]
    return turn(pos[ind], 180), roles


def source(folder, key, src, yaw, body, opts):
    path = os.path.join(folder, src[0], src[1])
    if src[1].endswith('.obj'):
        P, mats = obj_polygons(path)
        roles = [opts['obj'].get(m, 'trim') for m in mats]
    elif opts.get('kenney'):
        P, roles = kenney_roles(path)
    else:
        P, roles = textured_roles(path, opts)
    P = turn(P, yaw)
    if 'lengthen' in opts:
        w, _, l = SIZE[body]
        flat = P.reshape(-1, 3)
        P = P * (w / (flat[:, 0].max() - flat[:, 0].min()))
        P = lengthen(P, *opts['lengthen'], l)
    height = TROLLEY_BODY if body == 'trolleybus' else None
    if opts.get('proportional'):
        # A low sports car stays low: its height scaled as its length, never above the body.
        flat = P.reshape(-1, 3)
        span = flat.max(0) - flat.min(0)
        height = min(SIZE[body][1], span[1] * SIZE[body][2] / span[2])
    P = fit(P, body, height)
    return P, tidy(P, roles, opts)


GLOWS = {name for name, _, kind in SWATCHES if kind == 'glow'}


def reduce(P, roles, target):
    """`simplify` with the lamps and neon (a tenth of the budget) and the tyres (a sixth) on their own: small or
    round, they would melt into the body, and the lamps are what shows at night."""
    groups = [(lambda r: r in GLOWS, target // 10), (lambda r: r == 'tyre', target // 6)]
    rest = np.ones(len(P), bool)
    outP, outR = [], []
    for test, budget in groups:
        sel = np.array([test(r) for r in roles]) & rest
        rest &= ~sel
        if sel.any():
            Q, R = simplify(P[sel], [r for r, k in zip(roles, sel) if k], budget)
            outP.append(Q)
            outR += R
    Q, R = drop_specks(*simplify(P[rest], [r for r, k in zip(roles, rest) if k], target - sum(len(q) for q in outP)))
    return np.concatenate(outP + [Q]), outR + R


def lods(key, P, roles):
    """The near, phone and far versions of a fitted model: (key, triangles, roles) each."""
    near = reduce(P, roles, NEAR_TRIS)
    lite = reduce(P, roles, LITE_TRIS)
    far = far_lod(P, roles)
    return [(key, *near), (f'{key}-lite', *lite), (f'{key}-far', *far)]


def build_vehicles(folder, out_dir):
    out, extras = [], {}

    def emit(key, body, P, roles, styles, credit):
        # Fitted again: the simplification and the dropped specks (mirrors) leave it smaller than its body.
        flat = P.reshape(-1, 3)
        P = fit(P, body, min(flat[:, 1].max() - flat[:, 1].min(), TROLLEY_BODY if body == 'trolleybus' else SIZE[body][1]))
        flat = P.reshape(-1, 3)
        lo, hi = flat.min(0), flat.max(0)
        m = weld(key, P, flat_normals(P), roles, swatch_uv, MAX_TRIS)
        size = [round(float(x), 3) for x in hi - lo]
        out.append(m)
        extras[key] = {'size': size, 'styles': styles, **({'credit': credit} if credit else {})}
        print(f"{key:24s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {size} roles {','.join(sorted(set(roles)))}")

    for key, body, src, yaw, opts in VEHICLES:
        P, roles = source(folder, key, src, yaw, body, opts)
        credit = src[0] if is_ccby(src[0]) else None
        for k, Q, r in lods(key, P, roles):
            emit(k, body, Q, r, [f'veh-{body}'] if k == key else ['veh-lite' if k.endswith('-lite') else 'veh-far'], credit)
    for key, body in KIT_CARS:
        P, roles = kit_car(key)
        P = fit(P, body)
        for k, Q, r in lods(key, P, roles)[1:]:
            emit(k, body, Q, r, ['veh-lite' if k.endswith('-lite') else 'veh-far'], None)
    albedo, glow = palette_images()
    dst = os.path.join(out_dir, 'vehicle-props.glb')
    write_glb(out, png_bytes(albedo), png_bytes(glow), dst, extras, SWATCHES, GRID)
    print(dst, f'{os.path.getsize(dst) // 1024} KB', 'crc', format(zlib.crc32(open(dst, 'rb').read()), '08x'))
