"""The doors on the facades of ADR-0058 stage 9 in packages/app/public/city/door-props.glb, on the city kit's
swatch palette like the other props files (the engine loads it after them and merges them, `mergeCityProps`).

The leaves of the doors, from the user's second Sketchfab pack (E7 of docs/plany/assety-paczka-2.md, CC-BY 4.0,
tools/assets/sources.json, fetched by tools/assets/fetch.mjs into DIR/<source id>/), one per door model of
`DOOR_MODELS` (packages/core/src/world/doors.ts), style `door-<model>`:
- `steel`: carlcapu9's single steel door with a push bar (Cyberpunk City Assets Pack 3, node .002);
- `steel-double`: the same pack's double steel door (node .005);
- `shop`: vanillao03's glazed double door (PSX Garage Doors Pack, node 010), its glass a dim shop window;
- `tall`: the same glazed double door as wood, its glass a warm lit window (a tenement's door);
- `code`: Jesus Fernandez Garcia's sci-fi security door (Cyberpunk Sci-fi Door 3);
- `shutter`: vanillao03's roller shutter (node 001).
Each leaf is turned front to +Z, fitted per axis into a box `fit` (width, height, depth: the depth of the
leaf in the engine's door, `DOOR_FRAME.leafDepth`), foot on y = 0 and centred on X/Z; the engine stretches
it to each door's opening between its procedural jambs (`door-models.ts`). Colours per triangle from the
textures (`city_ccby.roles_of`, one role per flat face), `remap` role -> role after. Node `extras`:
{"size", "styles", "credit": source id}.

Usage: python3 -I tools/city_kit.py --doors DIR --out DIR (DIR as filled by tools/assets/fetch.mjs).
"""
import os, zlib
import numpy as np
from city_ccby import flat_normals, roles_of, simplify, weld
from city_kit_gltf import accessor, node_matrix, png_bytes, read_model, write_glb
from city_kit_palette import GRID, SWATCHES, palette_images, swatch_uv
from city_street import planar_vote

PACK3 = ('sketchfab-cyberpunk-doors-and-windows', 'cyberpunk_city_assets_pack_3_doors_and_windows.glb')
PSX = ('sketchfab-psx-garage-doors', 'low-poly_psx_style_garage_doors_pack.glb')
SCIFI = ('sketchfab-cyberpunk-scifi-door-3', 'cyberpunk_sci-fi_door_3_-_free.glb')

# A tenement's door: the leaf's greys as wood.
WOOD = {'trim': 'rust', 'metal': 'rust', 'dark': 'door'}

# key, model, source, node name (a mesh node of the scene and what is under it, '' for all), yaw (deg about Y,
# front to +Z), fit (w, h, d) m, triangles target, remap (a node's name part or a role -> role)
DOORS = [
    ('dr-steel', 'steel', PACK3, 'Asset_Buildings.002', -90, (1.04, 2.2, 0.08), 330, {}),
    ('dr-steel-double', 'steel-double', PACK3, 'Asset_Buildings.005', -90, (1.84, 2.2, 0.08), 660, {}),
    ('dr-shop', 'shop', PSX, 'Garage Door_010', 0, (1.84, 2.2, 0.08), 200, {'Glass Plane': 'shop-teal'}),
    ('dr-tall', 'tall', PSX, 'Garage Door_010', 0, (1.04, 2.2, 0.08), 200, {'Glass Plane': 'win-warm', **WOOD}),
    ('dr-code', 'code', SCIFI, '', 90, (1.04, 2.2, 0.08), 766, {}),
    ('dr-shutter', 'shutter', PSX, 'Garage Door_001', 0, (2.4, 2.4, 0.04), 128, {}),
]

MAX_TRIS = 1500


def node_triangles(path, name):
    """World triangles of the mesh nodes named `name` (and their children; all for ''), their material index,
    UVs per corner, the glTF json and blob, and each triangle's node name."""
    j, blob = read_model(path)
    out = {'p': [], 'mat': [], 'uv': [], 'node': []}

    def visit(ni, parent, inside):
        node = j['nodes'][ni]
        m = parent @ node_matrix(node)
        here = inside or name == '' or node.get('name', '').startswith(name)
        if 'mesh' in node and here:
            for pr in j['meshes'][node['mesh']]['primitives']:
                P = accessor(j, blob, pr['attributes']['POSITION'])
                I = accessor(j, blob, pr['indices']).astype(np.int64).reshape(-1, 3) if 'indices' in pr else np.arange(len(P)).reshape(-1, 3)
                out['p'].append((P @ m[:3, :3].T + m[:3, 3])[I])
                out['mat'] += [pr.get('material', -1)] * len(I)
                out['uv'].append(accessor(j, blob, pr['attributes']['TEXCOORD_0'])[I] if 'TEXCOORD_0' in pr['attributes'] else np.full((len(I), 3, 2), np.nan))
                out['node'] += [node.get('name', '')] * len(I)
        for c in node.get('children', []):
            visit(c, m, here)

    for ni in j['scenes'][j.get('scene', 0)]['nodes']:
        visit(ni, np.eye(4), False)
    return np.concatenate(out['p']), np.array(out['mat']), np.concatenate(out['uv']), j, blob, out['node']


def bake_door(folder, source, node, yaw, fit, target, remap):
    path = os.path.join(folder, source[0], source[1])
    P, mat, uv, j, blob, nodes = node_triangles(path, node)
    roles = planar_vote(P, mat, roles_of(mat, uv, j, blob, os.path.dirname(path), None))
    # By the node's name first (a glass plane), then by role.
    roles = [next((v for k, v in remap.items() if k in n), None) or remap.get(r, r) for r, n in zip(roles, nodes)]
    a = np.radians(yaw)
    R = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    P = (P.reshape(-1, 3) @ R.T).reshape(-1, 3, 3)
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    P = (P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])) * (np.array(fit) / (hi - lo))
    # A glass plane is kept apart from the simplification, a hair in front of the leaf.
    glass = np.array([any(k in n for k in remap) for n in nodes])
    G, groles = P[glass] + np.array([0, 0, 0.005]), [r for r, g in zip(roles, glass) if g]
    P, roles = simplify(P[~glass], [r for r, g in zip(roles, glass) if not g], target)
    P, roles = np.concatenate([P, G]), roles + groles
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    return P, flat_normals(P), roles, [round(float(x), 3) for x in hi - lo]


def build_doors(folder, out_dir):
    out, extras = [], {}
    for key, model, source, node, yaw, fit, target, remap in DOORS:
        P, N, roles, size = bake_door(folder, source, node, yaw, fit, target, remap)
        m = weld(key, P, N, roles, swatch_uv, MAX_TRIS)
        out.append(m)
        extras[key] = {'size': size, 'styles': [f'door-{model}'], 'credit': source[0]}
        print(f"{key:18s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {size} roles {','.join(sorted(set(roles)))}")
    albedo, glow = palette_images()
    dst = os.path.join(out_dir, 'door-props.glb')
    write_glb(out, png_bytes(albedo), png_bytes(glow), dst, extras, SWATCHES, GRID)
    print(dst, f'{os.path.getsize(dst) // 1024} KB', 'crc', format(zlib.crc32(open(dst, 'rb').read()), '08x'))
