"""The wheels of a car's close-up as parts of their own (ADR-0097 §3 "koła jako osobne siatki", 21.11).

A source car is one welded mesh, its wheels among its parts: per corner a tyre, a rim and a brake disc, each
a connected piece of its own. The tyre is the piece that stands on the ground (its bottom within `GROUND` of
the model's), round seen from the side (as tall as it is long) and narrow; every other piece inside a tyre's
box (with `MARGIN`) is that wheel's. The close-up keeps them in the same mesh, its triangles ordered body
first and then wheel by wheel (front left, front right, rear left, rear right: the simulation's order), so
each wheel is one range of vertices the engine turns about its axle (spin, steer, the spring's travel).

Usage: from city_vehicles (the `skin` close-ups); `python3 -I tools/city_vehicle_wheels.py` runs the self-test.
"""
import numpy as np

GROUND = 0.03
MARGIN = 0.02
ROUND = 0.15
NARROW = 0.5


def _pieces(P):
    """Connected pieces of triangles P [T, 3, 3] (vertices welded by position): a list of triangle index arrays."""
    keys = {}
    ids = np.array([keys.setdefault(tuple(np.round(v, 4)), len(keys)) for v in P.reshape(-1, 3)]).reshape(-1, 3)
    parent = list(range(len(keys)))

    def root(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b, c in ids:
        for u, v in ((a, b), (b, c)):
            ru, rv = root(u), root(v)
            if ru != rv:
                parent[ru] = rv
    groups = {}
    for t, (a, _, _) in enumerate(ids):
        groups.setdefault(root(a), []).append(t)
    return [np.array(g) for g in groups.values()]


def wheels(P):
    """The wheels of triangles P [T, 3, 3] (metres, front +z, left -x, ground y = min): (order, found).

    `order` the triangles' indices body first, then the four wheels in the simulation's order; `found` per
    wheel {'tris': count, 'axle': [x, y, z], 'radius', 'width'}. With no four tyres, (None, [])."""
    lo_y = P[..., 1].min()
    tyres, rest = [], []
    for g in _pieces(P):
        v = P[g].reshape(-1, 3)
        lo, hi = v.min(0), v.max(0)
        size = hi - lo
        round_ = abs(size[1] - size[2]) <= ROUND * max(size[1], 1e-9)
        if lo[1] - lo_y <= GROUND and round_ and size[0] < NARROW * size[1] and size[1] > 0.3:
            tyres.append((g, lo, hi))
        else:
            rest.append(g)
    if len(tyres) != 4:
        return None, []
    corner = lambda t: (0 if (t[1][2] + t[2][2]) > 0 else 2) + (0 if (t[1][0] + t[2][0]) < 0 else 1)
    tyres.sort(key=corner)
    if [corner(t) for t in tyres] != [0, 1, 2, 3]:
        return None, []
    parts = [[t[0]] for t in tyres]
    body = []
    for g in rest:
        v = P[g].reshape(-1, 3)
        lo, hi = v.min(0), v.max(0)
        inside = [i for i, (_, tlo, thi) in enumerate(tyres) if np.all(lo >= tlo - MARGIN) and np.all(hi <= thi + MARGIN)]
        (parts[inside[0]] if inside else body).append(g)
    order = np.concatenate(body + [np.concatenate(p) for p in parts])
    found = []
    for (g, lo, hi), p in zip(tyres, parts):
        c = (lo + hi) / 2
        found.append({'tris': int(sum(len(x) for x in p)), 'axle': [round(float(x), 4) for x in c], 'radius': round(float((hi[1] - lo[1]) / 2), 4), 'width': round(float(hi[0] - lo[0]), 4)})
    return order, found


def _ring(cx, cz, r, w, cy=None, n=12):
    """A test tyre: a closed band of quads round the axle (cx, cy, cz), across x; on the ground by default."""
    cy = r if cy is None else cy
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    pts = [(np.array([cx - w / 2, cy + r * np.sin(t), cz + r * np.cos(t)]), np.array([cx + w / 2, cy + r * np.sin(t), cz + r * np.cos(t)])) for t in a]
    tris = []
    for i in range(n):
        (a0, a1), (b0, b1) = pts[i], pts[(i + 1) % n]
        tris += [[a0, b0, b1], [a0, b1, a1]]
    return np.array(tris)


if __name__ == '__main__':
    body = np.array([[[-0.9, 0.3, -2], [0.9, 0.3, -2], [0.9, 1.2, 2]], [[-0.9, 0.3, -2], [0.9, 1.2, 2], [-0.9, 1.2, 2]]])
    rings = [_ring(x, z, 0.33, 0.22) for z in (1.4, -1.3) for x in (-0.8, 0.8)]
    hub = _ring(-0.8, 1.4, 0.2, 0.05, cy=0.33)
    P = np.concatenate([rings[3], body, rings[1], hub, rings[0], rings[2]])
    order, found = wheels(P)
    assert order is not None and len(order) == len(P), found
    assert [f['axle'][0] < 0 for f in found] == [True, False, True, False], found
    assert [f['axle'][2] > 0 for f in found] == [True, True, False, False], found
    assert found[0]['tris'] == len(rings[0]) + len(hub), found
    assert abs(found[0]['radius'] - 0.33) < 1e-3, found
    assert set(order[:2]) == {len(rings[3]), len(rings[3]) + 1}, order[:4]
    print('ok', found)
