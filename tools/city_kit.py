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
DIR for Kenney kits is the folder holding the .glb files and Textures/colormap.png.
"""
import argparse, colorsys, io, json, os, struct, zlib
import numpy as np
from PIL import Image

# ---------------------------------------------------------------- glTF reading

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    d = open(path, 'rb').read()
    jl = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    off = 20 + jl
    blob = d[off + 8: off + 8 + struct.unpack('<I', d[off:off + 4])[0]] if off < len(d) else b''
    return j, blob


def accessor(j, blob, i):
    a = j['accessors'][i]
    v = j['bufferViews'][a['bufferView']]
    n = NC[a['type']]
    dt = np.dtype(CT[a['componentType']])
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride', 0) or n * dt.itemsize
    raw = np.frombuffer(blob, dtype=np.uint8, count=stride * (a['count'] - 1) + n * dt.itemsize, offset=start)
    rows = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], n * dt.itemsize), strides=(stride, 1)).copy()
    out = rows.view(dt).reshape(a['count'], n)
    if a.get('normalized') and dt != np.float32:
        out = out.astype(np.float32) / np.iinfo(dt).max
    return out.astype(np.float64)


def quat_matrix(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def node_matrix(n):
    m = np.eye(4)
    if 'matrix' in n:
        return np.array(n['matrix']).reshape(4, 4).T
    s = np.diag(n.get('scale', [1, 1, 1]))
    r = quat_matrix(n.get('rotation', [0, 0, 0, 1]))
    m[:3, :3] = r @ s
    m[:3, 3] = n.get('translation', [0, 0, 0])
    return m


def triangles(path):
    """World-space triangles of a glTF scene: (positions [T,3,3], normals [T,3,3], source colours [T,3] sRGB 0..1,
    emissive [T] bool, material names [T], uv [T,2] or None)."""
    j, blob = read_glb(path)
    mats = j.get('materials', [])
    out = {'p': [], 'n': [], 'mat': [], 'uv': []}

    def visit(ni, parent):
        node = j['nodes'][ni]
        m = parent @ node_matrix(node)
        if 'mesh' in node:
            for pr in j['meshes'][node['mesh']]['primitives']:
                P = accessor(j, blob, pr['attributes']['POSITION'])
                N = accessor(j, blob, pr['attributes']['NORMAL']) if 'NORMAL' in pr['attributes'] else None
                I = accessor(j, blob, pr['indices']).astype(np.int64).reshape(-1, 3) if 'indices' in pr else np.arange(len(P)).reshape(-1, 3)
                Pw = P @ m[:3, :3].T + m[:3, 3]
                if N is None:
                    fn = np.cross(Pw[I[:, 1]] - Pw[I[:, 0]], Pw[I[:, 2]] - Pw[I[:, 0]])
                    Nw = np.repeat(fn[:, None, :], 3, 1)
                else:
                    Nw = (N @ np.linalg.inv(m[:3, :3])).reshape(-1, 3)[I]
                Nw = Nw / np.maximum(np.linalg.norm(Nw, axis=-1, keepdims=True), 1e-9)
                out['p'].append(Pw[I])
                out['n'].append(Nw)
                out['mat'] += [pr.get('material', -1)] * len(I)
                if 'TEXCOORD_0' in pr['attributes']:
                    out['uv'].append(accessor(j, blob, pr['attributes']['TEXCOORD_0'])[I].mean(1))
                else:
                    out['uv'].append(np.full((len(I), 2), np.nan))
        for c in node.get('children', []):
            visit(c, m)

    scene = j['scenes'][j.get('scene', 0)]
    for ni in scene['nodes']:
        visit(ni, np.eye(4))
    return np.concatenate(out['p']), np.concatenate(out['n']), np.array(out['mat']), np.concatenate(out['uv']), mats


# ---------------------------------------------------------------- palette

# name: (hex, kind) with kind "lit" | "tint" | "glow". Order = swatch index (max 256).
SWATCHES = [
    ('wall', '#b4bac4', 'tint'),         # tinted per building; the tint carries the hue
    ('wall-dark', '#868c98', 'tint'),    # plinths, ledges, ground floors
    ('trim', '#3a3f4b', 'lit'),
    ('trim-light', '#5a6170', 'lit'),
    ('roof', '#30343e', 'lit'),
    ('dark', '#15171c', 'lit'),
    ('metal', '#596070', 'lit'),
    ('glass-dark', '#121a24', 'lit'),
    ('glass-blue', '#1d3346', 'lit'),
    ('door', '#1b1514', 'lit'),
    ('fabric-teal', '#167a80', 'lit'),
    ('fabric-magenta', '#8e2457', 'lit'),
    ('fabric-amber', '#9c6a1c', 'lit'),
    ('plant', '#1f4a3a', 'lit'),
    ('paint', '#c8ccd4', 'tint'),         # car paint, tinted per vehicle
    ('tyre', '#18191d', 'lit'),
    ('rust', '#5b3a2c', 'lit'),
    ('dumpster', '#1f5a52', 'lit'),
    ('brick', '#6a4038', 'lit'),
    ('win-warm', '#ffc27a', 'glow'),
    ('win-teal', '#7ff3ff', 'glow'),
    ('win-pink', '#ff8fd8', 'glow'),
    ('shop-warm', '#a87a4c', 'glow'),     # big shop windows: dimmer, they fill whole walls
    ('shop-pink', '#b8579a', 'glow'),
    ('shop-teal', '#3b9ea6', 'glow'),
    ('win-white', '#c9dcf2', 'glow'),
    ('neon-pink', '#ff2e88', 'glow'),
    ('neon-cyan', '#00e5ff', 'glow'),
    ('neon-amber', '#ffb000', 'glow'),
    ('neon-green', '#39ff8a', 'glow'),
    ('neon-violet', '#b46cff', 'glow'),
    ('neon-red', '#ff4040', 'glow'),
    ('neon-blue', '#3f8cff', 'glow'),
    ('office', '#2f6f9a', 'glow'),       # lit office glass of the bank tower
    ('headlight', '#fff6d8', 'glow'),
    ('taillight', '#ff2030', 'glow'),
    # Procedural decor (engine/src/renderer/city-kit.ts).
    ('ac', '#8b929b', 'lit'),
    ('ac-grille', '#2b2f36', 'lit'),
    ('pipe', '#3e444f', 'lit'),
    ('cable', '#0d0f13', 'lit'),
    ('sign-back', '#1a1c22', 'lit'),
]
SW = {name: i for i, (name, _, _) in enumerate(SWATCHES)}
GRID, CELL = 16, 4


def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def palette_images():
    size = GRID * CELL
    albedo = np.zeros((size, size, 4), np.uint8)
    glow = np.zeros((size, size, 4), np.uint8)
    glow[..., 3] = 255
    for i, (_, h, kind) in enumerate(SWATCHES):
        x, y = (i % GRID) * CELL, (i // GRID) * CELL
        rgb = hex_rgb(h)
        albedo[y:y + CELL, x:x + CELL, :3] = rgb
        albedo[y:y + CELL, x:x + CELL, 3] = {'lit': 255, 'tint': 128, 'glow': 0}[kind]
        if kind == 'glow':
            glow[y:y + CELL, x:x + CELL, :3] = rgb
    return albedo, glow


def swatch_uv(i):
    return ((i % GRID) + 0.5) / GRID, ((i // GRID) + 0.5) / GRID


def png_bytes(arr):
    buf = io.BytesIO()
    Image.fromarray(arr, 'RGBA').save(buf, 'PNG', optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------- colour roles

def hsv(rgb):
    return colorsys.rgb_to_hsv(*rgb)


def kenney_building_role(rgb):
    h, s, v = hsv(rgb)
    hd = h * 360
    if s < 0.3:
        # Kenney's greys: white walls, blue-grey plinths and ledges, dark roofs.
        if v > 0.82:
            return 'wall'
        if v > 0.62:
            return 'trim-light'
        if v > 0.44:
            return 'wall-dark'
        if v > 0.27:
            return 'roof'
        return 'dark'
    if 195 <= hd <= 235 and v > 0.55:
        return 'window'
    if 195 <= hd <= 250:
        return 'trim'
    if 80 <= hd < 195:
        return 'fabric-teal' if s > 0.45 else 'plant'
    if 30 <= hd < 60 and s > 0.5:
        return 'fabric-amber'
    if 12 <= hd < 30 and s > 0.5 and v > 0.85:
        return 'shop-warm'
    if 12 <= hd < 40:
        return 'brick'
    if hd >= 330 or hd < 12:
        return 'fabric-magenta'
    if 250 <= hd < 330:
        return 'neon-violet' if v > 0.8 else 'fabric-magenta'
    return 'trim'


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


# ---------------------------------------------------------------- glTF writing

def write_glb(models, albedo_png, glow_png, dst, styles):
    binbuf = bytearray()
    views, accessors, meshes, nodes = [], [], [], []

    def add_view(data, target=None):
        while len(binbuf) % 4:
            binbuf.append(0)
        v = {'buffer': 0, 'byteOffset': len(binbuf), 'byteLength': len(data)}
        if target:
            v['target'] = target
        views.append(v)
        binbuf.extend(data)
        return len(views) - 1

    for m in models:
        pos = m['pos']
        nrm = np.clip(np.round(m['nor'] * 127), -127, 127).astype(np.int8)
        nrm4 = np.zeros((len(nrm), 4), np.int8)
        nrm4[:, :3] = nrm
        uv = np.clip(np.round(m['uv'] * 255), 0, 255).astype(np.uint8)
        uv4 = np.zeros((len(uv), 4), np.uint8)
        uv4[:, :2] = uv
        ind = m['ind'].astype(np.uint16 if len(pos) < 65536 else np.uint32)
        a0 = len(accessors)
        accessors.append({'bufferView': add_view(pos.tobytes(), 34962), 'componentType': 5126, 'count': len(pos), 'type': 'VEC3',
                          'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()})
        v = add_view(nrm4.tobytes(), 34962)
        views[v]['byteStride'] = 4
        accessors.append({'bufferView': v, 'componentType': 5120, 'normalized': True, 'count': len(pos), 'type': 'VEC3'})
        v = add_view(uv4.tobytes(), 34962)
        views[v]['byteStride'] = 4
        accessors.append({'bufferView': v, 'componentType': 5121, 'normalized': True, 'count': len(pos), 'type': 'VEC2'})
        accessors.append({'bufferView': add_view(ind.tobytes(), 34963), 'componentType': 5123 if ind.dtype == np.uint16 else 5125,
                          'count': len(ind), 'type': 'SCALAR'})
        meshes.append({'name': m['key'], 'primitives': [{'attributes': {'POSITION': a0, 'NORMAL': a0 + 1, 'TEXCOORD_0': a0 + 2},
                                                         'indices': a0 + 3, 'material': 0}]})
        nodes.append({'name': m['key'], 'mesh': len(meshes) - 1, 'extras': {'size': m['size'], 'roof': m['roof'], 'styles': styles[m['key']]}})
    img_albedo = add_view(albedo_png)
    img_glow = add_view(glow_png)
    while len(binbuf) % 4:
        binbuf.append(0)
    gltf = {
        'asset': {'version': '2.0', 'generator': 'tools/city_kit.py',
                  'extras': {'swatches': [{'name': n, 'color': h, 'kind': k} for n, h, k in SWATCHES], 'grid': GRID}},
        'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
        'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes,
        'materials': [{'name': 'city-palette', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1},
                       'emissiveTexture': {'index': 1}, 'emissiveFactor': [1, 1, 1]}],
        'samplers': [{'magFilter': 9728, 'minFilter': 9728}],
        'images': [{'name': 'palette', 'bufferView': img_albedo, 'mimeType': 'image/png'},
                   {'name': 'palette-glow', 'bufferView': img_glow, 'mimeType': 'image/png'}],
        'textures': [{'source': 0, 'sampler': 0}, {'source': 1, 'sampler': 0}],
        'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(binbuf)}],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    with open(dst, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binbuf)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack('<II', len(binbuf), 0x004E4942))
        f.write(binbuf)


def main():
    ap = argparse.ArgumentParser()
    for k in ('commercial', 'cars', 'roads', 'neontown', 'out'):
        ap.add_argument('--' + k, required=True)
    args = ap.parse_args()
    dirs = {'commercial': args.commercial, 'cars': args.cars, 'roads': args.roads, 'neontown': args.neontown}
    textures = {}
    out = []
    styles = {}
    for key, kit, name, st, yaw in MODELS:
        if kit != 'neontown' and kit not in textures:
            textures[kit] = np.asarray(Image.open(os.path.join(dirs[kit], 'Textures', 'colormap.png')).convert('RGB')).astype(np.float64) / 255
        m = bake(key, kit, os.path.join(dirs[kit], name + '.glb'), yaw, textures.get(kit))
        out.append(m)
        styles[key] = st
        print(f"{key:14s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {m['size']} roof {m['roof']}")
    albedo, glow = palette_images()
    os.makedirs(args.out, exist_ok=True)
    dst = os.path.join(args.out, 'city-kit.glb')
    write_glb(out, png_bytes(albedo), png_bytes(glow), dst, styles)
    print(dst, f'{os.path.getsize(dst) // 1024} KB')


if __name__ == '__main__':
    main()
