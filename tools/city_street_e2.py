"""Street furniture of ADR-0058 stage 2 in packages/app/public/city/street-props.glb, after the models of
tools/city_street.py: cash machines, fire hydrants, planters, bikes and scooters at the racks, food carts
on the markets and shipping containers on the riverside (docs/plany/assety-paczka-2.md, E2).

The sources lie under DIR as tools/assets/fetch.mjs leaves them (DIR/<source id>/...): CC0 packs (an OBJ
with flat MTL colours, Kenney GLBs) and CC-BY Sketchfab GLBs (credited in packages/ui/src/credits/
credits.ts). Each model is fitted per axis into the solid of its kind in the simulation (packages/sim/src/
content/lublin/furniture.ts) like those of tools/city_street.py, on the same palette, simplified to its
`target` triangles; loose parts under `MIN_PART` triangles are left out. Only the CC-BY models carry `extras.credit`. On top of `bake_street`'s options:
- `only`: keeps the triangles of these materials (one prop out of a pack of many);
- `obj`: material name -> role for an OBJ (its MTL colours are plain greys or missing);
- `parts`: [(file, scale, (x, y, z))] more models of the same source set on the first (a bush and a
  flower in a pot), before the fit;
- `roles`: flat material name -> role for a glTF of plain colours (Kenney's nature kit);
- `posts`: ((x, z)..., y0, y1, side) thin dark posts from y0 to y1 added after the simplification;
- `bands`: [(y0, y1, target)] heights (m, after the fit) simplified apart with their own target, so
  small parts there (a cart's wheels) keep their shape;
- `paint`: role -> role after the colours are read, for a colour variant (the cell mesh has no tint
  per prop, so each container colour is a model of its own).

Usage: called from tools/city_street.py (`python3 -I tools/city_kit.py --street DIR --out DIR`).
"""
import json, os
import numpy as np
from city_ccby import flat_normals, roles_of, simplify
from city_kit_gltf import scene_triangles

# The least triangles a loose part of a baked model keeps (`drop_specks`).
MIN_PART = 12

# key, source id, file under DIR/<source id>/, styles, yaw (deg about Y, front to +Z), fit (x, y, z) m,
# triangles target, options
E2 = [
    # A free-standing cash machine, front at +X: the solid is 0.7 x 1.75 x 0.6 m.
    ('st-atm', 'oga-pixelmannen-atms', 'x/ATM_NORMAL.obj', ['atm'], -90, (0.68, 1.75, 0.58), 400,
     {'obj': {'ATM_CUBE_BODY': 'trim', 'ATM_CUBE_BLACK': 'dark', 'ATM_CUBE_SCREEN': 'win-teal', 'ATM_CUBE_BUTTONS': 'metal',
              'ATM_CUBE_ACCEPT': 'neon-green', 'ATM_CUBE_DECLINE': 'neon-red', 'ATM_CUBE_CARDSLOT': 'neon-cyan', 'ATM_CUBE_CASHSLOT': 'dark'}}),
    # Quaternius' fire hydrant, red (the palette's crimson cloth): the solid is a post 0.17 m round, 0.9 m tall.
    ('st-hydrant', 'quaternius-zombie-kit', 'Environment/glTF/FireHydrant.gltf', ['hydrant'], 0, (0.31, 0.9, 0.24), 300, {'paint': {'brick': 'fabric-magenta'}}),
    # A planter: Kenney's large wooden pot with a bush and red flowers (no solid; the procedural one is 1.2 m).
    ('st-planter', 'kenney-nature-kit', 'x/Models/GLTF format/pot_large.glb', ['planter'], 0, (1.2, 1.15, 1.05), 400,
     {'parts': [('x/Models/GLTF format/plant_bushDetailed.glb', 1.7, (0, 0.13, 0)), ('x/Models/GLTF format/flower_redA.glb', 1.6, (0.12, 0.15, 0.05)),
                ('x/Models/GLTF format/flower_purpleB.glb', 1.6, (-0.15, 0.15, -0.08))],
      'roles': {'wood': 'rust', 'woodBarkDark': 'dark', 'grass': 'plant', 'colorRed': 'fabric-magenta', 'colorPurple': 'neon-violet'}}),
    # Parked at the racks, across the hoops: a city bike (Quaternius) and a scooter (lyricsz), 1.66 m long
    # (the rack's solid is 1.66 m deep); the bike's thin tubes need more triangles than its size suggests.
    ('st-bike', 'quaternius-public-transport', 'OBJ/Bicycle.obj', ['parked-bike'], 0, (0.5, 1.0, 1.66), 700,
     {'obj': {'Bike': 'fabric-teal', 'Handle': 'dark', 'Wheel': 'tyre', 'Material.003': 'trim'}}),
    ('st-scooter', 'oga-lyricsz-bike', 'x/bike.obj', ['parked-scooter'], 90, (0.7, 1.1, 1.66), 280,
     {'obj': {'Material.001': 'fabric-magenta', 'Material.002': 'tyre'}}),
    # The food cart (AVIKA) on the markets: the solid is 3.9 x 2.65 x 1.5 m; its wheels (under 0.45 m) apart.
    ('st-food-cart', 'sketchfab-avika-street-food-cart', 'avika_street_food_cart.glb', ['food-cart'], 0, (3.88, 2.64, 1.48), 650,
     {'bands': [(0, 0.45, 300)], 'posts': (((-1.5, -0.5), (1.25, -0.5), (-1.5, 0.25), (1.25, 0.25)), 1.0, 2.35, 0.05)}),
] + [
    # The shipping container at the Giełda na Kresowej, one model per colour: the solid is 6.06 x 2.6 x 2.44 m.
    (f'st-container-{c}', 'sketchfab-shipping-container', 'classic_shipping_container_freegameready.glb', ['container'], 0, (6.04, 2.58, 2.42), 800,
     {'paint': {'ac': c, 'metal': c, 'trim-light': c, 'trim': c, 'dark': c}}) for c in ('rust', 'dumpster')
]


def is_ccby(source):
    """Is the source CC-BY 4.0 in tools/assets/sources.json (its models carry `extras.credit`)?"""
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'sources.json'), encoding='utf-8') as f:
        return next(s['license'] for s in json.load(f)['sources'] if s['id'] == source) == 'CC-BY-4.0'


def obj_triangles(path):
    """Triangles of an OBJ and the material name of each (fan-split polygons)."""
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
            idx = [i - 1 if i > 0 else len(V) + i for i in idx]
            for k in range(1, len(idx) - 1):
                P.append([V[idx[0]], V[idx[k]], V[idx[k + 1]]])
                mats.append(cur)
    return np.array(P, np.float64), mats


def gltf_part(path, only, table=None):
    """Triangles of a glTF scene with their roles from its colours (or flat materials by `table`),
    optionally of some materials only."""
    P, _, mat, uv, j, blob = scene_triangles(path)
    if only:
        names = [m.get('name', '') for m in j.get('materials', [])]
        sel = np.array([mi >= 0 and names[mi] in only for mi in mat])
        P, mat, uv = P[sel], mat[sel], uv[sel]
    return P, roles_of(mat, uv, j, blob, os.path.dirname(path), table)


def source_triangles(folder, name, opts):
    """The model's triangles and roles before it is turned and fitted."""
    path = os.path.join(folder, name)
    if name.endswith('.obj'):
        P, mats = obj_triangles(path)
        table = opts['obj']
        return P, [table.get(m, 'trim') for m in mats]
    P, roles = gltf_part(path, opts.get('only'), opts.get('roles'))
    for part, scale, at in opts.get('parts', []):
        Q, r = gltf_part(os.path.join(folder, part), None, opts.get('roles'))
        P = np.concatenate([P, Q * scale + np.array(at)])
        roles = roles + r
    return P, roles


def drop_specks(P, roles, min_tris=MIN_PART):
    """Leaves out the loose parts of fewer than `min_tris` triangles that vertex clustering leaves
    behind (a bolt, a bulb on a cut wire, a scrap of a wheel), which would hang in the air."""
    _, vid = np.unique(np.round(P.reshape(-1, 3), 4), axis=0, return_inverse=True)
    tri = vid.reshape(-1, 3)
    parent = np.arange(tri.max() + 1)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    for a, b, c in tri:
        for u, v in ((a, b), (b, c)):
            ru, rv = find(u), find(v)
            if ru != rv:
                parent[ru] = rv
    root = np.array([find(a) for a in tri[:, 0]])
    _, inv, counts = np.unique(root, return_inverse=True, return_counts=True)
    keep = counts[inv] >= min_tris
    return P[keep], [r for r, k in zip(roles, keep) if k]


def simplify_bands(P, roles, target, bands):
    """`simplify` on its own for each band of height (y0, y1, target), metres after the fit, and the
    rest to `target`: small parts in a band (a cart's wheels) keep a finer grid than the whole."""
    cy = P[:, :, 1].mean(1)
    rest = np.ones(len(P), bool)
    outP, outR = [], []
    for y0, y1, t in bands:
        sel = (cy >= y0) & (cy < y1) & rest
        rest &= ~sel
        Q, R = simplify(P[sel], [r for r, k in zip(roles, sel) if k], t)
        outP.append(Q)
        outR += R
    Q, R = simplify(P[rest], [r for r, k in zip(roles, rest) if k], target)
    return np.concatenate(outP + [Q]), outR + R


def bake_e2(folder, name, yaw, fit, target, opts):
    P, roles = source_triangles(folder, name, opts)
    paint = opts.get('paint', {})
    roles = [paint.get(r, r) for r in roles]
    a = np.radians(yaw)
    R = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    P = (P.reshape(-1, 3) @ R.T).reshape(-1, 3, 3)
    # Fit per axis into the box, foot on y = 0, centred on X/Z.
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    P = (P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])) * (np.array(fit) / (hi - lo))
    P, roles = simplify_bands(P, roles, target, opts.get('bands', []))
    P, roles = drop_specks(P, roles)
    if 'posts' in opts:
        # Thin posts the clustering cannot keep, drawn as boxes (the roof of a cart on its corners).
        from city_street import box_tris
        spots, y0, y1, side = opts['posts']
        P = np.concatenate([P] + [box_tris(x, y0, z, side, y1 - y0, side) for x, z in spots])
        roles = roles + ['dark'] * 10 * len(spots)
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    P = P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    return P, flat_normals(P), roles, [round(float(x), 3) for x in hi - lo]
