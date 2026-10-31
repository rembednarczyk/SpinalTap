"""Bakes packages/app/public/city/city-props.glb (ADR-0058): facade and street props from CC0 kits on
the city kit's swatch palette (tools/city_kit_palette.py), one mesh per model.

Sources (tools/assets/sources.json, fetched by tools/assets/fetch.mjs):
- Kenney kits (GLB with textures): every triangle takes the mean colour of the texels it covers
  (seven barycentric samples of its UVs), which works for the `colormap.png` palettes of Modular
  Buildings and City Kit Industrial and the pixel textures of Retro Urban alike; the colour goes
  through the building roles of the kit (`kenney_building_role`).
- Quaternius Cyberpunk Game Kit (glTF, flat materials): the role follows the material's name and
  colour; emissive materials become the nearest neon swatch.

Models are turned so their front faces +Z (glTF), scaled to metres, centred on X/Z and stand on
y = 0, like the kit. Node `extras`: {"size": [x, y, z], "styles": [kinds the engine places it as]}.
Called from tools/city_kit.py (`--props DIR --quaternius DIR --ccby DIR`); the CC-BY models of
tools/city_ccby.py (ADR-0063) go into the same file.
"""
import io, json, os, zlib
import numpy as np
from PIL import Image
from city_kit_gltf import png_bytes, scene_triangles, write_glb
from city_kit_palette import GRID, SW, SWATCHES, hsv, kenney_building_role, palette_images, swatch_uv

# Unpacked Kenney kits under --props: <source id>/x/Models/GLB format (tools/assets/fetch.mjs).
KENNEY = {
    'modular': 'kenney-modular-buildings',
    'retro': 'kenney-retro-urban-kit',
    'industrial': 'kenney-city-kit-industrial',
}

# Heaviest model the engine may bake into a cell (ADR-0058).
MAX_TRIS = 1500

FABRICS = ('fabric-teal', 'fabric-magenta', 'fabric-amber')

# key, source, file, styles, yaw (deg about glTF Y, front to +Z), scale (to metres), options
#   fabric: an awning: the whole model takes this cloth swatch
#   roles: material name (Quaternius) -> swatch, over the defaults
#   unlit: emissive materials are painted (saturated -> fabric-amber, else trim-light), not neon
PROPS = [
    # Air conditioners: Quaternius on the walls and roofs, Kenney's as the cheap phone version.
    ('pr-ac-box', 'quaternius', 'Platforms/AC', ['ac-wall', 'ac-roof'], 0, 0.85, {}),
    ('pr-ac-side', 'quaternius', 'Platforms/AC_Side', ['ac-wall'], 0, 0.6, {}),
    # Its emissive "sign" strip is a painted warning label on an air conditioner: not a neon.
    ('pr-ac-stack', 'quaternius', 'Platforms/AC_Stacked', ['ac-roof', 'ac-firewall'], 0, 1.0, {'unlit': True}),
    ('pr-ac-lite-a', 'modular', 'detail-ac-a', ['ac-roof', 'lite'], 0, 3.5, {}),
    ('pr-ac-lite-b', 'modular', 'detail-ac-b', ['ac-wall', 'lite'], 0, 3.0, {}),
    # Antennas and dishes.
    ('pr-antenna', 'quaternius', 'Platforms/Antenna_1', ['antenna'], 0, 1.5, {}),
    ('pr-dish', 'quaternius', 'Platforms/Antenna_2', ['dish'], 0, 1.3, {}),
    # Pipes: a straight run and an elbow.
    ('pr-pipe', 'quaternius', 'Platforms/Pipe_1', ['pipe'], 0, 1.0, {'roles': {'Orange': 'rust'}}),
    ('pr-pipe-corner', 'quaternius', 'Platforms/Pipe_Corner', ['pipe-corner'], 0, 1.0, {'roles': {'Orange': 'rust'}}),
] + [
    # Awnings over shop windows, one model per cloth colour (the cell mesh has no per-prop tint).
    (f'pr-awning-wide-{f[7:]}', 'retro', 'detail-awning-wide', ['awning'], 180, 3.0, {'fabric': f}) for f in FABRICS
] + [
    (f'pr-awning-small-{f[7:]}', 'retro', 'detail-awning-small', ['awning'], 180, 3.0, {'fabric': f}) for f in FABRICS
] + [
    (f'pr-awning-flat-{f[7:]}', 'modular', 'roof-flat-awning-a', ['awning-flat'], 0, 3.0, {'fabric': f}) for f in FABRICS[:2]
] + [
    (f'pr-awning-flat-c-{f[7:]}', 'modular', 'roof-flat-awning-c', ['awning-flat'], 0, 3.0, {'fabric': f}) for f in FABRICS[1:]
]

# Quaternius' flat materials by name.
QUATERNIUS_ROLES = {
    'LightGrey': 'ac', 'Grey': 'metal', 'DarkGrey': 'dark', 'Black': 'ac-grille', 'MetalLight': 'metal',
    'Orange': 'fabric-amber', 'White': 'trim-light',
}

NEONS = [n for n, _, k in SWATCHES if n.startswith('neon-') and k == 'glow']

# Barycentric samples of a triangle for its mean texel.
BARY = np.array([[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6], [0.8, 0.1, 0.1], [0.1, 0.8, 0.1], [0.1, 0.1, 0.8]])


def to_srgb(c):
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.maximum(c, 0), 1 / 2.4) - 0.055)


def nearest_neon(rgb):
    h, s, v = hsv(tuple(rgb))
    best, dist = 'neon-cyan', 9.0
    for name in NEONS:
        hx = SWATCHES[SW[name]][1]
        nh, _, _ = hsv(tuple(int(hx[i:i + 2], 16) / 255 for i in (1, 3, 5)))
        d = min(abs(h - nh), 1 - abs(h - nh))
        if d < dist:
            best, dist = name, d
    return best if s > 0.15 else 'win-white'


def material_image(j, blob, mat, folder, slot):
    """The image of a material's texture slot as float RGB 0..1, or None. External images must lie
    in the model's own folder or its Textures/."""
    tex = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture') if slot == 'base' else mat.get('emissiveTexture')
    if not tex:
        return None
    img = j['images'][j['textures'][tex['index']]['source']]
    if 'bufferView' in img:
        v = j['bufferViews'][img['bufferView']]
        data = blob[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
        im = Image.open(io.BytesIO(data))
    else:
        uri = img['uri']
        parts = uri.replace('\\', '/').split('/')
        if '..' in parts or uri.startswith('/') or ':' in uri or len(parts) > 2:
            raise ValueError(f'image outside the kit: {uri}')
        im = Image.open(os.path.join(folder, *parts))
    return np.asarray(im.convert('RGBA').convert('RGB')).astype(np.float64) / 255


def texel_mean(img, uv):
    """Mean colour of a triangle's texels: uv [3, 2] (glTF, v down)."""
    pts = BARY @ uv
    h, w = img.shape[:2]
    px = np.clip(((pts[:, 0] % 1) * w).astype(int), 0, w - 1)
    py = np.clip(((pts[:, 1] % 1) * h).astype(int), 0, h - 1)
    return img[py, px].mean(0)


def kenney_roles(P, mat, uv, j, blob, folder, fabric):
    mats = j.get('materials', [])
    images = {}
    roles = []
    for t in range(len(P)):
        mi = int(mat[t])
        if mi not in images:
            images[mi] = material_image(j, blob, mats[mi], folder, 'base') if mi >= 0 else None
        img = images[mi]
        factor = np.array(mats[mi].get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])[:3]) if mi >= 0 else np.ones(3)
        rgb = (texel_mean(img, uv[t]) if img is not None and not np.isnan(uv[t]).any() else np.ones(3)) * to_srgb(factor)
        # An awning is cloth through and through: Retro Urban's are a dark roof texture.
        role = fabric or kenney_building_role(tuple(rgb))
        roles.append(role)
    return roles


def quaternius_roles(mat, uv, j, blob, folder, overrides, unlit=False):
    mats = j.get('materials', [])
    table = {**QUATERNIUS_ROLES, **overrides}
    roles = []
    for t in range(len(mat)):
        mi = int(mat[t])
        m = mats[mi] if mi >= 0 else {}
        emissive = m.get('emissiveTexture') is not None or max(m.get('emissiveFactor', [0, 0, 0])) > 0.05
        if emissive:
            img = material_image(j, blob, m, folder, 'emissive')
            rgb = texel_mean(img, uv[t]) if img is not None and not np.isnan(uv[t]).any() else np.array(m.get('emissiveFactor', [1, 1, 1]))
            if unlit:
                roles.append('fabric-amber' if hsv(tuple(rgb))[1] > 0.15 else 'trim-light')
            else:
                roles.append(nearest_neon(rgb))
            continue
        name = m.get('name', '')
        if name in table:
            roles.append(table[name])
            continue
        _, _, v = hsv(tuple(to_srgb(np.array(m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [0.5, 0.5, 0.5, 1])[:3]))))
        roles.append('ac' if v > 0.5 else 'metal' if v > 0.3 else 'dark')
    return roles


def bake_prop(key, path, folder, kind, yaw, scale, opts):
    P, N, mat, uv, j, blob = scene_triangles(path)
    if kind == 'quaternius':
        roles = quaternius_roles(mat, uv, j, blob, folder, opts.get('roles', {}), opts.get('unlit', False))
    else:
        roles = kenney_roles(P, mat, uv, j, blob, folder, opts.get('fabric'))
    a = np.radians(yaw)
    R = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    P = (P.reshape(-1, 3) @ R.T * scale).reshape(-1, 3, 3)
    N = (N.reshape(-1, 3) @ R.T).reshape(-1, 3, 3)
    lo, hi = P.reshape(-1, 3).min(0), P.reshape(-1, 3).max(0)
    P = P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    size = hi - lo
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
    if tris > MAX_TRIS:
        raise ValueError(f'{key}: {tris} triangles, over {MAX_TRIS}')
    return {'key': key, 'pos': np.array(pos, np.float32), 'nor': np.array(nor), 'uv': np.array(uvs), 'ind': np.array(ind, np.uint32),
            'size': [round(float(x), 3) for x in size], 'roles': sorted(set(roles))}


def source_path(props_dir, quaternius_dir, source, name):
    if source == 'quaternius':
        return quaternius_dir, os.path.join(quaternius_dir, name + '.gltf')
    folder = os.path.join(props_dir, KENNEY[source], 'x', 'Models', 'GLB format')
    return folder, os.path.join(folder, name + '.glb')


def build_props(props_dir, quaternius_dir, ccby_dir, out_dir):
    out, extras = [], {}
    for key, source, name, styles, yaw, scale, opts in PROPS:
        folder, path = source_path(props_dir, quaternius_dir, source, name)
        # Images of a Quaternius model sit in the model's folder or the kit's Textures/.
        m = bake_prop(key, path, os.path.dirname(path) if source == 'quaternius' else folder, 'quaternius' if source == 'quaternius' else 'kenney', yaw, scale, opts)
        out.append(m)
        extras[key] = {'size': m['size'], 'styles': styles}
        print(f"{key:24s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {m['size']} roles {','.join(m['roles'])}")
    # The CC-BY models after the CC0 ones (ADR-0063): the CC0 meshes keep their bytes.
    from city_ccby import build_ccby  # it uses this module's colour helpers
    ccby, ccby_extras = build_ccby(ccby_dir, swatch_uv)
    for m in ccby:
        print(f"{m['key']:24s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {m['size']} roles {','.join(m['roles'])} credit {ccby_extras[m['key']]['credit']}")
    out += ccby
    extras.update(ccby_extras)
    albedo, glow = palette_images()
    dst = os.path.join(out_dir, 'city-props.glb')
    write_glb(out, png_bytes(albedo), png_bytes(glow), dst, extras, SWATCHES, GRID)
    print(dst, f'{os.path.getsize(dst) // 1024} KB', 'crc', format(zlib.crc32(open(dst, 'rb').read()), '08x'))
    return json.dumps(extras)
