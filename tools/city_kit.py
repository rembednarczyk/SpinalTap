"""Builds packages/app/public/city/city-kit.glb: buildings, vehicles and street props from CC0 kits,
repainted for night-time Shinsekai (ADR-0021).

Every model is baked onto one shared 16x16 swatch palette (embedded PNG, 4 px per swatch): the
source colours (Kenney's colormap texels, Neon Town's flat and emissive materials) are sorted
into roles (wall, trim, window, neon...) and each role gets a cyberpunk swatch. The swatch's
alpha tells the toon shader how to light it: 255 lit, 128 lit and tinted per building (walls,
car paint), 0 self-lit (neon, lit windows). A second PNG, the glow palette, holds the colour of
the self-lit swatches only and drives the glow layer. Windows are lit or dark per pane, seeded,
so each model has its own pattern.

Models are rotated so their street front faces +Z (glTF), centred on X/Z and stand on y = 0, in
metres. One glTF mesh per model, named by its key; `extras` of each node: {"size": [x, y, z],
"roof": height of the main roof, "styles": [...]}. The swatch table (name, colour, kind) goes in
the asset's `extras.swatches`: the engine builds the palette textures from it and names the
swatches of its procedural decor (AC units, cables, sign backs) on the same palette.

Usage (each source an unpacked kit; the zips are listed in the README next to the output):
  python3 -I tools/city_kit.py --commercial DIR --cars DIR --roads DIR --neontown DIR --out DIR
  python3 -I tools/city_kit.py --props DIR --quaternius DIR --ccby DIR --out DIR
  python3 -I tools/city_kit.py --street DIR --out DIR
  python3 -I tools/city_kit.py --market DIR --out DIR
  python3 -I tools/city_kit.py --doors DIR --out DIR
DIR for Kenney kits is the folder holding the .glb files and Textures/colormap.png. The second
form bakes city-props.glb (ADR-0058, tools/city_props.py): --props is the folder
`tools/assets/fetch.mjs` filled (one unpacked Kenney kit per source id), --quaternius the
Cyberpunk Game Kit's folder holding Platforms/, --ccby the same folder for the CC-BY models
(ADR-0063, tools/city_ccby.py: DIR/<source id>/<file>.glb). The third bakes street-props.glb, the
street furniture of the second Sketchfab pack (tools/city_street.py), from the same kind of folder.
The fourth bakes market-props.glb, the market's furniture of ADR-0058 stage 3 (tools/city_market.py).
The fifth bakes door-props.glb, the leaves of the doors on the facades of ADR-0058 stage 9 (tools/city_doors.py).
"""
import argparse, os, sys, zlib
import numpy as np
from PIL import Image

# With -I the script's folder is not on the path: the helpers next to it are imported explicitly.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from city_kit_gltf import png_bytes, triangles, write_glb  # noqa: E402
from city_kit_palette import GRID, SW, SWATCHES, hsv, kenney_building_role, palette_images, swatch_uv  # noqa: E402

# Palette and the colour roles of Kenney building colours: tools/city_kit_palette.py.

def kenney_vehicle_role(rgb, paint_hue):
    h, s, v = hsv(rgb)
    hd = h * 360
    if paint_hue is not None and s > 0.3 and min(abs(hd - paint_hue), 360 - abs(hd - paint_hue)) < 25:
        return 'paint'
    if s < 0.2:
        if v > 0.9:
            return 'glass-dark'
        if v > 0.55:
            return 'metal'
        return 'tyre' if v < 0.3 else 'trim'
    if (hd >= 340 or hd < 15) and s > 0.6:
        return 'taillight'
    if 40 <= hd < 65 and v > 0.85:
        return 'headlight'
    return 'trim'


NEON_TOWN_ROLES = {
    'window-lightsoff': 'glass-dark', 'window-lightson': 'window', 'doors': 'door', 'black': 'dark',
    'metallic': 'metal', 'bar-walls': 'wall', 'store-walls': 'wall', 'pharmacy-walls': 'wall',
    'bank-walls': 'wall', 'pharmacy-frames': 'trim-light', 'store-sign': 'trim-light',
    'bar-lights': 'shop-pink', 'store-lights': 'shop-warm', 'pharmacy-lights': 'shop-teal',
    'bar-sign-arrow': 'neon-blue', 'bar-sign-text': 'neon-red', 'store-sign-light': 'neon-cyan',
    'pharmacy-sign': 'neon-green', 'bank-sign': 'neon-green', 'bank-windows': 'office',
    'trash container': 'dumpster',
}

# ---------------------------------------------------------------- models

KENNEY_SCALE = 8.0  # Kenney city kits: one floor is 0.4 units, 3.2 m here.

# key, kit, file, styles (for the engine's catalogue), yaw (deg, glTF Y) to turn the front to +Z
MODELS = [
    # Kenney City Kit Commercial: low-rise shops and tenements, front at -Z.
    ('kc-a', 'commercial', 'building-a', ['shop', 'tenement'], 180),
    ('kc-b', 'commercial', 'building-b', ['tenement'], 180),
    ('kc-c', 'commercial', 'building-c', ['shop', 'tenement'], 180),
    ('kc-d', 'commercial', 'building-d', ['shop', 'tenement'], 180),
    ('kc-f', 'commercial', 'building-f', ['shop', 'tenement'], 180),
    ('kc-g', 'commercial', 'building-g', ['shop', 'tenement'], 180),
    ('kc-h', 'commercial', 'building-h', ['tenement'], 180),
    ('kc-k', 'commercial', 'building-k', ['shop', 'tenement'], 180),
    ('kc-l', 'commercial', 'building-l', ['tenement', 'tower'], 180),
    ('kc-m', 'commercial', 'building-m', ['tenement', 'tower'], 180),
    ('kc-sa', 'commercial', 'building-skyscraper-a', ['tower'], 180),
    ('kc-sb', 'commercial', 'building-skyscraper-b', ['tower'], 180),
    ('kc-sc', 'commercial', 'building-skyscraper-c', ['tower'], 180),
    ('kc-se', 'commercial', 'building-skyscraper-e', ['tower'], 180),
    # Neon Town (leonkin): storefronts with their own neon, front at +X.
    ('nt-bar', 'neontown', 'bar', ['bar'], -90),
    ('nt-store', 'neontown', 'store', ['shop'], -90),
    ('nt-pharmacy', 'neontown', 'pharmacy', ['shop'], -90),
    ('nt-bank', 'neontown', 'bank', ['tower'], -90),
    # Kenney Car Kit, front at +Z.
    ('car-van', 'cars', 'van', ['van'], 0),
    ('car-delivery', 'cars', 'delivery', ['van'], 0),
    ('car-sedan', 'cars', 'sedan', ['car'], 0),
    ('car-taxi', 'cars', 'taxi', ['car'], 0),
    ('car-hatchback', 'cars', 'hatchback-sports', ['car'], 0),
    ('car-wreck', 'cars', 'sedan', ['wreck'], 0),
    # Kenney City Kit Roads.
    ('dumpster', 'roads', 'dumpster', ['dumpster'], 0),
]


SHOP_GLASS = {'win-warm': 'shop-warm', 'win-pink': 'shop-pink', 'win-teal': 'shop-teal', 'win-white': 'shop-teal'}


def window_panes(P, idx, rng, lit_share, scale):
    """Lit or dark per window pane: panes are connected groups of window triangles."""
    keys = {}
    parent = list(range(len(idx)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for t, ti in enumerate(idx):
        for v in P[ti]:
            k = tuple(np.round(v, 3))
            if k in keys:
                ra, rb = find(t), find(keys[k])
                if ra != rb:
                    parent[ra] = rb
            else:
                keys[k] = t
    area = {}
    for t, ti in enumerate(idx):
        r = find(t)
        a, b, c = P[ti]
        area[r] = area.get(r, 0) + np.linalg.norm(np.cross(b - a, c - a)) / 2 * scale * scale
    roots = {}
    out = []
    lit = ['win-warm', 'win-warm', 'win-warm', 'win-teal', 'win-white', 'win-pink']
    for t in range(len(idx)):
        r = find(t)
        if r not in roots:
            x = rng.random()
            if area[r] > 12:
                # Curtain walls: a lit office floor here and there, the rest dark glass.
                roots[r] = 'office' if x < 0.3 else 'shop-warm' if x < 0.4 else 'glass-blue'
            else:
                pane = lit[rng.integers(len(lit))] if x < lit_share else 'glass-dark'
                # Storefront glass (a few square metres) would fill the wall with full glow.
                roots[r] = SHOP_GLASS.get(pane, pane) if area[r] > 3 else pane
        out.append(roots[r])
    return out


def bake(key, kit, path, yaw, tex):
    P, N, mat, uv, mats = triangles(path)
    roles = []
    if kit == 'neontown':
        for mi in mat:
            name = mats[mi].get('name', '') if mi >= 0 else ''
            roles.append(NEON_TOWN_ROLES.get(name, 'trim'))
    else:
        h, w = tex.shape[:2]
        px = np.clip((uv[:, 0] % 1) * w, 0, w - 1).astype(int)
        py = np.clip((uv[:, 1] % 1) * h, 0, h - 1).astype(int)
        src = tex[py, px, :3]
        if kit == 'cars':
            # The paint is the most used saturated colour.
            area = np.linalg.norm(np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]), axis=1)
            acc = {}
            for c, a in zip(map(tuple, src), area):
                hh, ss, _ = hsv(c)
                if ss > 0.3:
                    b = int(hh * 36)
                    acc[b] = acc.get(b, 0) + a
            paint_hue = (max(acc, key=acc.get) + 0.5) * 10 if acc else None
            roles = [kenney_vehicle_role(tuple(c), paint_hue) for c in src]
        else:
            roles = [kenney_building_role(tuple(c)) for c in src]
    rng = np.random.default_rng(zlib.crc32(key.encode()))
    win = [i for i, r in enumerate(roles) if r == 'window']
    if win:
        for i, r in zip(win, window_panes(P, win, rng, 0.45, KENNEY_SCALE if kit == 'commercial' else 1.0)):
            roles[i] = r
    if key == 'car-wreck':
        roles = ['rust' if r == 'paint' else 'dark' if SWATCHES[SW[r]][2] == 'glow' else r for r in roles]
    # Turn the front to +Z, scale to metres, centre on X/Z, stand on y = 0.
    a = np.radians(yaw)
    R = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    scale = KENNEY_SCALE if kit in ('commercial', 'roads') else 1.0
    P = (P.reshape(-1, 3) @ R.T * scale).reshape(-1, 3, 3)
    N = (N.reshape(-1, 3) @ R.T).reshape(-1, 3, 3)
    lo, hi = P.reshape(-1, 3).min(0), P.reshape(-1, 3).max(0)
    P = P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    size = hi - lo
    # Roof: the highest level holding a fair share of the upward-facing area (parapets, tanks and
    # stair housings stand above it). The engine puts it at the top of the collision box.
    up = N[:, :, 1].mean(1) > 0.9
    tri_area = np.linalg.norm(np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]), axis=1) / 2
    heights = np.round(P[:, :, 1].mean(1), 1)
    levels = {}
    for hgt, a, u in zip(heights, tri_area, up):
        if u and hgt > size[1] * 0.5:
            levels[hgt] = levels.get(hgt, 0) + a
    total_top = sum(levels.values())
    roof = min(size[1], max((hgt for hgt, a in levels.items() if a >= 0.25 * total_top), default=size[1]))
    # Weld vertices sharing position, normal and swatch.
    verts = {}
    pos, nor, uvs, ind = [], [], [], []
    for t in range(len(P)):
        s = SW[roles[t]]
        for k in range(3):
            p = np.round(P[t, k], 4)
            n = np.round(N[t, k], 2)
            vk = (tuple(p), tuple(n), s)
            vi = verts.get(vk)
            if vi is None:
                vi = verts[vk] = len(pos)
                pos.append(p)
                nor.append(N[t, k])
                uvs.append(swatch_uv(s))
            ind.append(vi)
    return {'key': key, 'pos': np.array(pos, np.float32), 'nor': np.array(nor), 'uv': np.array(uvs), 'ind': np.array(ind, np.uint32),
            'size': [round(float(x), 3) for x in size], 'roof': round(float(roof), 3)}


def build_kit(dirs, out_dir):
    textures = {}
    out = []
    extras = {}
    for key, kit, name, st, yaw in MODELS:
        if kit != 'neontown' and kit not in textures:
            textures[kit] = np.asarray(Image.open(os.path.join(dirs[kit], 'Textures', 'colormap.png')).convert('RGB')).astype(np.float64) / 255
        m = bake(key, kit, os.path.join(dirs[kit], name + '.glb'), yaw, textures.get(kit))
        out.append(m)
        extras[key] = {'size': m['size'], 'roof': m['roof'], 'styles': st}
        print(f"{key:14s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {m['size']} roof {m['roof']}")
    albedo, glow = palette_images()
    dst = os.path.join(out_dir, 'city-kit.glb')
    write_glb(out, png_bytes(albedo), png_bytes(glow), dst, extras, SWATCHES, GRID)
    print(dst, f'{os.path.getsize(dst) // 1024} KB')


def main():
    ap = argparse.ArgumentParser()
    kit_args = ('commercial', 'cars', 'roads', 'neontown')
    for k in kit_args + ('props', 'quaternius', 'ccby', 'street', 'market', 'doors'):
        ap.add_argument('--' + k)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    kit = [getattr(args, k) for k in kit_args]
    props = [args.props, args.quaternius, args.ccby]
    if any(kit) and not all(kit):
        ap.error('the city kit needs all of --commercial --cars --roads --neontown')
    if any(props) and not all(props):
        ap.error('the props need all of --props --quaternius --ccby')
    if not any(kit) and not any(props) and not args.street and not args.market and not args.doors:
        ap.error('nothing to build')
    os.makedirs(args.out, exist_ok=True)
    if all(kit):
        build_kit(dict(zip(kit_args, kit)), args.out)
    if all(props):
        from city_props import build_props
        build_props(args.props, args.quaternius, args.ccby, args.out)
    if args.street:
        from city_street import build_street
        build_street(args.street, args.out)
    if args.market:
        from city_market import build_market
        build_market(args.market, args.out)
    if args.doors:
        from city_doors import build_doors
        build_doors(args.doors, args.out)


if __name__ == '__main__':
    main()
