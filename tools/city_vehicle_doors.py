"""The driver's door of a car's close-up as a part of its own (ADR-0097, the user's request of 21.11: doors
that open upward, so the driver thrown out and she herself pass through an open side).

The source car is one welded body with no door of its own: the door is cut out of the body's left side along
the model's own lines, the panel from the front edge behind the front wheel to the B-pillar, sill to roof
edge, with its window. A triangle of the body is the door's when its centre lies in `BOX` (the file's frame,
metres: front +z, ground y = 0, the driver's side +x: the engine mirrors the file's z and turns it round, so
the file's +x is the game's left, where the simulation seats her); a separate piece (a trim, a vent) only when it lies wholly in the box, the
side glass by its triangles. The close-up keeps the door a range of vertices of its own after the wheels;
the engine turns it up about a hinge at its front (`vehicle-door.ts`).

Usage: from city_vehicles (the `skin` close-ups); `python3 -I tools/city_vehicle_doors.py` runs the self-test.
"""
import os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from city_vehicle_wheels import _pieces  # noqa: E402

# The door of 4d_Bob's car (veh-cyber): front edge z 0.53, B-pillar z -0.43, sill y 0.17, roof edge y 0.99,
# the outer skin outside x 0.5 (the cabin's side, glass and pillars, lies within 0.53 .. 0.75). The model is
# symmetric: the same lines on the other side.
BOX = {'x': 0.5, 'z': (-0.43, 0.53), 'y': (0.17, 0.99)}
# A piece with any part beyond the box by more than this stays with the body (the skirt, the arches).
SLACK = 0.05


def door(P, glass, keep=None):
    """Triangle indices of the driver's door of triangles P [T, 3, 3]; `glass` [T] bools of the glass roles;
    `keep` [T] bools of triangles never the door's (the wheels). An empty array when it finds no door."""
    c = P.mean(1)
    z0, z1 = BOX['z']
    y0, y1 = BOX['y']
    sel = (c[:, 0] > BOX['x']) & (c[:, 2] > z0) & (c[:, 2] < z1) & (c[:, 1] > y0) & (c[:, 1] < y1)
    if keep is not None:
        sel &= ~keep
    pieces = _pieces(P)
    body = max(pieces, key=len)
    for g in pieces:
        if g is body or glass[g].all():
            continue
        v = P[g].reshape(-1, 3)
        lo, hi = v.min(0), v.max(0)
        whole = lo[0] > BOX['x'] - 2 * SLACK and lo[2] > z0 - SLACK and hi[2] < z1 + SLACK and lo[1] > y0 - SLACK and hi[1] < y1 + SLACK
        if not whole:
            sel[g] = False
    return np.where(sel)[0]


def _self_test():
    # A box car 1.6 wide, 4 long, 1 tall, its driver's side (+x) split into triangles; a skirt along the whole side.
    tris = []
    for z in np.arange(-2, 2, 0.25):
        for y in np.arange(0, 1, 0.25):
            a, b, c_, d = (0.8, y, z), (0.8, y + 0.25, z), (0.8, y + 0.25, z + 0.25), (0.8, y, z + 0.25)
            tris += [(a, b, c_), (a, c_, d)]
    skirt = [((0.78, 0.18, -1.0), (0.78, 0.22, -1.0), (0.78, 0.22, 1.0))]
    P = np.array(tris + skirt, float)
    glass = np.zeros(len(P), bool)
    d = door(P, glass)
    c = P[d].mean(1)
    assert len(d) > 0 and (c[:, 2] > -0.43).all() and (c[:, 2] < 0.53).all() and (c[:, 1] > 0.17).all()
    assert len(P) - 1 not in d, 'the skirt reaches past the door: it stays'
    print('ok', len(d))


if __name__ == '__main__':
    _self_test()
