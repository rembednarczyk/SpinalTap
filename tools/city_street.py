"""CC-BY 4.0 street furniture of the second Sketchfab pack (ADR-0063, docs/plany/assety-paczka-2.md) in
packages/app/public/city/street-props.glb, on the city kit's swatch palette like city-props.glb.

city-props.glb is near its 512 KiB limit, so these models get a file of their own; the engine loads it
after city-props.glb and merges the two (`mergeCityProps`). Each model stands in for a street furniture
kind of the map city (ADR-0047) whose solid the simulation already has (packages/sim/src/content/lublin/
furniture.ts): it is fitted per axis into that solid's box (`fit`), so nothing it draws sticks out of what
the body collides with, and the simulation does not change.

Per model, as tools/city_ccby.py does it (its helpers): colours per triangle from the base colour and
emissive textures, sorted into palette roles; simplified by vertex clustering to `target` triangles; front
to +Z, foot on y = 0, centred on X/Z. On top of that:
- `crop`: (f0, f1) keeps the triangles whose centre lies in that share of the model's X range (after `yaw`);
- `remap`: role -> role after the colours are read (a lit paper lantern's red becomes neon, a big lit
  window a dimmer shop swatch so it does not bloom over the whole front);
- `materials`: material name -> role, over the colours (the goods behind a machine's glass are lit);
- `screen`: (share of the height, colour) dark triangles in the top share facing up or out are a lit screen;
- `post`: (width, height, depth) a dark pedestal the model stands on (a wall terminal made free-standing);
- `mast`: (height, side) the camera on a mast: the mast at the origin, the camera's mount on it at
  `height`, its lens out along +Z.

Node `extras`: {"size", "styles", "credit": source id}.

Usage: python3 -I tools/city_kit.py --street DIR --out DIR (DIR as filled by tools/assets/fetch.mjs).
"""
import os, zlib
import numpy as np
from city_ccby import flat_normals, roles_of, simplify, weld
from city_kit_gltf import png_bytes, scene_triangles, write_glb
from city_kit_palette import GRID, SWATCHES, palette_images, swatch_uv

# key, source id, file, styles (the street kind it stands in for), yaw (deg about glTF Y, front to +Z),
# fit (x, y, z) metres, triangles target, options
STREET = [
    # Drinks machines: the solid is 1.0 x 1.9 x 0.76 m.
    ('st-vending', 'sketchfab-vending-machine', 'vending_machine.glb', ['vending-machine'], 0, (0.98, 1.9, 0.74), 1400,
     {'materials': {'Stuff': 'win-white'}}),
    ('st-vending-ramen', 'sketchfab-ramen-vending-machine', 'ramen_vending_machine.glb', ['vending-machine'], 0, (0.98, 1.9, 0.54), 1400,
     {'remap': {'neon-cyan': 'shop-teal', 'neon-blue': 'shop-teal'}}),
    # Ticket machines: the solid is 0.56 x 1.75 x 0.4 m. The yellow one of the two Reston terminals on a post.
    ('st-ticket-terminal', 'sketchfab-reston-b2-terminal', 'reston_b2_terminal.glb', ['ticket-machine'], 0, (0.5, 0.84, 0.3), 900,
     {'crop': (0.5, 1.0), 'post': (0.26, 0.8, 0.2)}),
    ('st-ticket-kiosk', 'sketchfab-scifi-kiosk', 'scifi_kiosk.glb', ['ticket-machine'], 0, (0.5, 1.67, 0.38), 900,
     {'screen': (0.2, 'win-teal')}),
    # The camera on its mast (no solid: the kind is drawn only); the procedural one is 4.3 m.
    ('st-cctv', 'sketchfab-cctv-camera', 'cctv_camera.glb', ['cctv'], 0, (0.2, 0.4, 0.6), 700, {'mast': (3.75, 0.12), 'remap': {'fabric-amber': 'dark'}}),
    # A paper lantern hung under a market stall's canopy; lit at night.
    ('st-lantern', 'sketchfab-paper-lantern-chochin', 'chinese__japanese_paper_lantern_chochin.glb', ['lantern'], 0, (0.3, 0.46, 0.3), 120,
     {'remap': {'brick': 'neon-red', 'fabric-amber': 'fabric-amber'}}),
]

MAX_TRIS = 1500


def box_tris(cx, cy, cz, w, h, d):
    """An axis-aligned box as 12 triangles, outward winding, its bottom left open (it stands on something)."""
    x0, x1, y0, y1, z0, z1 = cx - w / 2, cx + w / 2, cy, cy + h, cz - d / 2, cz + d / 2
    quads = [
        [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],  # +Z
        [(x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)],  # -Z
        [(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)],  # +X
        [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)],  # -X
        [(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)],  # +Y
    ]
    out = []
    for a, b, c, e in quads:
        out += [[a, b, c], [a, c, e]]
    return np.array(out, np.float64)


def screen_roles(P, roles, share, colour):
    """Dark triangles near the top facing up or out (+Z) are the screen."""
    lo, hi = P[:, :, 1].min(), P[:, :, 1].max()
    n = flat_normals(P)[:, 0]
    top = P[:, :, 1].mean(1) > hi - share * (hi - lo)
    out = (n[:, 1] > 0.3) | (n[:, 2] > 0.5)
    return [colour if t and o and r in ('dark', 'trim') else r for r, t, o in zip(roles, top, out)]


def planar_vote(P, mat, roles):
    """One role per flat face: triangles of one material sharing an edge in one plane (a window pane, a
    panel) take the role covering most of their area, so a big quad split in two triangles does not
    come out half lit and half dark (each triangle's colour is the mean of a few texels of its own)."""
    n = flat_normals(P)[:, 0]
    area = np.linalg.norm(np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]), axis=1) / 2
    parent = list(range(len(P)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    edges = {}
    keys = np.round(P, 4)
    for t in range(len(P)):
        for k in range(3):
            e = tuple(sorted((tuple(keys[t, k]), tuple(keys[t, (k + 1) % 3]))))
            o = edges.setdefault(e, t)
            if o != t and mat[o] == mat[t] and float(n[o] @ n[t]) > 0.999:
                ra, rb = find(o), find(t)
                if ra != rb:
                    parent[ra] = rb
    votes = {}
    for t in range(len(P)):
        v = votes.setdefault(find(t), {})
        v[roles[t]] = v.get(roles[t], 0) + area[t]
    best = {r: max(v, key=v.get) for r, v in votes.items()}
    return [best[find(t)] for t in range(len(P))]


def bake_street(path, yaw, fit, target, opts):
    P, _, mat, uv, j, blob = scene_triangles(path)
    a = np.radians(yaw)
    R = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    P = (P.reshape(-1, 3) @ R.T).reshape(-1, 3, 3)
    if 'crop' in opts:
        f0, f1 = opts['crop']
        cx = P[:, :, 0].mean(1)
        x0, x1 = P[:, :, 0].min(), P[:, :, 0].max()
        sel = (cx >= x0 + f0 * (x1 - x0)) & (cx <= x0 + f1 * (x1 - x0))
        P, mat, uv = P[sel], mat[sel], uv[sel]
    roles = planar_vote(P, mat, roles_of(mat, uv, j, blob, os.path.dirname(path), None))
    remap = opts.get('remap', {})
    roles = [remap.get(r, r) for r in roles]
    names = [m.get('name', '') for m in j.get('materials', [])]
    by_name = opts.get('materials', {})
    roles = [by_name.get(names[mi] if mi >= 0 else '', r) for r, mi in zip(roles, mat)]
    # Fit per axis into the box, foot on y = 0, centred on X/Z.
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    P = (P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])) * (np.array(fit) / (hi - lo))
    P, roles = simplify(P, roles, target)
    if 'screen' in opts:
        roles = screen_roles(P, roles, *opts['screen'])
    if 'post' in opts:
        w, h, d = opts['post']
        P = np.concatenate([box_tris(0, 0, 0, w, h, d), P + np.array([0, h, 0])])
        roles = ['dark'] * 10 + roles
    if 'mast' in opts:
        height, side = opts['mast']
        # The camera's mount (its back, -Z) against the mast's front face.
        lo = P.reshape(-1, 3).min(0)
        P = P + np.array([0, height, side / 2 - lo[2]])
        P = np.concatenate([box_tris(0, -0.1, 0, side, height + 0.45, side), P])
        roles = ['dark'] * 10 + roles
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    if 'mast' not in opts:
        P = P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    return P, flat_normals(P), roles, [round(float(x), 3) for x in hi - lo]


def build_street(ccby_dir, out_dir):
    out, extras = [], {}
    for key, source, name, styles, yaw, fit, target, opts in STREET:
        P, N, roles, size = bake_street(os.path.join(ccby_dir, source, name), yaw, fit, target, opts)
        m = weld(key, P, N, roles, swatch_uv, MAX_TRIS)
        out.append(m)
        extras[key] = {'size': size, 'styles': styles, 'credit': source}
        print(f"{key:20s} verts {len(m['pos']):5d} tris {len(m['ind']) // 3:5d} size {size} roles {','.join(sorted(set(roles)))}")
    albedo, glow = palette_images()
    dst = os.path.join(out_dir, 'street-props.glb')
    write_glb(out, png_bytes(albedo), png_bytes(glow), dst, extras, SWATCHES, GRID)
    print(dst, f'{os.path.getsize(dst) // 1024} KB', 'crc', format(zlib.crc32(open(dst, 'rb').read()), '08x'))

