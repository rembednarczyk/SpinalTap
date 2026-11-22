"""Doktor Mori's clinic (`docs/pomieszczenia/clinic.md`, ADR-0098): the waiting room and the surgery after the card.

Each model stands in the frame of the simulation's solid it draws (`clinic()` of
`packages/sim/src/content/interiors.ts`): its foot on y = 0, centred on x and z, its front to +z.
"""
import math

from shapes import Model, hashf


def bench():
    """The waiting room's bench: three moulded plastic seats on a steel beam, two legs, one seat cracked (2.8 x 0.45 x 0.5)."""
    m = Model('rd-clinic-bench')
    w, d = 2.8, 0.5
    m.box(-w / 2 + 0.1, w / 2 - 0.1, 0.32, 0.37, -0.06, 0.02, 'metal', bevel=0.01)
    for x in (-w / 2 + 0.3, w / 2 - 0.3):
        m.box(x - 0.03, x + 0.03, 0.0, 0.34, -0.05, 0.01, 'metal')
        m.box(x - 0.04, x + 0.04, 0.0, 0.02, -d / 2 + 0.02, d / 2 - 0.02, 'metal')
    for k in range(4):
        x = -w / 2 + 0.35 + k * 0.7
        role = 'fabric-teal' if k != 2 else 'trim-light'
        m.box(x - 0.31, x + 0.31, 0.37, 0.42, -d / 2 + 0.02, d / 2 - 0.04, role, bevel=0.02)
        m.box(x - 0.31, x + 0.31, 0.42, 0.85, -d / 2, -d / 2 + 0.05, role, bevel=0.02)
    m.box(-0.12, 0.25, 0.42, 0.425, 0.0, 0.03, 'dark')
    m.quad([(0.5, 0.425, 0.05), (0.7, 0.425, 0.05), (0.7, 0.425, -0.12), (0.5, 0.425, -0.12)], 'paint')
    return m


def reception():
    """The reception counter: a front panel of perforated steel, a white top, the nurse's screen on an arm, a card reader (1.6 x 1.05 x 0.8)."""
    m = Model('rd-clinic-reception')
    w, h, d = 1.6, 1.05, 0.8
    m.box(-w / 2, w / 2, 0.0, 0.08, -d / 2 + 0.03, d / 2 - 0.03, 'dark')
    m.box(-w / 2, w / 2, 0.08, h - 0.05, -d / 2, d / 2 - 0.02, 'trim-light')
    for k in range(9):
        for j in range(5):
            x, y = -w / 2 + 0.15 + k * 0.16, 0.2 + j * 0.15
            m.box(x - 0.025, x + 0.025, y - 0.025, y + 0.025, d / 2 - 0.021, d / 2 - 0.015, 'dark')
    m.box(-w / 2 - 0.02, w / 2 + 0.02, h - 0.05, h, -d / 2 - 0.02, d / 2 + 0.06, 'ac', bevel=0.01)
    m.cyl(-0.4, -0.2, 0.06, h, h + 0.02, 'metal', seg=10)
    m.tube((-0.4, h + 0.02, -0.2), (-0.4, h + 0.3, -0.2), 0.015, 'metal')
    m.box(-0.65, -0.15, h + 0.3, h + 0.62, -0.22, -0.18, 'dark', bevel=0.01)
    m.box(-0.62, -0.18, h + 0.33, h + 0.59, -0.18, -0.175, 'win-teal')
    m.box(0.35, 0.47, h, h + 0.05, 0.1, 0.25, 'dark', bevel=0.008)
    m.box(0.37, 0.45, h + 0.05, h + 0.052, 0.12, 0.2, 'neon-green')
    return m


def chair():
    """The treatment chair, the board's: a padded couch on a hydraulic column, the back raised at its head, a foot rest,
    arm rests with straps, a foot pedal (along x, head at -x: 2 x 1.15 x 0.8)."""
    m = Model('rd-clinic-chair')
    m.box(-0.35, 0.35, 0.0, 0.05, -0.3, 0.3, 'metal', bevel=0.02)
    m.cyl(0, 0, 0.09, 0.05, 0.3, 'ac', seg=14)
    m.box(-0.3, 0.3, 0.3, 0.36, -0.2, 0.2, 'metal')
    m.box(-0.55, 0.85, 0.36, 0.45, -0.32, 0.32, 'fabric-teal', bevel=0.04)
    # The back raised 35 degrees at the head: one padded board along the slope.
    a = math.radians(35)
    along = (-math.cos(a), math.sin(a), 0.0)
    up = (math.sin(a), math.cos(a), 0.0)
    m.obox((-0.55 - 0.33 * math.cos(a), 0.42 + 0.33 * math.sin(a), 0.0), along, up, (0.36, 0.05, 0.31), 'fabric-teal', bevel=0.03)
    m.obox((-1.08, 0.88, 0.0), along, up, (0.1, 0.06, 0.16), 'fabric-teal', bevel=0.03)
    m.box(0.85, 1.0, 0.3, 0.42, -0.3, 0.3, 'fabric-teal', bevel=0.03)
    for z in (-0.36, 0.36):
        m.box(-0.45, 0.25, 0.58, 0.62, z - 0.05, z + 0.05, 'dark', bevel=0.01)
        m.tube((-0.4, 0.45, z), (-0.4, 0.58, z), 0.012, 'metal')
        m.tube((0.2, 0.45, z), (0.2, 0.58, z), 0.012, 'metal')
        m.box(-0.12, -0.08, 0.56, 0.64, z - 0.06, z + 0.06, 'fabric-amber')
    m.box(0.25, 0.4, 0.02, 0.06, 0.32, 0.42, 'dark', bevel=0.01)
    return m


def lamp():
    """The surgical lamp from the ceiling (3.9 m over the floor, its model's top): a post, an arm across, two round heads
    each with a ring of six lenses lit cold white under them; its foot is the heads' underside."""
    m = Model('rd-clinic-lamp')
    top, head = 3.9 - 2.83, 0.12
    m.cyl(0, 0, 0.09, top - 0.03, top, 'metal', seg=12)
    m.cyl(0, 0, 0.035, 0.45, top - 0.03, 'ac', seg=10)
    m.tube((0, 0.45, -0.45), (0, 0.45, 0.45), 0.03, 'ac', seg=10)
    for z in (-0.45, 0.45):
        m.tube((0, 0.45, z), (0, head + 0.06, z), 0.02, 'ac', seg=8)
        m.lathe(0, z, [(0.0, head + 0.02), (0.26, head + 0.02), (0.3, 0.06), (0.3, 0.0)], 'trim-light', seg=18)
        m.lathe(0, z, [(0.26, 0.0), (0.0, 0.0)], 'trim', seg=18, cap=False)
        for k in range(6):
            a = 2 * math.pi * k / 6
            m.cyl(0.16 * math.cos(a), z + 0.16 * math.sin(a), 0.05, -0.006, 0.0, 'win-white', seg=10)
        m.cyl(0, z, 0.05, -0.006, 0.0, 'win-white', seg=10)
    return m


def cart():
    """The instrument cart: steel frame on four castors, three drawers, a tray on top with instruments and blood-stained gauze,
    a box of gloves, a syringe (0.6 x 0.9 x 0.6)."""
    m = Model('rd-clinic-cart')
    w, h, d = 0.6, 0.9, 0.6
    for x in (-w / 2 + 0.04, w / 2 - 0.04):
        for z in (-d / 2 + 0.04, d / 2 - 0.04):
            m.tube((x, 0.08, z), (x, h - 0.02, z), 0.015, 'metal')
            m.lathe(x, z, [(0.0, 0.0), (0.035, 0.0), (0.035, 0.05), (0.0, 0.05)], 'dark', seg=8)
    m.box(-w / 2, w / 2, 0.12, 0.62, -d / 2 + 0.06, d / 2 - 0.06, 'trim-light', bevel=0.01)
    for k in range(3):
        y = 0.18 + k * 0.15
        m.box(-w / 2 + 0.02, w / 2 - 0.02, y, y + 0.12, d / 2 - 0.065, d / 2 - 0.05, 'ac', bevel=0.005)
        m.box(-0.08, 0.08, y + 0.05, y + 0.07, d / 2 - 0.05, d / 2 - 0.03, 'metal')
    m.box(-w / 2 - 0.01, w / 2 + 0.01, h - 0.03, h, -d / 2 - 0.01, d / 2 + 0.01, 'metal')
    m.box(-w / 2, w / 2, h, h + 0.025, -d / 2, -d / 2 + 0.01, 'metal')
    m.box(-w / 2, w / 2, h, h + 0.025, d / 2 - 0.01, d / 2, 'metal')
    for k in range(5):
        x = -0.2 + k * 0.07
        m.box(x - 0.006, x + 0.006, h, h + 0.008, -0.18, 0.05, 'win-white')
    m.box(0.1, 0.24, h, h + 0.01, -0.05, 0.12, 'paint')
    m.box(0.13, 0.19, h + 0.01, h + 0.012, -0.02, 0.06, 'neon-red')
    m.box(-0.25, -0.05, h, h + 0.08, 0.12, 0.25, 'fabric-teal')
    m.tube((0.12, h + 0.012, -0.2), (0.24, h + 0.012, -0.15), 0.008, 'win-white', seg=6)
    return m


def cabinet():
    """The medicine cabinet against the back wall: a steel case, two glass doors with shelves of bottles and boxes behind them,
    the autoclave on top with its red diode, the pawnshop's old safe beside it at the bottom (1.5 x 2 x 0.6)."""
    m = Model('rd-clinic-cabinet')
    w, h, d = 1.5, 2.0, 0.6
    m.box(-w / 2, w / 2, 0.0, h, -d / 2, d / 2 - 0.02, 'trim-light', bevel=0.01)
    m.box(-w / 2 + 0.04, w / 2 - 0.04, 0.85, h - 0.06, d / 2 - 0.021, d / 2 - 0.015, 'glass-blue')
    m.box(-0.01, 0.01, 0.85, h - 0.06, d / 2 - 0.015, d / 2 - 0.005, 'metal')
    for y in (1.2, 1.55):
        m.box(-w / 2 + 0.05, w / 2 - 0.05, y - 0.015, y, -d / 2 + 0.05, d / 2 - 0.05, 'metal')
    for s, y in enumerate((0.85, 1.2, 1.55)):
        x = -w / 2 + 0.12
        k = 0
        while x < w / 2 - 0.1:
            r = hashf(s, k, 3)
            if r < 0.5:
                m.lathe(x, 0.1, [(0.03, 0), (0.03, 0.12), (0.012, 0.15)], 'win-white' if r < 0.25 else 'fabric-amber', seg=6, y0=y)
            else:
                m.box(x - 0.05, x + 0.05, y, y + 0.08 + 0.06 * r, 0.0, 0.18, 'paint')
            x += 0.13
            k += 1
    for x in (-w / 2 + 0.05, 0.03):
        m.box(x, x + 0.67, 0.08, 0.8, d / 2 - 0.021, d / 2 - 0.015, 'ac')
        m.box(x + 0.55, x + 0.6, 0.4, 0.5, d / 2 - 0.015, d / 2, 'metal')
    m.box(-0.45, 0.45, h, h + 0.4, -0.25, 0.2, 'ac', bevel=0.02)
    m.lathe(0.0, 0.2, [(0.15, 0.0), (0.15, 0.02), (0.0, 0.02)], 'metal', seg=16, y0=h + 0.05)
    m.box(0.3, 0.34, h + 0.3, h + 0.34, 0.2, 0.21, 'neon-red')
    return m


def counter_things():
    """On the reception counter: a stack of patient cards, a cold coffee, an ashtray full of stubs, a pen (Mori smokes here)."""
    m = Model('rd-clinic-counter-things')
    for k in range(6):
        m.box(-0.12 + 0.004 * k, 0.1 + 0.003 * k, 0.004 * k, 0.004 * (k + 1), -0.08, 0.08, 'paint')
    m.lathe(0.25, 0.0, [(0.035, 0), (0.04, 0.09), (0.0, 0.09)], 'trim-light', seg=10)
    m.cyl(0.25, 0.0, 0.034, 0.075, 0.08, 'rust', seg=10)
    m.lathe(-0.3, 0.05, [(0.06, 0), (0.065, 0.025), (0.05, 0.025), (0.05, 0.01), (0.0, 0.01)], 'glass-dark', seg=10)
    for k in range(5):
        a = 2 * math.pi * k / 5
        x, z = -0.3 + 0.03 * math.cos(a), 0.05 + 0.03 * math.sin(a)
        m.tube((x, 0.015, z), (x + 0.03 * math.cos(a + 1), 0.02, z + 0.03 * math.sin(a + 1)), 0.005, 'win-white', seg=6)
    m.tube((-0.05, 0.03, 0.12), (0.1, 0.03, 0.16), 0.004, 'neon-cyan', seg=6)
    return m


def sharps_bin():
    """The bin for medical waste by the chair: yellow with a red lid, a biohazard label (0.3 x 0.45 x 0.3)."""
    m = Model('rd-clinic-sharps')
    m.box(-0.15, 0.15, 0.0, 0.4, -0.15, 0.15, 'fabric-amber', bevel=0.02)
    m.box(-0.16, 0.16, 0.4, 0.45, -0.16, 0.16, 'neon-red', bevel=0.01)
    m.box(-0.07, 0.07, 0.15, 0.27, 0.15, 0.152, 'dark')
    return m


# The props file the room's models go to (one a district, each under its budget, ADR-0098).
FILE = 'room-detail-props.glb'
MODELS = [bench, reception, chair, lamp, cart, cabinet, counter_things, sharps_bin]
