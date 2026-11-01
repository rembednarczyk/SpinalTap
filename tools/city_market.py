"""The market's furniture of ADR-0058 stage 3 in packages/app/public/city/market-props.glb, on the city kit's
swatch palette like city-props.glb and street-props.glb (both near their 512 KiB limits, so this file is a
third one; the engine loads it after them and merges the three, `mergeCityProps`).

CC0 sources only (tools/assets/sources.json, fetched by tools/assets/fetch.mjs into DIR/<source id>/): Kenney's
Food Kit, Mini Market, Survival Kit (GLBs on a colour map) and Furniture Pack (OBJ with flat MTL colours).
Each model is put together from parts of those packs in its own frame, front +Z, foot on y = 0, in metres:
- the market's stock (style `market-goods`, one model per shape of sim `MARKET_GOODS`, in shape order),
  each fitted per axis into its shape's solid: cartons on a pallet, barrels, crates of produce, goods
  under a canvas on posts;
- the food booth (style `food-stall`) in the frame of sim `FOOD_STALL`, not fitted: the counter where the
  solid's counter is, the roof's posts on the solid's posts, the stools on the solid's stools, and a noren
  of cloth strips along the roof's front (boxes on the palette's cloth swatches);
- the goods on a counter (style `counter-goods`, small things the engine bakes only into the near mesh of
  the furniture's block and never on phones): a ramen pot and bowls, produce, drinks, on a 2 x 0.5 m top.

Per model: colours per triangle from the colour map (`city_ccby.roles_of`), `paint` role remaps per part,
simplified by vertex clustering to `target` triangles, loose specks dropped (`city_street_e2.drop_specks`).
Node `extras`: {"size", "styles"}; no credit, the sources are CC0.

Usage: python3 -I tools/city_kit.py --market DIR --out DIR (DIR as filled by tools/assets/fetch.mjs).
"""
import os, zlib
import numpy as np
from city_ccby import flat_normals, simplify, weld
from city_kit_gltf import png_bytes, write_glb
from city_kit_palette import GRID, SWATCHES, palette_images, swatch_uv
from city_street import box_tris
from city_street_e2 import drop_specks, gltf_part, obj_triangles

SURVIVAL = ('kenney-survival-kit', 'x/Models/GLB format/')
FOOD = ('kenney-food-kit', 'x/Models/GLB format/')
MARKET = ('kenney-mini-market', 'x/Models/GLB format/')
FURNITURE = ('kenney-furniture-kit', 'x/Models/')

# Cardboard: the colour map's tan reads as brick; the palette's amber cloth is nearer.
CARDBOARD = {'brick': 'fabric-amber'}

# The Furniture Pack's flat MTL colours by name.
FURNITURE_ROLES = {'wood': 'fabric-amber', 'woodDark': 'rust', 'metal': 'metal', 'carpet': 'fabric-magenta'}


def part(pack, name, scale, at=(0, 0, 0), yaw=0, paint=None):
    """A part: a model of a pack, scaled (a number, or per axis), turned `yaw` degrees about Y and moved to `at`."""
    return {'src': pack[0], 'file': pack[1] + name, 'scale': scale, 'at': at, 'yaw': yaw, 'paint': paint or {}}


def noren(y0, y1, z, x0, x1, n):
    """The noren: `n` cloth strips side by side from x0 to x1 hanging from y1 to y0 at z, cloth colours by turns."""
    w = (x1 - x0) / n
    cloth = ('fabric-magenta', 'fabric-teal', 'fabric-amber')
    return [((x0 + w * (k + 0.5), y0, z), (w - 0.04, y1 - y0, 0.02), cloth[k % len(cloth)]) for k in range(n)]


# key, styles, parts, fit (x, y, z) m or None to keep the frame, triangles target, boxes ((centre-bottom), (w, h, d), role)
MODELS = [
    # The stock, one per shape: the solids are 1.2 x 1.0 x 0.8, 1.24 x 0.95 x 0.64, 1.1 x 0.9 x 0.8 and 1.4 x 1.4 x 1.0 m.
    ('mk-cartons', ['market-goods'], [
        part(SURVIVAL, 'resource-planks.glb', (1.9, 1.6, 1.25), (0, 0, 0), 90),
        part(SURVIVAL, 'box-large.glb', 1.6, (-0.21, 0.15, 0), paint=CARDBOARD), part(SURVIVAL, 'box-large.glb', 1.6, (0.21, 0.15, 0), paint=CARDBOARD),
        part(SURVIVAL, 'box.glb', 1.6, (-0.1, 0.55, 0.05), paint=CARDBOARD),
    ], (1.18, 0.98, 0.78), 500, []),
    ('mk-barrels', ['market-goods'], [
        part(SURVIVAL, 'barrel.glb', 2.6, (-0.31, 0, 0)), part(SURVIVAL, 'barrel.glb', 2.6, (0.31, 0, 0), paint={'brick': 'fabric-teal'}),
    ], (1.22, 0.93, 0.62), 600, []),
    ('mk-crates', ['market-goods'], [
        part(MARKET, 'display-fruit.glb', 0.9, (-0.275, 0, 0)), part(MARKET, 'display-fruit.glb', 0.9, (0.275, 0, 0)),
        part(MARKET, 'display-fruit.glb', 0.85, (-0.275, 0.46, 0), paint=CARDBOARD),
    ], (1.08, 0.88, 0.78), 600, []),
    ('mk-canvas', ['market-goods'], [
        part(SURVIVAL, 'structure-canvas.glb', (2.76, 2.76, 1.96), (0, 0, 0), paint={'fabric-amber': 'fabric-teal'}),
        part(SURVIVAL, 'box-large.glb', 1.6, (-0.3, 0, 0), paint=CARDBOARD), part(SURVIVAL, 'barrel.glb', 2.0, (0.35, 0, 0.05)),
    ], (1.38, 1.38, 0.98), 500, []),
    # The food booth (sim FOOD_STALL): the counter 2.1 x 1.05 x 0.6 m round z 0.1, the posts at x +-1.05,
    # z -0.7 and 0.4, the roof 2.4 m up, three stools at z 0.85.
    ('mk-yatai', ['food-stall'], [
        part(FURNITURE, 'kitchenBar.obj', 0.244, (-0.525, 0, 0.1)), part(FURNITURE, 'kitchenBar.obj', 0.244, (0.525, 0, 0.1)),
        part(SURVIVAL, 'structure-canvas.glb', (4.2, 4.8, 2.2), (0, 0, -0.15), paint={'fabric-amber': 'rust'}),
        part(FOOD, 'pot-stew.glb', 0.55, (0.55, 1.02, 0.05)), part(FOOD, 'bowl-broth.glb', 0.45, (-0.2, 1.02, 0.15)),
        part(FOOD, 'bowl-broth.glb', 0.45, (-0.6, 1.02, 0.1)),
    ] + [part(FURNITURE, 'stoolBar.obj', 0.15, (x, 0, 0.85)) for x in (-0.65, 0, 0.65)], None, 1400,
        noren(1.85, 2.38, 0.47, -1.05, 1.05, 4)),
    # The goods on a counter, on a 2 x 0.5 m top.
    ('mk-counter-ramen', ['counter-goods'], [
        part(FOOD, 'pot-stew.glb', 0.5, (-0.6, 0, 0)), part(FOOD, 'steamer.glb', 0.45, (0.05, 0, 0)),
        part(FOOD, 'bowl-broth.glb', 0.4, (0.55, 0, -0.05)), part(FOOD, 'bowl-broth.glb', 0.4, (0.85, 0, 0.05)),
        part(FOOD, 'skewer.glb', 0.7, (-0.15, 0, 0.18)),
    ], None, 300, []),
    ('mk-counter-produce', ['counter-goods'], [
        part(FOOD, 'cabbage.glb', 0.7, (-0.75, 0, 0)), part(FOOD, 'watermelon.glb', 0.6, (-0.35, 0, 0)),
        part(FOOD, 'pineapple.glb', 0.8, (0.0, 0, 0)), part(FOOD, 'apple.glb', 0.8, (0.25, 0, 0.08)),
        part(FOOD, 'apple.glb', 0.8, (0.4, 0, -0.05)), part(FOOD, 'tomato.glb', 0.9, (0.6, 0, 0.05)),
        part(FOOD, 'tomato.glb', 0.9, (0.78, 0, -0.06)), part(FOOD, 'carrot.glb', 0.6, (0.92, 0, 0.1)),
    ], None, 300, []),
    ('mk-counter-drinks', ['counter-goods'], [
        part(FOOD, f, s, (x, 0, z)) for f, s, x, z in (
            ('soda-can.glb', 0.6, -0.8, 0.0), ('soda-can.glb', 0.6, -0.65, 0.1), ('soda-can.glb', 0.6, -0.5, -0.05),
            ('carton.glb', 0.9, -0.2, 0.0), ('carton.glb', 0.9, 0.0, 0.05), ('soda.glb', 0.7, 0.3, 0.0),
            ('cup-coffee.glb', 0.6, 0.55, 0.05), ('cup-coffee.glb', 0.6, 0.75, -0.05))
    ], None, 300, []),
]

MAX_TRIS = 1500


def part_triangles(folder, p):
    """A part's triangles in the model's frame and their roles."""
    path = os.path.join(folder, p['src'], p['file'])
    if p['file'].endswith('.obj'):
        P, mats = obj_triangles(path)
        roles = [FURNITURE_ROLES.get(m, 'trim') for m in mats]
    else:
        P, roles = gltf_part(path, None)
    roles = [p['paint'].get(r, r) for r in roles]
    # Its own foot on y = 0 and its middle on X/Z, then scaled, turned and moved.
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    P = (P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])) * np.array(p['scale'] if isinstance(p['scale'], tuple) else (p['scale'],) * 3)
    a = np.radians(p['yaw'])
    R = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    P = (P.reshape(-1, 3) @ R.T).reshape(-1, 3, 3) + np.array(p['at'])
    return P, roles


def bake_market(folder, parts, fit, target, boxes):
    Ps, roles = [], []
    for p in parts:
        P, r = part_triangles(folder, p)
        Ps.append(P)
        roles += r
    P = np.concatenate(Ps)
    if fit:
        # Fit per axis into the solid's box, foot on y = 0, centred on X/Z.
        flat = P.reshape(-1, 3)
        lo, hi = flat.min(0), flat.max(0)
        P = (P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])) * (np.array(fit) / (hi - lo))
    P, roles = simplify(P, roles, target)
    P, roles = drop_specks(P, roles)
    for (x, y, z), (w, h, d), role in boxes:
        P = np.concatenate([P, box_tris(x, y, z, w, h, d)])
        roles = roles + [role] * 10
    flat = P.reshape(-1, 3)
    return P, flat_normals(P), roles, [round(float(v), 3) for v in flat.max(0) - flat.min(0)]


def build_market(folder, out_dir):
    out, extras = [], {}
    for key, styles, parts, fit, target, boxes in MODELS:
        P, N, roles, size = bake_market(folder, parts, fit, target, boxes)
        m = weld(key, P, N, roles, swatch_uv, MAX_TRIS)
        out.append(m)
        extras[key] = {'size': size, 'styles': styles}
        print(f"{key:20s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {size} roles {','.join(sorted(set(roles)))}")
    albedo, glow = palette_images()
    dst = os.path.join(out_dir, 'market-props.glb')
    write_glb(out, png_bytes(albedo), png_bytes(glow), dst, extras, SWATCHES, GRID)
    print(dst, f'{os.path.getsize(dst) // 1024} KB', 'crc', format(zlib.crc32(open(dst, 'rb').read()), '08x'))
