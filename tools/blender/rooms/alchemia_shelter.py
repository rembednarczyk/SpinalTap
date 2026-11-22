"""The air-raid shelter under T2 (`docs/pomieszczenia/alchemia-shelter.md`, ADR-0098): what its card asks for round the
pieces Alchemia's engine draws (`packages/sim/src/content/alchemia/shelter.ts`: the benches, the columns, the cases,
the photographs, the fan, the lamps) and on the Hebi's crates.

Sizes from the simulation: the room 2.3 m high, the cases on counters 0.85 m high, the cover crate 1.1 m high. Each
model's foot is on y = 0 where it stands (the floor, a wall's spot, a crate's top), its front to +z.
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-alchemia-props.glb'


def blast_door():
    """The shelter's 1938 blast door, kept as an exhibit, open flat against the wall by the passage: a riveted steel leaf
    with its gasket, the locking wheel with four dogs, three hinges at its +x edge, a stencilled number (0.9 x 1.9 x 0.25)."""
    m = Model('rd-shelter-door')
    w, h = 0.9, 1.9
    m.box(-w / 2, w / 2, 0.0, h, 0.0, 0.1, 'rust', bevel=0.015)
    m.box(-w / 2 + 0.04, w / 2 - 0.04, 0.04, h - 0.04, 0.1, 0.11, 'metal')
    for x in (-w / 2 + 0.06, w / 2 - 0.06):
        for k in range(9):
            y = 0.12 + k * 0.21
            m.box(x - 0.01, x + 0.01, y - 0.01, y + 0.01, 0.11, 0.118, 'dark')
    m.tube((0.0, 0.95, 0.11), (0.0, 0.95, 0.2), 0.04, 'dark', seg=10)
    for k in range(12):
        a0, a1 = 2 * math.pi * k / 12, 2 * math.pi * (k + 1) / 12
        m.tube((0.2 * math.cos(a0), 0.95 + 0.2 * math.sin(a0), 0.2), (0.2 * math.cos(a1), 0.95 + 0.2 * math.sin(a1), 0.2), 0.015, 'neon-red', seg=6)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        m.tube((0.0, 0.95, 0.2), (0.2 * math.cos(a), 0.95 + 0.2 * math.sin(a), 0.2), 0.012, 'neon-red', seg=6)
        m.box(-0.03 + 0.38 * math.cos(a) * 0.9, 0.03 + 0.38 * math.cos(a) * 0.9, 0.95 + 0.38 * math.sin(a) * 1.6 - 0.04, 0.95 + 0.38 * math.sin(a) * 1.6 + 0.04, 0.11, 0.15, 'dark')
    # The hinges at +x, the jamb's side: open, the leaf lies along the wall from its doorway.
    for y in (0.25, 0.95, 1.65):
        m.tube((w / 2 + 0.03, y - 0.1, 0.05), (w / 2 + 0.03, y + 0.1, 0.05), 0.035, 'dark', seg=8)
    m.box(-0.2, 0.2, 1.45, 1.6, 0.11, 0.112, 'win-white')
    return m


def masks():
    """A rail of gas masks on the wall: four rubber masks with their round glasses and filters on their hooks, a steel
    helmet on the last hook (1.6 x 0.6)."""
    m = Model('rd-shelter-masks')
    m.box(-0.8, 0.8, 0.5, 0.56, 0.0, 0.03, 'fabric-amber')
    for k in range(5):
        x = -0.64 + k * 0.32
        m.tube((x, 0.53, 0.03), (x, 0.5, 0.08), 0.008, 'dark', seg=6)
        if k < 4:
            m.box(x - 0.09, x + 0.09, 0.15, 0.45, 0.04, 0.12, 'plant', bevel=0.04)
            for s in (-1, 1):
                m.tube((x + s * 0.045, 0.36, 0.11), (x + s * 0.045, 0.36, 0.13), 0.032, 'metal', seg=10)
                m.tube((x + s * 0.045, 0.36, 0.13), (x + s * 0.045, 0.36, 0.135), 0.026, 'glass-dark', seg=10)
            m.tube((x, 0.2, 0.12), (x, 0.13, 0.2), 0.04, 'dark', seg=10)
        else:
            m.lathe(x, 0.12, [(0.17, 0.0), (0.15, 0.02), (0.14, 0.08), (0.1, 0.14), (0.0, 0.16)], 'plant', seg=14, y0=0.25)
    return m


def oil_lamp():
    """A paraffin lamp on a nail on a column's face: its brass font, the burner, the glass chimney, the wire bail (0.15 x
    0.4 x 0.18)."""
    m = Model('rd-shelter-oil-lamp')
    m.box(-0.008, 0.008, 0.38, 0.39, 0.0, 0.04, 'metal')
    m.tube((0.0, 0.385, 0.04), (0.0, 0.3, 0.09), 0.003, 'metal', seg=4)
    m.lathe(0.0, 0.09, [(0.05, 0.0), (0.07, 0.03), (0.07, 0.06), (0.03, 0.08), (0.02, 0.09)], 'fabric-amber', seg=12)
    m.lathe(0.0, 0.09, [(0.025, 0.0), (0.035, 0.05), (0.03, 0.12), (0.02, 0.17), (0.02, 0.2)], 'win-warm', seg=12, y0=0.09)
    m.tube((-0.05, 0.05, 0.09), (0.0, 0.3, 0.09), 0.003, 'metal', seg=4)
    m.tube((0.05, 0.05, 0.09), (0.0, 0.3, 0.09), 0.003, 'metal', seg=4)
    return m


def tenants():
    """The tenants' list of 1939 framed on the wall: a yellowed typed sheet behind glass in a black frame, its museum
    label under it (0.42 x 0.62)."""
    m = Model('rd-shelter-list')
    m.box(-0.21, 0.21, 0.12, 0.62, 0.0, 0.025, 'dark')
    m.box(-0.18, 0.18, 0.15, 0.59, 0.025, 0.027, 'fabric-amber')
    m.box(-0.12, 0.12, 0.54, 0.56, 0.027, 0.029, 'dark')
    for k in range(22):
        y = 0.51 - k * 0.016
        m.box(-0.15, 0.15 - 0.1 * hashf(k, 2.0), y, y + 0.006, 0.027, 0.029, 'dark')
    m.box(-0.12, 0.12, 0.0, 0.07, 0.0, 0.01, 'win-white')
    m.box(-0.1, 0.06, 0.03, 0.04, 0.01, 0.012, 'dark')
    return m


def conduit(length, key):
    """Wiring in steel conduit along a wall under the ceiling (along x): two runs on saddles, junction boxes, a caged
    bulkhead lamp in the middle lit weak yellow."""
    m = Model(key)
    for y, r in ((0.0, 0.016), (0.07, 0.012)):
        m.tube((-length / 2, y, 0.03), (length / 2, y, 0.03), r, 'metal', seg=6)
    x = -length / 2 + 0.3
    while x < length / 2:
        m.box(x - 0.015, x + 0.015, -0.03, 0.1, 0.0, 0.05, 'dark')
        x += 0.8
    for x in (-length / 3, length / 3):
        m.box(x - 0.07, x + 0.07, -0.05, 0.12, 0.0, 0.07, 'trim', bevel=0.01)
    m.box(-0.11, 0.11, -0.2, -0.02, 0.0, 0.03, 'dark')
    m.lathe(0.0, 0.08, [(0.07, 0.0), (0.0, 0.0)], 'dark', seg=12, y0=-0.04)
    m.tube((0.0, -0.11, 0.03), (0.0, -0.11, 0.12), 0.06, 'win-warm', seg=12)
    for k in range(4):
        a = k * math.pi / 4
        m.tube((0.065 * math.cos(a), -0.11 + 0.065 * math.sin(a), 0.03), (0.065 * math.cos(a), -0.11 + 0.065 * math.sin(a), 0.13), 0.005, 'dark', seg=4)
    return m


def shards():
    """The broken glass of a case on the floor, and the brick someone threw (0.7 x 0.5)."""
    m = Model('rd-shelter-shards')
    for k in range(14):
        x = -0.35 + 0.7 * hashf(k, 1.0)
        z = -0.25 + 0.5 * hashf(k, 2.0)
        s = 0.02 + 0.06 * hashf(k, 3.0)
        a = math.pi * hashf(k, 4.0)
        m.obox((x, 0.004, z), (math.cos(a), 0.0, math.sin(a)), (0.0, 1.0, 0.0), (s, 0.003, s * 0.6), 'glass-blue')
    m.box(0.12, 0.37, 0.0, 0.065, 0.05, 0.17, 'brick', bevel=0.01)
    return m


def prints():
    """Boot prints in the dust from the passage to the stash (along z, 10 m): a walker's left and right, every 0.7 m."""
    m = Model('rd-shelter-prints')
    z = -5.0
    k = 0
    while z < 5.0:
        x = -0.12 if k % 2 == 0 else 0.12
        x += 0.05 * (hashf(k, 1.0) - 0.5)
        m.box(x - 0.05, x + 0.05, 0.0, 0.002, z, z + 0.27, 'wall-dark')
        z += 0.35
        k += 1
    return m


def hebi_kit():
    """The Hebi's kit on the cover crate: a rugged laptop open with its screen lit green, a cable over the crate's edge
    down to a battery box on the floor beside it, a radio, an energy drink (0.9 x 1.2 x 0.9; foot on the crate's top,
    the battery 1.1 m lower)."""
    m = Model('rd-shelter-hebi')
    m.box(-0.18, 0.18, 0.0, 0.03, -0.13, 0.13, 'dark', bevel=0.008)
    m.box(-0.15, 0.15, 0.03, 0.032, -0.05, 0.11, 'trim')
    m.obox((0.0, 0.15, -0.16), (1, 0, 0), (0, 0.96, -0.28), (0.18, 0.13, 0.008), 'dark')
    m.obox((0.0, 0.15, -0.15), (1, 0, 0), (0, 0.96, -0.28), (0.16, 0.11, 0.002), 'neon-green')
    m.box(0.3, 0.38, 0.0, 0.2, -0.1, -0.02, 'plant', bevel=0.01)
    m.tube((0.36, 0.2, -0.06), (0.36, 0.38, -0.06), 0.005, 'dark', seg=4)
    m.cyl(0.3, 0.12, 0.033, 0.0, 0.155, 'neon-blue', seg=10)
    pts = [(-0.18, 0.015, 0.0), (-0.3, 0.005, -0.2), (-0.5, 0.0, -0.45), (-0.55, -0.3, -0.62), (-0.6, -0.9, -0.7), (-0.6, -1.0, -0.7)]
    for a, b in zip(pts, pts[1:]):
        m.tube(a, b, 0.008, 'cable', seg=6)
    m.box(-0.8, -0.45, -1.1, -0.85, -0.85, -0.55, 'plant', bevel=0.02)
    m.box(-0.75, -0.65, -0.85, -0.82, -0.75, -0.65, 'dark')
    m.box(-0.62, -0.58, -0.88, -0.86, -0.56, -0.55, 'neon-green')
    return m


MODELS = [blast_door, masks, oil_lamp, tenants, lambda: conduit(13.4, 'rd-shelter-conduit'), shards, prints, hebi_kit]
