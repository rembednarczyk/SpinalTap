"""The rooms' kits, batch 2 of ADR-0099 (`docs/pomieszczenia/katalog.md`, family 4): what one kind of room needs that the
shared detail of batch 1 does not give, the cards' debts of §14 and §15. The bar's washing-up behind its counter, the
clinic's washbasin and its curtain on a rail, the factory's lockers and its control cabinet, the office's chair on
castors, its shredder and its binders.

Real sizes (comic realism, `docs/zasady-lokacji.md` §9): a steel sink unit 1.2 m long and 0.9 high, a washbasin 0.5 m
wide at 0.85, a locker 0.4 m wide and 1.8 high, a control cabinet 0.8 x 2.0 x 0.4, an office chair's seat at 0.48 on a
five-star base 0.65 across. Each model's foot is on y = 0 where it stands, a wall's things with their back on z = 0 and
their front to +z, centred on x.
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-kits-props.glb'


def bar_sink():
    """The bar's washing-up behind its counter: a steel unit with two basins, a mixer tap with a spray hose, glasses
    upside down on a drying rack, a sponge and a bottle of washing-up liquid, a crate of empties under it
    (1.2 x 1.05 x 0.6)."""
    m = Model('rd-k-bar-sink')
    m.box(-0.6, 0.6, 0.0, 0.82, 0.0, 0.58, 'metal', bevel=0.01)
    m.box(-0.58, 0.58, 0.05, 0.8, 0.575, 0.585, 'trim')
    m.box(-0.6, 0.6, 0.82, 0.86, 0.0, 0.6, 'metal', bevel=0.006)
    for cx in (-0.28, 0.12):
        m.box(cx - 0.17, cx + 0.17, 0.7, 0.861, 0.12, 0.48, 'dark')
        m.lathe(cx, 0.3, [(0.025, 0.0), (0.0, 0.002)], 'metal', seg=10, y0=0.7)
    # The tap at the back between the basins, its spray on a hose.
    m.cyl(-0.08, 0.06, 0.02, 0.86, 1.2, 'metal', seg=10)
    m.tube((-0.08, 1.2, 0.06), (-0.08, 1.2, 0.26), 0.012, 'metal', seg=8)
    m.tube((-0.08, 1.2, 0.26), (-0.08, 1.12, 0.3), 0.012, 'metal', seg=8)
    m.tube((-0.02, 0.9, 0.06), (0.02, 1.05, 0.08), 0.008, 'dark', seg=6)
    # The drying rack on the right with glasses upside down, a dirty one in a basin.
    m.box(0.34, 0.58, 0.86, 0.875, 0.08, 0.52, 'trim-light')
    for k in range(6):
        x, z = 0.39 + (k % 2) * 0.12, 0.14 + (k // 2) * 0.14
        m.lathe(x, z, [(0.032, 0.0), (0.028, 0.12), (0.0, 0.12)], 'glass-blue', seg=10, y0=0.875)
    m.lathe(0.15, 0.36, [(0.03, 0.0), (0.034, 0.13), (0.0, 0.13)], 'glass-blue', seg=10, y0=0.7)
    m.box(-0.5, -0.42, 0.86, 0.9, 0.44, 0.52, 'fabric-amber')
    m.lathe(-0.54, 0.2, [(0.03, 0.0), (0.03, 0.16), (0.012, 0.2), (0.0, 0.2)], 'neon-green', seg=10, y0=0.86)
    # A crate of empties under the unit's front.
    m.box(0.1, 0.5, 0.0, 0.26, 0.6, 0.92, 'neon-red', bevel=0.01)
    for k in range(6):
        x, z = 0.17 + (k % 3) * 0.13, 0.68 + (k // 3) * 0.14
        m.lathe(x, z, [(0.03, 0.0), (0.03, 0.2), (0.012, 0.28), (0.0, 0.28)], 'glass-dark', seg=8, y0=0.02)
    return m


def washbasin():
    """The clinic's washbasin on the wall: a white basin on its bracket with a lever tap for elbows, a mirror over it, a
    soap dispenser, a paper towel box and a pedal bin under it (0.7 x 1.9 x 0.48)."""
    m = Model('rd-k-washbasin')
    m.box(-0.25, 0.25, 0.72, 0.86, 0.02, 0.46, 'win-white', bevel=0.03)
    m.box(-0.2, 0.2, 0.8, 0.861, 0.08, 0.4, 'trim-light')
    m.tube((0.0, 0.72, 0.1), (0.0, 0.45, 0.06), 0.02, 'metal', seg=8)
    m.cyl(0.0, 0.1, 0.018, 0.86, 1.08, 'metal', seg=10)
    m.tube((0.0, 1.06, 0.1), (0.0, 1.02, 0.24), 0.012, 'metal', seg=8)
    m.tube((0.0, 1.06, 0.1), (0.14, 1.06, 0.1), 0.01, 'metal', seg=6)
    # The mirror, its steel frame; the soap and the towels beside it.
    m.box(-0.24, 0.24, 1.15, 1.75, 0.0, 0.03, 'metal')
    m.box(-0.22, 0.22, 1.17, 1.73, 0.03, 0.035, 'glass-blue')
    m.box(0.3, 0.4, 1.0, 1.24, 0.0, 0.1, 'win-white', bevel=0.01)
    m.box(0.33, 0.37, 1.1, 1.14, 0.1, 0.11, 'neon-cyan')
    m.box(-0.48, -0.28, 1.05, 1.35, 0.0, 0.12, 'metal', bevel=0.008)
    m.box(-0.44, -0.32, 1.04, 1.06, 0.06, 0.12, 'win-white')
    # The pedal bin under the basin's right side.
    m.cyl(0.18, 0.25, 0.13, 0.0, 0.38, 'metal', seg=14)
    m.cyl(0.18, 0.25, 0.135, 0.38, 0.4, 'dark', seg=14)
    m.box(0.12, 0.24, 0.0, 0.03, 0.37, 0.43, 'dark')
    return m


def curtain():
    """A privacy curtain round a treatment chair: a ceiling rail with its hangers and a pleated curtain half drawn, its
    hem a hand off the floor, its rods up to a 3.9 m ceiling (1.6 x 3.9 x 0.1). Its folds zigzag along x."""
    m = Model('rd-k-curtain')
    m.box(-0.8, 0.8, 2.36, 2.4, -0.02, 0.02, 'metal')
    # Its three rods up to the ceiling of the old town's rooms (3.9 m, `interiors.ts`).
    for k in range(3):
        x = -0.7 + k * 0.7
        m.box(x - 0.01, x + 0.01, 2.4, 3.9, -0.01, 0.01, 'metal')
    folds = 14
    for k in range(folds):
        x0 = -0.7 + k * 0.1
        z0, z1 = (0.0, 0.06) if k % 2 == 0 else (0.06, 0.0)
        m.obox(((x0 + 0.05), 1.27, (z0 + z1) / 2), (0.1, 0.0, z1 - z0), (0.0, 1.0, 0.0), (0.058, 1.04, 0.006), 'fabric-teal' if k % 4 else 'trim-light')
        m.cyl(x0, 0.0, 0.008, 2.3, 2.36, 'metal', seg=6)
    return m


def lockers():
    """A row of three steel lockers for the shift, vents at their tops and bottoms, numbers stencilled, the middle one
    left open: a hard hat on its shelf, gloves hanging from a hook, a thermos at its foot (1.2 x 1.85 x 0.5)."""
    m = Model('rd-k-lockers')
    for k in range(3):
        x0 = -0.6 + k * 0.4
        if k == 1:
            # Open: a shell (back, sides, floor, top) dark inside, the shelf and the shift's things.
            m.box(x0 + 0.005, x0 + 0.395, 0.08, 1.8, 0.0, 0.02, 'dark')
            for xa, xb in ((x0 + 0.005, x0 + 0.025), (x0 + 0.375, x0 + 0.395)):
                m.box(xa, xb, 0.08, 1.8, 0.0, 0.48, 'metal')
            m.box(x0 + 0.025, x0 + 0.375, 0.08, 0.1, 0.0, 0.48, 'metal')
            m.box(x0 + 0.025, x0 + 0.375, 1.78, 1.8, 0.0, 0.48, 'metal')
            m.box(x0 + 0.03, x0 + 0.37, 1.45, 1.47, 0.02, 0.46, 'metal')
            m.lathe(x0 + 0.2, 0.25, [(0.14, 0.0), (0.13, 0.06), (0.08, 0.13), (0.0, 0.15)], 'neon-amber', seg=14, y0=1.47)
            m.tube((x0 + 0.32, 1.3, 0.3), (x0 + 0.32, 1.38, 0.3), 0.01, 'metal', seg=6)
            m.box(x0 + 0.27, x0 + 0.37, 1.02, 1.3, 0.28, 0.32, 'fabric-amber')
            m.cyl(x0 + 0.12, 0.3, 0.045, 0.1, 0.42, 'fabric-teal', seg=12)
            m.cyl(x0 + 0.12, 0.3, 0.035, 0.42, 0.47, 'dark', seg=12)
            # The door swung out square to the row from its hinge at the right edge, its inside to the room's left.
            m.obox((x0 + 0.405, 0.95, 0.69), (0.0, 0.0, 1.0), (0.0, 1.0, 0.0), (0.2, 0.85, 0.01), 'metal', bevel=0.004)
        else:
            m.box(x0 + 0.005, x0 + 0.395, 0.08, 1.8, 0.0, 0.48, 'metal', bevel=0.006)
            m.box(x0 + 0.02, x0 + 0.38, 0.1, 1.78, 0.48, 0.49, 'metal')
            for y in (0.2, 0.26, 1.6, 1.66):
                m.box(x0 + 0.08, x0 + 0.32, y, y + 0.02, 0.49, 0.495, 'dark')
            m.box(x0 + 0.33, x0 + 0.35, 0.9, 1.05, 0.49, 0.51, 'trim')
        if k != 1:
            m.box(x0 + 0.14, x0 + 0.26, 1.7, 1.75, 0.49, 0.492, 'win-white')
    m.box(-0.6, 0.6, 0.0, 0.08, 0.02, 0.46, 'dark')
    m.box(-0.6, 0.6, 1.8, 1.85, 0.0, 0.48, 'metal')
    return m


def control_cabinet():
    """A control cabinet of the line: a grey steel case on its plinth, a screen with a fault, a row of lit buttons, an
    emergency stop, a key switch, warning stickers, the cable conduit up from its top (0.8 x 2.4 x 0.42)."""
    m = Model('rd-k-control-cabinet')
    m.box(-0.4, 0.4, 0.0, 0.1, 0.02, 0.4, 'dark')
    m.box(-0.4, 0.4, 0.1, 2.0, 0.0, 0.4, 'metal', bevel=0.008)
    m.box(-0.38, 0.38, 0.12, 1.98, 0.4, 0.405, 'trim')
    m.box(0.36, 0.38, 0.9, 1.2, 0.405, 0.43, 'dark')
    m.box(-0.3, 0.1, 1.45, 1.75, 0.405, 0.41, 'dark')
    m.box(-0.28, 0.08, 1.47, 1.73, 0.41, 0.412, 'neon-cyan')
    m.box(-0.26, 0.06, 1.62, 1.66, 0.412, 0.414, 'neon-red')
    for k, role in enumerate(('neon-green', 'neon-green', 'neon-amber', 'neon-red', 'neon-blue')):
        m.cyl(-0.26 + k * 0.08, 0.42, 0.018, 1.3, 1.31, role, seg=8)
    # The emergency stop: a red mushroom on a yellow plate.
    m.box(0.16, 0.3, 1.24, 1.38, 0.405, 0.41, 'neon-amber')
    m.tube((0.23, 1.31, 0.41), (0.23, 1.31, 0.46), 0.04, 'neon-red', seg=12)
    m.box(0.2, 0.26, 1.5, 1.56, 0.405, 0.43, 'metal')
    m.box(-0.3, -0.1, 0.6, 0.78, 0.405, 0.407, 'neon-amber')
    m.box(0.0, 0.3, 0.6, 0.75, 0.405, 0.407, 'win-white')
    m.box(-0.1, 0.1, 2.0, 2.4, 0.12, 0.28, 'metal')
    return m


def office_chair():
    """An office chair on castors pushed back from its desk: five-star base, gas lift, a seat at 0.48, a mesh back and
    arms, turned a little as somebody left it (0.65 x 1.1 x 0.65)."""
    m = Model('rd-k-office-chair')
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        x, z = math.cos(a) * 0.3, math.sin(a) * 0.3
        m.tube((0.0, 0.1, 0.0), (x, 0.07, z), 0.022, 'dark', seg=6)
        m.lathe(x, z, [(0.03, 0.0), (0.03, 0.05), (0.0, 0.05)], 'dark', seg=8, y0=0.0)
    m.cyl(0.0, 0.0, 0.03, 0.1, 0.42, 'metal', seg=10)
    m.box(-0.25, 0.25, 0.42, 0.5, -0.24, 0.24, 'fabric-magenta', bevel=0.03)
    m.box(-0.23, 0.23, 0.55, 1.05, -0.28, -0.25, 'dark', bevel=0.02)
    m.box(-0.21, 0.21, 0.58, 1.02, -0.25, -0.245, 'fabric-teal')
    m.tube((0.0, 0.48, -0.15), (0.0, 0.62, -0.26), 0.02, 'metal', seg=6)
    for x in (-0.26, 0.26):
        m.tube((x, 0.5, 0.0), (x, 0.66, 0.02), 0.015, 'dark', seg=6)
        m.box(x - 0.03, x + 0.03, 0.66, 0.69, -0.12, 0.14, 'dark', bevel=0.01)
    return m


def shredder():
    """A shredder on its bin by the desk: the cutting head with its slot and a lit button, the bin's window full of
    strips, a few strips spilt at its foot (0.36 x 0.62 x 0.26)."""
    m = Model('rd-k-shredder')
    m.box(-0.17, 0.17, 0.0, 0.5, -0.12, 0.12, 'dark', bevel=0.01)
    m.box(-0.12, 0.12, 0.1, 0.4, 0.12, 0.121, 'trim')
    for k in range(12):
        x = -0.1 + k * 0.018
        h = 0.18 + 0.1 * hashf(k, 3)
        m.box(x, x + 0.006, 0.11, 0.11 + h, 0.121, 0.124, 'win-white')
    m.box(-0.18, 0.18, 0.5, 0.6, -0.13, 0.13, 'metal', bevel=0.01)
    m.box(-0.12, 0.12, 0.6, 0.602, -0.005, 0.005, 'dark')
    m.cyl(0.13, 0.08, 0.012, 0.6, 0.61, 'neon-green', seg=8)
    for k in range(5):
        x = -0.16 + k * 0.08
        m.box(x, x + 0.006, 0.0, 0.002, 0.14, 0.14 + 0.1 + 0.05 * hashf(k, 9), 'win-white')
    return m


def binders():
    """Binders standing on a top: six lever-arch files with coloured spines and white labels, the last one leant over,
    a box file at the end (0.55 x 0.32 x 0.3)."""
    m = Model('rd-k-binders')
    roles = ('dark', 'neon-blue', 'dark', 'neon-red', 'trim-light', 'dark')
    for k, role in enumerate(roles):
        x0 = -0.26 + k * 0.075
        if k == 5:
            m.obox((x0 + 0.06, 0.15, 0.0), (0.96, -0.28, 0.0), (0.28, 0.96, 0.0), (0.035, 0.15, 0.14), role, bevel=0.004)
            continue
        m.box(x0, x0 + 0.07, 0.0, 0.31, -0.14, 0.14, role, bevel=0.004)
        m.box(x0 + 0.01, x0 + 0.06, 0.18, 0.26, 0.14, 0.142, 'win-white')
        m.lathe(x0 + 0.035, 0.141, [(0.012, 0.0), (0.0, 0.001)], 'trim', seg=8, y0=0.08)
    return m


MODELS = [bar_sink, washbasin, curtain, lockers, control_cabinet, office_chair, shredder, binders]
