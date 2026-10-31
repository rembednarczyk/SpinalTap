"""Megatowers for the skyline of Lublin 2077 (ADR-0063 stage 2, ADR-0051) from the CC-BY
"Sci-Fi Megacity Cluster" (TRYFIELD), baked into packages/app/public/city/city-props.glb next to the
street props of tools/city_ccby.py.

The source is one city block, about 200 x 200 units and up to 108 high, of some 500 thousand
triangles: the block's buildings over two ground planes. The skyline draws its towers 2 to 4 km
away, where only the outline and the lights tell, so each variant here is
- a square cut of the block around one of its tallest buildings (`MEGA`): the tower with the lower
  buildings at its foot, which read as its podium from afar; the ground planes and whatever lies
  below the street (the block's basements reach 20 units down) stay out;
- a height field of that cut on a square grid: every cell rises to the highest triangle over it
  (snapped to `STEP`), the roofs are merged into rectangles of one height and the walls into runs,
  so the setbacks, spires and crowns stay and the balconies and window frames go. Vertex clustering
  (tools/city_ccby.py) left spikes and holes at this budget. The cell is the finest that keeps the
  tower under `TARGET_TRIS`;
- coloured on the city kit's palette (ADR-0022): the walls and roofs by the value and hue of the
  base colour under them, and where the block's emissive texture lights a fair share of a cell, the
  top of its walls is a band of light (`win-warm`, or the nearest neon for a coloured light). The
  skyline's shader adds the glow swatches as light and paints the floors' windows on the rest;
- stood on y = 0 with its origin in the middle of its foot, in the source's units taken as metres;
  the engine scales each tower to its height and turns it.

Node `extras`: {"size", "styles": ["megatower"], "credit": source id}.
"""
import os
import numpy as np
from city_kit_gltf import scene_triangles
from city_kit_palette import SW, SWATCHES, hsv
from city_props import material_image, nearest_neon, texel_mean, to_srgb
from city_ccby import weld

SOURCE = 'sketchfab-megacity-cluster'
FILE = 'sci-fi_megacity_cluster.glb'

# A far tower: a few thousand triangles at most (ADR-0063), the target well under.
MAX_TRIS = 3000
TARGET_TRIS = 1200
# Heights snap to this (units): about a storey of the block, so roofs a floor apart merge.
STEP = 2.0
# An emissive texel (times the material's factor) above this lights the triangle; a cell whose lit
# share of triangles reaches LIT_SHARE gets a band of light round the top of its walls.
EMIT = 0.12
LIT_SHARE = 0.2
BAND = 1.5

# key, centre of the cut (x, z in source units), half its side
MEGA = [
    ('mc-tower-a', (-70, 90), 18),    # the block's tallest, 108 units, a stepped spire
    ('mc-tower-b', (-40, 25), 16),    # a twin slab, 89
    ('mc-tower-c', (65, -105), 20),   # a crown of four tops, 89
    ('mc-tower-d', (20, 5), 16),      # a tower over a wide podium, 84
]

GLOWS = {n for n, _, k in SWATCHES if k == 'glow'}


def mega_role(rgb):
    """A facade on the palette: the block is black and dark brown; greys by value, warm browns brick."""
    h, s, v = hsv(tuple(rgb))
    if s > 0.3 and v > 0.2 and (h * 360 >= 330 or h * 360 < 45):
        return 'brick'
    return 'trim' if v < 0.1 else 'trim-light' if v < 0.3 else 'metal'


def mega_roles(mat, uv, j, blob, folder):
    mats = j.get('materials', [])
    images, roles = {}, []
    for t in range(len(mat)):
        mi = int(mat[t])
        m = mats[mi] if mi >= 0 else {}
        if mi not in images:
            images[mi] = (material_image(j, blob, m, folder, 'base'), material_image(j, blob, m, folder, 'emissive'))
        base, em = images[mi]
        has_uv = not np.isnan(uv[t]).any()
        if em is not None and has_uv:
            e = texel_mean(em, uv[t]) * np.array(m.get('emissiveFactor', [1, 1, 1]))
            if e.max() > EMIT:
                # The block's windows are white light: warm windows; a saturated one the nearest neon.
                roles.append('win-warm' if hsv(tuple(e))[1] < 0.3 else nearest_neon(e))
                continue
        factor = to_srgb(np.array(m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [0.5, 0.5, 0.5, 1])[:3]))
        rgb = texel_mean(base, uv[t]) * factor if base is not None and has_uv else factor
        roles.append(mega_role(rgb))
    return roles


def block_triangles(path):
    """The block's buildings above the street: no ground planes, no basements."""
    P, _, mat, uv, j, blob = scene_triangles(path)
    names = [m.get('name', '') for m in j.get('materials', [])]
    # The ground planes are single quads with materials of their own.
    ground = [i for i, n in enumerate(names) if n in ('Ground', 'Material', 'Material.012')]
    keep = ~np.isin(mat, ground) & (P[:, :, 1].mean(1) > -1.0)
    return P[keep], mat[keep], uv[keep], j, blob


def most(values):
    """The most common value, ties to the smallest (deterministic)."""
    if not values:
        return None
    u, c = np.unique(np.array(values), return_counts=True)
    return str(u[np.argmax(c)])


def height_field(P, roles, x0, z0, n, cell, ground):
    """Per cell: height above `ground` (snapped), its facade swatch and its light (a glow swatch or None)."""
    H = np.zeros((n, n))
    body = [[[] for _ in range(n)] for _ in range(n)]
    lit = [[[] for _ in range(n)] for _ in range(n)]
    seen = np.zeros((n, n), int)
    lo = np.floor((P[:, :, [0, 2]].min(1) - [x0, z0]) / cell).astype(int).clip(0, n - 1)
    hi = np.floor((P[:, :, [0, 2]].max(1) - [x0, z0]) / cell).astype(int).clip(0, n - 1)
    top = P[:, :, 1].max(1) - ground
    for t in range(len(P)):
        (a, b), (c, d) = lo[t], hi[t]
        H[b:d + 1, a:c + 1] = np.maximum(H[b:d + 1, a:c + 1], top[t])
        seen[b:d + 1, a:c + 1] += 1
        for i in range(b, d + 1):
            for k in range(a, c + 1):
                (lit if roles[t] in GLOWS else body)[i][k].append(roles[t])
    H = np.where(H > 0.5, np.maximum(STEP, np.round(H / STEP) * STEP), 0)
    R = [[most(body[i][k]) or 'trim' for k in range(n)] for i in range(n)]
    L = [[most(lit[i][k]) if seen[i, k] and len(lit[i][k]) >= LIT_SHARE * seen[i, k] else None for k in range(n)] for i in range(n)]
    return H, R, L


def rectangles(H, R):
    """Roofs: greedy rectangles of cells with one height and swatch, row by row."""
    n = len(H)
    used = np.zeros_like(H, bool)
    out = []
    for i in range(n):
        for k in range(n):
            if used[i, k] or H[i, k] <= 0:
                continue
            same = lambda a, b: not used[a, b] and H[a, b] == H[i, k] and R[a][b] == R[i][k]
            w = 1
            while k + w < n and same(i, k + w):
                w += 1
            h = 1
            while i + h < n and all(same(i + h, k + q) for q in range(w)):
                h += 1
            used[i:i + h, k:k + w] = True
            out.append((i, k, h, w))
    return out


def walls(H, R, L):
    """Walls between a cell and a lower neighbour (or the outside), merged into runs along the edge.
    Yields (cell i, k, direction (di, dk), run length, bottom, top, swatch, light)."""
    n = len(H)
    get = lambda i, k: H[i, k] if 0 <= i < n and 0 <= k < n else 0.0
    for di, dk in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        # Runs go along the edge: across k for a z-facing wall, across i for an x-facing one.
        for line in range(n):
            run = None
            for s in range(n + 1):
                i, k = (s, line) if dk else (line, s)
                key = None
                if s < n and H[i, k] > get(i + di, k + dk):
                    key = (get(i + di, k + dk), H[i, k], R[i][k], L[i][k])
                if run and key == run[1]:
                    run[2] += 1
                    continue
                if run:
                    yield (run[0], (di, dk), run[2], *run[1])
                run = [(i, k), key, 1] if key else None


def mesh_of(H, R, L, x0, z0, cell):
    """Triangles [T, 3, 3] and their swatches. Cells are [i] along z and [k] along x."""
    tris, roles = [], []

    def quad(a, b, c, d, role, out=(0, 1, 0)):
        """A quad facing `out` (counter-clockwise seen from there, glTF's front)."""
        if np.dot(np.cross(np.subtract(b, a), np.subtract(c, a)), out) < 0:
            a, b, c, d = d, c, b, a
        tris.extend([(a, b, c), (a, c, d)])
        roles.extend([role, role])

    X = lambda k: x0 + k * cell
    Z = lambda i: z0 + i * cell
    for i, k, h, w in rectangles(H, R):
        y = H[i, k]
        quad((X(k), y, Z(i)), (X(k), y, Z(i + h)), (X(k + w), y, Z(i + h)), (X(k + w), y, Z(i)), R[i][k])
    for (i, k), (di, dk), run, lo, hi, role, light in walls(H, R, L):
        if dk:
            x = X(k + 1) if dk > 0 else X(k)
            a, b = Z(i), Z(i + run)
            corner = lambda u, y: (x, y, u)
        else:
            z = Z(i + 1) if di > 0 else Z(i)
            a, b = X(k), X(k + run)
            corner = lambda u, y: (u, y, z)
        out = (dk, 0, di)
        mid = max(lo, hi - BAND) if light else hi
        if mid > lo:
            quad(corner(a, lo), corner(b, lo), corner(b, mid), corner(a, mid), role, out)
        if light:
            quad(corner(a, mid), corner(b, mid), corner(b, hi), corner(a, hi), light, out)
    return np.array(tris, float), roles


def bake_tower(P, roles, centre, half):
    c = P.mean(1)
    sel = (np.abs(c[:, 0] - centre[0]) <= half) & (np.abs(c[:, 2] - centre[1]) <= half)
    P = P[sel]
    roles = [r for r, s in zip(roles, sel) if s]
    ground = float(P[:, :, 1].min())
    x0, z0 = centre[0] - half, centre[1] - half
    # The finest cell (in tenths of a unit) that keeps the tower under the target.
    for tenths in range(10, 80):
        cell = tenths / 10
        n = int(np.ceil(2 * half / cell))
        T, R = mesh_of(*height_field(P, roles, x0, z0, n, cell, ground), x0, z0, cell)
        if len(T) <= TARGET_TRIS:
            break
    flat = T.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    T = T - np.array([(lo[0] + hi[0]) / 2, 0, (lo[2] + hi[2]) / 2])
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    n = n / np.linalg.norm(n, axis=1, keepdims=True)
    return T, np.repeat(n[:, None, :], 3, 1), R, [round(float(x), 3) for x in hi - lo], len(P), cell


def build_megacity(ccby_dir, swatch_uv):
    """The megatowers and their node extras, in table order."""
    path = os.path.join(ccby_dir, SOURCE, FILE)
    P, mat, uv, j, blob = block_triangles(path)
    roles = mega_roles(mat, uv, j, blob, os.path.dirname(path))
    out, extras = [], {}
    for key, centre, half in MEGA:
        T, N, R, size, source_tris, cell = bake_tower(P, roles, centre, half)
        m = weld(key, T, N, R, swatch_uv, MAX_TRIS)
        m['size'] = size
        m['roles'] = sorted(set(R))
        print(f'{key}: {source_tris} source triangles, cell {cell}')
        out.append(m)
        extras[key] = {'size': size, 'styles': ['megatower'], 'credit': SOURCE}
    return out, extras
