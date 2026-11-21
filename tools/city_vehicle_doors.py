"""The driver's door of a car's close-up as a part of its own (ADR-0097, the user's request of 21.11: doors
that open upward, so the driver thrown out and she herself pass through an open side).

The source car is one welded body with no door of its own: the door is cut out of the body's driver side along
`OUTLINE`, the model's own lines seen from the side (front edge behind the front wheel, the A-pillar, the roof
edge, the B-pillar and the sill). The cut is a mesh slice (user's notes of 21.11: no jagged ends from whole
triangles): every triangle of the body and of the side glass on the driver's side (`SIDE`) is clipped against
the outline's convex polygon (Sutherland-Hodgman, in the side view), its part inside goes to the door and the
parts outside stay with the body, each new corner with its normal and UVs interpolated, so the door and its
opening share one straight edge. A separate small piece (a trim, a vent) goes with the door only when it lies
wholly inside the outline, else it stays whole with the body (the skirt, the arches). The frame is the file's:
metres, front +z, ground y = 0, the driver's side +x (the engine mirrors the file's z and turns it round, so the
file's +x is the game's left, where the simulation seats her). The close-up keeps the door a range of vertices
of its own after the wheels; the engine turns it up about a hinge at its front (`vehicle-door.ts`).

Usage: from city_vehicles (the `skin` close-ups); `python3 -I tools/city_vehicle_doors.py` runs the self-test.
"""
import os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from city_vehicle_wheels import _pieces  # noqa: E402

# The door of 4d_Bob's car (veh-cyber) seen from its side, (z, y) counter-clockwise: the sill's front, up its
# front edge to the belt, up the A-pillar, along the roof edge, down the B-pillar. The model is symmetric.
OUTLINE = [(0.5, 0.21), (0.6, 0.68), (0.2, 0.99), (-0.42, 0.99), (-0.45, 0.21)]
# Triangles whose centre lies past this (x, m) are of the driver's side skin (the cabin's side lies within 0.53 .. 0.75).
SIDE = 0.5
# A triangle thinner than this (m²) left by a cut is dropped.
SLIVER = 1e-8


def _edges():
    return list(zip(OUTLINE, OUTLINE[1:] + OUTLINE[:1]))


def _side(v, a, b):
    """Signed distance-like value of vertex v (x, y, z, ...) from edge a->b in the (z, y) view: >= 0 inside."""
    return (b[0] - a[0]) * (v[1] - a[1]) - (b[1] - a[1]) * (v[2] - a[0])


def _clip(poly, a, b, keep_inside):
    """Sutherland-Hodgman against one edge: the part of `poly` (vertex rows) inside it, or outside it."""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        dp, dq = _side(p, a, b), _side(q, a, b)
        if not keep_inside:
            dp, dq = -dp, -dq
        if dp >= 0:
            out.append(p)
        if (dp >= 0) != (dq >= 0):
            t = dp / (dp - dq)
            out.append(p + (q - p) * t)
    return out


def _fan(poly):
    return [np.stack([poly[0], poly[i], poly[i + 1]]) for i in range(1, len(poly) - 1)]


def _area(t):
    return 0.5 * np.linalg.norm(np.cross(t[1, :3] - t[0, :3], t[2, :3] - t[0, :3]))


def split(tri):
    """A triangle (3 vertex rows: x, y, z and attributes) cut by the outline: (inside triangles, outside triangles)."""
    edges = _edges()
    inside = list(tri)
    for a, b in edges:
        inside = _clip(inside, a, b, True)
        if not inside:
            break
    outside = []
    rest = list(tri)
    for a, b in edges:
        if not rest:
            break
        outside += _fan(_clip(rest, a, b, False))
        rest = _clip(rest, a, b, True)
    keep = lambda ts: [t for t in ts if _area(t) > SLIVER]
    return keep(_fan(inside) if len(inside) >= 3 else []), keep(outside)


def cut_door(V, glass, keep=None):
    """The driver's door cut out of triangles V [T, 3, A] (x, y, z first, then any attributes to interpolate).

    `glass` [T] bools of the glass roles; `keep` [T] bools of triangles never cut (the wheels). Returns
    (V2, src, door): the new triangles, the index in V each came from (its role), and a bool [T2] of the door's."""
    P = V[..., :3]
    c = P.mean(1)
    pieces = _pieces(P)
    body = max(pieces, key=len)
    whole = np.zeros(len(V), bool)
    cuttable = np.zeros(len(V), bool)
    cuttable[body] = True
    cuttable |= glass
    zs = [q[0] for q in OUTLINE]
    ys = [q[1] for q in OUTLINE]
    for g in pieces:
        if g is body or glass[g].all():
            continue
        v = P[g].reshape(-1, 3)
        inside_all = all(_side(np.array([x, y, z]), a, b) >= 0 for x, y, z in v for a, b in _edges())
        if v[:, 0].min() > SIDE - 0.1 and inside_all:
            whole[g] = True
    out, src, door = [], [], []
    for t in range(len(V)):
        if (keep is not None and keep[t]) or c[t, 0] <= SIDE:
            out.append(V[t]); src.append(t); door.append(False)
            continue
        if whole[t]:
            out.append(V[t]); src.append(t); door.append(True)
            continue
        if not cuttable[t] or c[t, 2] < min(zs) - 0.2 or c[t, 2] > max(zs) + 0.2 or c[t, 1] < min(ys) - 0.2:
            out.append(V[t]); src.append(t); door.append(False)
            continue
        ins, outs = split(V[t])
        for tri in ins:
            out.append(tri); src.append(t); door.append(True)
        for tri in outs:
            out.append(tri); src.append(t); door.append(False)
    return np.array(out), np.array(src), np.array(door)


def _self_test():
    # A box car's driver's side (+x) as a grid of triangles with a UV each; a skirt piece along the whole side.
    tris = []
    for z in np.arange(-2, 2, 0.25):
        for y in np.arange(0, 1.25, 0.25):
            a, b, c_, d = (0.8, y, z), (0.8, y + 0.25, z), (0.8, y + 0.25, z + 0.25), (0.8, y, z + 0.25)
            tris += [(a, b, c_), (a, c_, d)]
    skirt = [((0.78, 0.18, -1.0), (0.78, 0.22, -1.0), (0.78, 0.22, 1.0))]
    P = np.array(tris + skirt, float)
    uv = P[..., 1:3] * 0.1
    V = np.concatenate([P, uv], -1)
    glass = np.zeros(len(P), bool)
    V2, src, door = cut_door(V, glass)
    D = V2[door]
    # The door lies within the outline, its corners on it: no triangle reaches past an edge.
    for t in D:
        for v in t:
            assert all(_side(v, a, b) >= -1e-9 for a, b in _edges()), v
    # The cut keeps the area: door and body together cover what the side did.
    area = lambda T: sum(_area(t) for t in T)
    assert abs(area(V2) - area(V)) < 1e-9
    # The outline's area is the door's (the grid covers it wholly).
    zy = np.array(OUTLINE)
    poly = 0.5 * abs(np.dot(zy[:, 0], np.roll(zy[:, 1], 1)) - np.dot(zy[:, 1], np.roll(zy[:, 0], 1)))
    assert abs(area(D) - poly) < 1e-6, (area(D), poly)
    # UVs follow the positions (interpolated with them).
    assert np.allclose(D[..., 3:5], D[..., 1:3] * 0.1)
    assert not door[src == len(P) - 1].any(), 'the skirt reaches past the door: it stays whole'
    print('ok', int(door.sum()), 'door triangles')


if __name__ == '__main__':
    _self_test()
