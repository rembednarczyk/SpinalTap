"""A textured car's roles settled over its mesh (tools/city_vehicles.py), so a body reads as one paint.

A role per triangle from its mean texel (`bands`) is noisy where a triangle straddles texels of two values:
dark specks on the paint, paint on the rims (4d_Bob's car, 21.11). Two steps over the model's welded mesh:
- wheels: a part (a connected component) inside a tyre's box is a rim, dark trim, its glow kept;
- panes: a part of its own above the belt and along the cabin (the `glass` option's height share and
  length range), mostly paint, is glass whatever its slope (the windscreen lies flatter than `tidy` lets
  the body's glass be), the spoiler behind the cabin kept;
- a majority (mode) filter over edge neighbours, as in label smoothing of a mesh segmentation (the image
  processing majority filter on a mesh's dual graph): a triangle takes the role most of its neighbours
  have, its own counted one and a half (ties stay), twice over, the lamps and neon untouched. A run of triangles wider than a neighbour
  or two keeps its role, so vents and skirts stay; specks go.
"""
from collections import Counter, defaultdict
import numpy as np

# Roles from the value bands; the others (lamps, neon, glass) are never settled.
PLAIN = {'paint', 'trim', 'metal', 'trim-light', 'tyre'}


def _parts(P):
    """Welded vertex ids [T, 3] and a connected component per triangle."""
    flat = np.round(P.reshape(-1, 3), 2)
    _, ids = np.unique(flat, axis=0, return_inverse=True)
    ids = ids.reshape(-1, 3)
    parent = list(range(ids.max() + 1))

    def root(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b, c in ids:
        ra = root(a)
        parent[root(b)] = ra
        parent[root(c)] = ra
    return ids, np.array([root(t[0]) for t in ids])


def _rims(P, roles, part):
    """A part inside the box of a part that is mostly tyre is its rim: dark trim."""
    out = list(roles)
    boxes, kinds = {}, defaultdict(Counter)
    for t, p in enumerate(part):
        kinds[p][roles[t]] += 1
        lo, hi = P[t].min(0), P[t].max(0)
        b = boxes.get(p)
        boxes[p] = (lo, hi) if b is None else (np.minimum(b[0], lo), np.maximum(b[1], hi))
    tyres = [boxes[p] for p, k in kinds.items() if k.most_common(1)[0][0] == 'tyre']
    for t, p in enumerate(part):
        if roles[t] not in PLAIN or roles[t] == 'tyre':
            continue
        lo, hi = boxes[p]
        if any((lo >= a - 1e-3).all() and (hi <= b + 1e-3).all() for a, b in tyres):
            out[t] = 'trim'
    return out


def _panes(P, roles, part, glass):
    """The parts of their own above the belt and along the cabin, mostly paint: glass."""
    y0, _, (za, zb) = glass
    flat = P.reshape(-1, 3)
    lo, hi = flat.min(0), flat.max(0)
    biggest = Counter(part).most_common(1)[0][0]
    out = list(roles)
    for p in set(part) - {biggest}:
        sel = np.flatnonzero(part == p)
        pts = P[sel].reshape(-1, 3)
        zs = (pts[:, 2].mean() - lo[2]) / (hi[2] - lo[2]) - 0.5
        paint = sum(roles[t] == 'paint' for t in sel) > len(sel) / 2
        if paint and pts[:, 1].min() > lo[1] + y0 * (hi[1] - lo[1]) and za <= zs <= zb:
            for t in sel:
                if roles[t] in PLAIN:
                    out[t] = 'glass-dark'
    return out


def settle_roles(P, roles, glass=None, rounds=2):
    """Roles of triangles P [T, 3, 3] with the rims dark, the panes glass and the specks taken by their neighbours."""
    ids, part = _parts(P)
    roles = _rims(P, roles, part)
    if glass:
        roles = _panes(P, roles, part, glass)
    edges = defaultdict(list)
    for t, (a, b, c) in enumerate(ids):
        for e in ((a, b), (b, c), (c, a)):
            edges[tuple(sorted(e))].append(t)
    near = defaultdict(set)
    for ts in edges.values():
        for t in ts:
            near[t].update(u for u in ts if u != t)
    for _ in range(rounds):
        out = list(roles)
        for t, r in enumerate(roles):
            if r not in PLAIN:
                continue
            votes = Counter({r: 1.5})
            for u in near[t]:
                if roles[u] in PLAIN:
                    votes[roles[u]] += 1
            out[t] = votes.most_common(1)[0][0]
        roles = out
    return roles
