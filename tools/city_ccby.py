"""CC-BY 4.0 street props for packages/app/public/city/city-props.glb (ADR-0063), on the city kit's
swatch palette (tools/city_kit_palette.py), next to the CC0 props of tools/city_props.py.

Sources (tools/assets/sources.json, fetched by tools/assets/fetch.mjs into DIR/<source id>/): Sketchfab
GLBs, too heavy and too detailed for a cell mesh, so each one is
- cut down to one model where the file holds several (the electric pole file has four poles and loose
  parts side by side): `crop` keeps the triangles whose centre lies in an X range;
- coloured per triangle like the CC0 props: a flat material by its name (`roles`), or the mean texel
  of its base colour texture through `textured_role`; an emissive texel becomes the nearest neon;
- simplified by vertex clustering on a grid (the finest grid that keeps the model under the target),
  with flat normals: hard-surface models keep their silhouette, small bolts and cables go;
- turned front to +Z, scaled to metres and stood on y = 0 with its origin at `origin` ('base': the
  middle of its foot, so a pole's mast stands on the point the engine gives it).

Node `extras`: {"size", "styles", "credit": source id, "lights": [[x, y, z]...] (the self-lit lamps, for
the halos)}. The credit ties the model to its entry in packages/ui/src/credits/credits.ts and the row in
packages/app/public/city/README.md; a test checks both.
"""
import os
import numpy as np
from city_kit_gltf import scene_triangles
from city_kit_palette import SW, hsv
from city_props import material_image, nearest_neon, texel_mean, to_srgb

# Heaviest model the engine may bake into a cell (ADR-0058); the target leaves room under it.
MAX_TRIS = 1500
TARGET_TRIS = 1400

# Electric pole (Just_Eh): flat materials by name. Its emissive ones (the lamp's warm white, the blue
# indicator lights) go by their colour: a pale one is the lamp (`headlight`), a saturated one a neon.
POLE_ROLES = {
    'Grey_Isle_3_MEtalness': 'metal', 'Grey_isle_1_Glossy': 'ac', 'Grey_Isle_2_Metalness': 'trim',
    'Coil': 'rust', 'Wheels_red_metallness': 'fabric-magenta', 'Material': 'dark',
}

# key, source id, file, styles, yaw (deg about glTF Y, front to +Z), scale (to metres), options
#   crop: (x0, x1) keep the triangles whose centre has x0 <= x <= x1 (source units)
#   origin: 'base' the middle of the foot (the lowest 5 % of the height), else the bounding box's
#   roles: material name (its prefix before a `.001` suffix) -> swatch; without one the texture decides
CCBY = [
    # The first of the four poles: 2.5 units, 8.6 m; its lamp arm points +Z, the crossarm along X.
    ('pr-pole', 'sketchfab-electric-pole', 'electric_pole.glb', ['pole'], 0, 3.4, {'crop': (-3.1, -2.1), 'origin': 'base', 'roles': POLE_ROLES}),
    # The robot dog (igor.tesV), front at +X: 21.7 units tall, 0.54 m here, 0.32 m wide.
    ('pr-robodog', 'sketchfab-robotic-animal', 'robotic_animal.glb', ['robodog'], -90, 0.025, {}),
]


def textured_role(rgb):
    """A painted robot's colours: greys by value, the paint by hue."""
    h, s, v = hsv(tuple(rgb))
    hd = h * 360
    if s < 0.25:
        return 'ac' if v > 0.6 else 'metal' if v > 0.4 else 'trim' if v > 0.22 else 'dark'
    if hd >= 330 or hd < 30:
        return 'brick'
    if hd < 70:
        return 'fabric-amber'
    if hd < 200:
        return 'fabric-teal' if s > 0.45 else 'trim'
    return 'trim'


def flat_role(m, table):
    """A flat material: emissive by its colour, the rest by its name."""
    e = m.get('emissiveFactor', [0, 0, 0])
    if 'baseColorFactor' not in m.get('pbrMetallicRoughness', {}) and max(e) > 0.05:
        return 'headlight' if hsv(tuple(e))[1] < 0.5 else nearest_neon(np.array(e))
    return table.get(m.get('name', '').split('.')[0], 'metal')


def roles_of(mat, uv, j, blob, folder, table):
    mats = j.get('materials', [])
    images = {}
    roles = []
    for t in range(len(mat)):
        mi = int(mat[t])
        m = mats[mi] if mi >= 0 else {}
        if table:
            roles.append(flat_role(m, table))
            continue
        if mi not in images:
            images[mi] = (material_image(j, blob, m, folder, 'base'), material_image(j, blob, m, folder, 'emissive'))
        base, em = images[mi]
        if em is not None and not np.isnan(uv[t]).any():
            e = texel_mean(em, uv[t]) * np.array(m.get('emissiveFactor', [1, 1, 1]))
            if e.max() > 0.2:
                roles.append(nearest_neon(e))
                continue
        rgb = texel_mean(base, uv[t]) if base is not None and not np.isnan(uv[t]).any() else to_srgb(np.array(m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [0.5, 0.5, 0.5, 1])[:3]))
        roles.append(textured_role(rgb))
    return roles


def cluster(P, roles, cell):
    """Vertex clustering: every corner moves to the mean of the corners in its grid cell; collapsed
    triangles go, and of two equal ones (same corners, same winding, same swatch) one stays."""
    corners = P.reshape(-1, 3)
    keys = np.floor(corners / cell).astype(np.int64)
    _, ids, inverse = np.unique(keys, axis=0, return_index=True, return_inverse=True)
    inverse = inverse.reshape(-1)
    sums = np.zeros((len(ids), 3))
    np.add.at(sums, inverse, corners)
    counts = np.bincount(inverse, minlength=len(ids))[:, None]
    centres = sums / counts
    tri = inverse.reshape(-1, 3)
    keep, seen = [], set()
    for t, (a, b, c) in enumerate(tri):
        if a == b or b == c or a == c:
            continue
        # The same triangle whichever corner it starts at; the other winding is the other face.
        r = min((a, b, c), (b, c, a), (c, a, b))
        k = (r, roles[t])
        if k in seen:
            continue
        seen.add(k)
        keep.append(t)
    return centres[tri[keep]], [roles[t] for t in keep]


def simplify(P, roles, target):
    """The finest clustering grid (halving search) that leaves at most `target` triangles."""
    if len(P) <= target:
        return P, roles
    span = float((P.reshape(-1, 3).max(0) - P.reshape(-1, 3).min(0)).max())
    lo, hi = span / 2000, span / 8
    best = cluster(P, roles, hi)
    for _ in range(18):
        mid = (lo + hi) / 2
        Q, R = cluster(P, roles, mid)
        if len(Q) <= target:
            best, hi = (Q, R), mid
        else:
            lo = mid
    return best


def flat_normals(P):
    n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    n = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    return np.repeat(n[:, None, :], 3, 1)


def bake_ccby(key, path, yaw, scale, opts):
    P, _, mat, uv, j, blob = scene_triangles(path)
    if 'crop' in opts:
        x0, x1 = opts['crop']
        cx = P[:, :, 0].mean(1)
        sel = (cx >= x0) & (cx <= x1)
        P, mat, uv = P[sel], mat[sel], uv[sel]
    roles = roles_of(mat, uv, j, blob, os.path.dirname(path), opts.get('roles'))
    a = np.radians(yaw)
    R = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    P = (P.reshape(-1, 3) @ R.T * scale).reshape(-1, 3, 3)
    P, roles = simplify(P, roles, TARGET_TRIS)
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    if opts.get('origin') == 'base':
        foot = flat[flat[:, 1] < lo[1] + 0.05 * (hi[1] - lo[1])]
        fl, fh = foot.min(0), foot.max(0)
        centre = np.array([(fl[0] + fh[0]) / 2, lo[1], (fl[2] + fh[2]) / 2])
    else:
        centre = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    P = P - centre
    N = flat_normals(P)
    lights = []
    lamp = [t for t, r in enumerate(roles) if r == 'headlight']
    if lamp:
        lights.append([round(float(x), 3) for x in P[lamp].reshape(-1, 3).mean(0)])
    return P, N, roles, [round(float(x), 3) for x in hi - lo], lights


def weld(key, P, N, roles, swatch_uv, max_tris=MAX_TRIS):
    verts = {}
    pos, nor, uvs, ind = [], [], [], []
    for t in range(len(P)):
        s = SW[roles[t]]
        for k in range(3):
            p = np.round(P[t, k], 4)
            vk = (tuple(p), tuple(np.round(N[t, k], 2)), s)
            vi = verts.get(vk)
            if vi is None:
                vi = verts[vk] = len(pos)
                pos.append(p)
                nor.append(N[t, k])
                uvs.append(swatch_uv(s))
            ind.append(vi)
    tris = len(ind) // 3
    if tris > max_tris:
        raise ValueError(f'{key}: {tris} triangles, over {max_tris}')
    return {'key': key, 'pos': np.array(pos, np.float32), 'nor': np.array(nor), 'uv': np.array(uvs), 'ind': np.array(ind, np.uint32)}


def build_ccby(ccby_dir, swatch_uv):
    """The CC-BY models and their node extras, in table order."""
    out, extras = [], {}
    for key, source, name, styles, yaw, scale, opts in CCBY:
        P, N, roles, size, lights = bake_ccby(key, os.path.join(ccby_dir, source, name), yaw, scale, opts)
        m = weld(key, P, N, roles, swatch_uv)
        m['size'] = size
        m['roles'] = sorted(set(roles))
        out.append(m)
        extras[key] = {'size': size, 'styles': styles, 'credit': source, **({'lights': lights} if lights else {})}
    # The skyline's megatowers (ADR-0063 stage 2) after the street props: these keep their bytes.
    from city_megacity import build_megacity
    towers, tower_extras = build_megacity(ccby_dir, swatch_uv)
    return out + towers, {**extras, **tower_extras}
