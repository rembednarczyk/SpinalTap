"""The rooms' shared detail, batch 1 of ADR-0099 (`docs/pomieszczenia/katalog.md`, families 1-3): what many rooms need
and the dressing generator (`packages/sim/src/content/room-dressing.ts`) stands by its kits: cups, cartons, papers, a
cable, bottles, a laptop with an error, the extinguisher, the hose cabinet, the fuse box, a drain's grate, a puddle.

Real sizes (comic realism, `docs/zasady-lokacji.md` §9): a paper cup 9 cm across and 12 high, an A4 sheet, a 6 kg
extinguisher 0.55 m high on its bracket at 1 m, a hose cabinet 0.7 x 0.8 x 0.25. Each model's foot is on y = 0 where
it stands (the floor, a top), a wall's things with their back on z = 0 and their front to +z, centred on x.
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-props.glb'


def cups():
    """Cups left together: two paper cups with their lids, one of them on its side, and a plastic one with a straw
    (0.3 x 0.17 x 0.16)."""
    m = Model('rd-c-cups')
    m.lathe(-0.08, 0.0, [(0.032, 0.0), (0.045, 0.12), (0.0, 0.12)], 'trim-light', seg=14)
    m.lathe(-0.08, 0.0, [(0.047, 0.0), (0.045, 0.008), (0.0, 0.012)], 'dark', seg=14, y0=0.12)
    m.tube((0.0, 0.04, 0.03), (0.11, 0.045, 0.06), 0.042, 'trim-light', seg=12)
    m.lathe(0.13, -0.05, [(0.03, 0.0), (0.04, 0.13), (0.0, 0.13)], 'glass-blue', seg=12)
    m.lathe(0.13, -0.05, [(0.042, 0.0), (0.0, 0.008)], 'trim', seg=12, y0=0.13)
    m.tube((0.135, 0.13, -0.05), (0.15, 0.2, -0.05), 0.003, 'neon-pink', seg=6)
    return m


def cartons():
    """Cartons from a delivery: three flattened and tied with tape on the floor, an open box on them with its flaps up
    (0.7 x 0.45 x 0.5)."""
    m = Model('rd-c-cartons')
    for k in range(3):
        y = k * 0.025
        dx = 0.02 * math.sin(k * 2.1)
        m.box(-0.34 + dx, 0.34 + dx, y, y + 0.024, -0.24, 0.24, 'fabric-amber', bevel=0.003)
    m.box(-0.35, 0.35, 0.0, 0.08, -0.012, 0.012, 'trim-light')
    m.box(-0.2, 0.18, 0.075, 0.38, -0.18, 0.16, 'fabric-amber', bevel=0.004)
    m.box(-0.2, 0.18, 0.38, 0.385, -0.18, 0.16, 'dark')
    # The flaps up along the box's long edges.
    for z0, z1 in ((-0.18, -0.172), (0.152, 0.16)):
        m.box(-0.2, 0.18, 0.38, 0.52, z0, z1, 'fabric-amber')
    m.box(-0.05, 0.03, 0.2, 0.28, 0.16, 0.162, 'win-white')
    return m


def papers():
    """Papers dropped or left: flyers of a club, a receipt curled up, an A4 folded in three (0.42 x 0.01 x 0.32)."""
    m = Model('rd-c-papers')
    for k, (x, z, w, d, role) in enumerate(((-0.1, 0.02, 0.1, 0.15, 'neon-pink'), (0.05, -0.06, 0.1, 0.15, 'neon-cyan'), (0.12, 0.08, 0.15, 0.1, 'trim-light'))):
        y = 0.001 + k * 0.002
        m.box(x - w, x + w * 0.4 if k == 2 else x + w, y, y + 0.002, z - d * 0.5, z + d * 0.5, role)
    m.tube((-0.18, 0.008, -0.1), (-0.12, 0.008, -0.13), 0.008, 'win-white', seg=6)
    m.box(-0.02, 0.04, 0.007, 0.009, 0.02, 0.06, 'dark')
    return m


def cable():
    """A cable coiled on the floor, its turns held with grey tape, a plug at its end (0.4 x 0.05 x 0.3)."""
    m = Model('rd-c-cable')
    seg = 18
    for ring in range(3):
        r = 0.1 + ring * 0.018
        for k in range(seg):
            a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
            y = 0.006 + ring * 0.008
            m.tube((r * math.cos(a0), y, r * math.sin(a0)), (r * math.cos(a1), y, r * math.sin(a1)), 0.006, 'dark', seg=5)
    m.box(-0.02, 0.02, 0.0, 0.03, 0.09, 0.15, 'trim')
    m.tube((0.14, 0.006, 0.0), (0.24, 0.006, 0.08), 0.006, 'dark', seg=5)
    m.box(0.23, 0.27, 0.0, 0.025, 0.07, 0.1, 'trim-light')
    return m


def bottles():
    """Two bottles, one empty and lying, and a crushed can (0.26 x 0.25 x 0.16)."""
    m = Model('rd-c-bottles')
    m.lathe(-0.06, 0.0, [(0.032, 0.0), (0.034, 0.17), (0.014, 0.21), (0.012, 0.25), (0.0, 0.25)], 'glass-dark', seg=12)
    m.lathe(-0.06, 0.0, [(0.013, 0.0), (0.0, 0.01)], 'neon-red', seg=8, y0=0.25)
    m.tube((0.0, 0.032, 0.06), (0.18, 0.032, 0.09), 0.031, 'glass-blue', seg=12)
    m.tube((0.18, 0.032, 0.09), (0.24, 0.032, 0.1), 0.012, 'glass-blue', seg=8)
    m.tube((0.08, 0.03, -0.06), (0.12, 0.035, -0.05), 0.03, 'metal', seg=10)
    return m


def laptop():
    """A laptop left open with an error on its screen (a red box over a dump of text): base and lid at 105°
    (0.34 x 0.24 x 0.25)."""
    m = Model('rd-c-laptop')
    m.box(-0.17, 0.17, 0.0, 0.018, -0.12, 0.12, 'dark', bevel=0.004)
    m.box(-0.15, 0.15, 0.018, 0.019, -0.02, 0.1, 'trim')
    lid = math.radians(105)
    h = 0.22
    top = (math.cos(math.pi - lid) * 0.0, 0.018 + math.sin(lid) * h, -0.12 - math.cos(lid) * h)
    m.tube((-0.17, 0.018, -0.12), (-0.17, top[1], top[2]), 0.006, 'dark', seg=4)
    m.tube((0.17, 0.018, -0.12), (0.17, top[1], top[2]), 0.006, 'dark', seg=4)
    steps = 6
    for k in range(steps):
        t0, t1 = k / steps, (k + 1) / steps
        y0, y1 = 0.018 + math.sin(lid) * h * t0, 0.018 + math.sin(lid) * h * t1
        z0, z1 = -0.12 - math.cos(lid) * h * t0, -0.12 - math.cos(lid) * h * t1
        m.box(-0.17, 0.17, y0, y1, min(z0, z1) - 0.006, max(z0, z1), 'dark')
        m.box(-0.15, 0.15, y0 + 0.01, y1 - 0.01 if k < steps - 1 else y1 - 0.02, max(z0, z1) + 0.0005, max(z0, z1) + 0.0015, 'neon-cyan' if k % 2 else 'neon-blue')
    m.box(-0.08, 0.08, 0.018 + math.sin(lid) * h * 0.45, 0.018 + math.sin(lid) * h * 0.7, -0.12 - math.cos(lid) * h * 0.45 + 0.002, -0.12 - math.cos(lid) * h * 0.45 + 0.003, 'neon-red')
    return m


def extinguisher():
    """A 6 kg powder extinguisher on its wall bracket, its foot at 1 m, the red sign over it (0.3 x 1.95 x 0.2; its back
    on the wall at z = 0)."""
    m = Model('rd-c-extinguisher')
    y0 = 1.0
    m.box(-0.06, 0.06, y0 + 0.12, y0 + 0.2, 0.0, 0.03, 'metal')
    m.lathe(0.0, 0.1, [(0.07, 0.0), (0.075, 0.03), (0.075, 0.42), (0.05, 0.47), (0.0, 0.48)], 'neon-red', seg=16, y0=y0)
    m.box(-0.045, 0.045, y0 + 0.15, y0 + 0.3, 0.17, 0.176, 'win-white')
    m.cyl(0.0, 0.1, 0.02, y0 + 0.47, y0 + 0.53, 'dark', seg=8)
    m.box(-0.05, 0.05, y0 + 0.52, y0 + 0.54, 0.08, 0.12, 'dark')
    m.tube((0.03, y0 + 0.5, 0.1), (0.09, y0 + 0.3, 0.15), 0.01, 'dark', seg=6)
    m.box(-0.1, 0.1, y0 + 0.75, y0 + 0.95, 0.0, 0.006, 'neon-red')
    m.box(-0.06, 0.06, y0 + 0.8, y0 + 0.9, 0.006, 0.008, 'win-white')
    return m


def hydrant():
    """The hose cabinet on the wall, its foot at 0.9 m: a red steel case, a door with its window onto the hose reel,
    a hinge side and a lock, the sign with a hose on it (0.7 x 0.95 x 0.25)."""
    m = Model('rd-c-hydrant')
    y0 = 0.9
    m.box(-0.35, 0.35, y0, y0 + 0.8, 0.0, 0.25, 'neon-red', bevel=0.01)
    m.box(-0.3, 0.3, y0 + 0.05, y0 + 0.75, 0.25, 0.255, 'neon-red')
    m.box(-0.22, 0.22, y0 + 0.15, y0 + 0.65, 0.255, 0.258, 'glass-dark')
    m.tube((0.0, y0 + 0.4, 0.12), (0.0, y0 + 0.4, 0.24), 0.17, 'win-white', seg=18)
    m.box(0.25, 0.28, y0 + 0.38, y0 + 0.45, 0.255, 0.27, 'dark')
    m.box(-0.12, 0.12, y0 + 0.85, y0 + 0.97, 0.0, 0.006, 'neon-red')
    m.box(-0.08, 0.08, y0 + 0.88, y0 + 0.94, 0.006, 0.008, 'win-white')
    return m


def fusebox():
    """A grey fuse box on the wall with its door shut, a warning sticker, a conduit up to the ceiling's line, its foot
    at 1.3 m (0.45 x 1.0 x 0.15)."""
    m = Model('rd-c-fusebox')
    y0 = 1.3
    m.box(-0.225, 0.225, y0, y0 + 0.6, 0.0, 0.15, 'trim', bevel=0.008)
    m.box(-0.205, 0.205, y0 + 0.02, y0 + 0.58, 0.15, 0.153, 'trim')
    m.box(0.16, 0.18, y0 + 0.27, y0 + 0.33, 0.153, 0.165, 'dark')
    m.box(-0.06, 0.06, y0 + 0.4, y0 + 0.5, 0.153, 0.155, 'neon-amber')
    for x in (-0.12, 0.0, 0.12):
        m.tube((x, y0 + 0.6, 0.075), (x, y0 + 1.0, 0.075), 0.012, 'pipe', seg=6)
    return m


def drain():
    """A drain's grate in the floor: a steel frame and its bars over the dark of the gully (0.5 x 0.01 x 0.5)."""
    m = Model('rd-c-drain')
    m.box(-0.25, 0.25, 0.0, 0.004, -0.25, 0.25, 'metal')
    m.box(-0.22, 0.22, 0.004, 0.005, -0.22, 0.22, 'dark')
    for k in range(9):
        x = -0.2 + k * 0.05
        m.box(x - 0.008, x + 0.008, 0.004, 0.009, -0.22, 0.22, 'metal')
    return m


def puddle():
    """A puddle on the floor where the water comes in or drips: overlapping round pools, each a hair over the last so none
    fights another, wet and glossy (§15), two drops in it (0.9 x 0.004 x 0.6)."""
    m = Model('rd-c-puddle')
    for k, (x, z, r) in enumerate(((0.0, 0.0, 0.26), (0.24, 0.08, 0.17), (-0.25, -0.05, 0.19), (0.08, -0.17, 0.14), (-0.08, 0.17, 0.12))):
        m.lathe(x, z, [(r, 0.0), (0.0, 0.0005)], 'glass-blue', seg=20, y0=0.0005 * k)
    for x, z in ((0.1, 0.05), (-0.15, -0.08)):
        m.lathe(x, z, [(0.02, 0.0), (0.0, 0.003)], 'win-white', seg=8, y0=0.003)
    return m


MODELS = [cups, cartons, papers, cable, bottles, laptop, extinguisher, hydrant, fusebox, drain, puddle]
