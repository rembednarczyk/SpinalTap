"""Neon Koi's detail (`docs/pomieszczenia/neon-koi.md`, ADR-0098): the bar after its card.

Each model stands in the frame of the simulation's solid it draws (`packages/sim/src/content/interiors.ts`,
`koi()`): its foot on y = 0, centred on x and z, its front (the room's side) to +z. The counter, the bottle
shelf and the jukebox fill their solids' boxes; the stools, tables and chairs stand on their solids; the
aquarium, the taps and the things on the counter are drawn only.
"""
import math

from shapes import Model, hashf

COUNTER = (10.0, 1.1, 0.8)
SHELF = (10.0, 2.4, 0.6)
JUKEBOX = (0.8, 1.6, 0.8)


def bar_counter():
    """The counter: a front of upright boards, a kick plate, a resin top overhanging the room side, a brass
    foot rail on brackets, a pink strip of light under the top's edge (the board's bar)."""
    w, h, d = COUNTER
    m = Model('rd-koi-counter')
    x0, x1, z0, z1 = -w / 2, w / 2, -d / 2, d / 2
    m.box(x0, x1, 0.0, 0.12, z0 + 0.04, z1 - 0.02, 'dark')
    m.box(x0, x1, 0.12, h - 0.06, z0, z1 - 0.05, 'rust')
    n = int(w / 0.12)
    for k in range(n + 1):
        x = x0 + k * w / n
        m.box(x - 0.006, x + 0.006, 0.14, h - 0.08, z1 - 0.055, z1 - 0.045, 'dark')
    m.box(x0 - 0.03, x1 + 0.03, h - 0.06, h, z0 - 0.02, z1 + 0.06, 'trim', bevel=0.012)
    m.box(x0, x1, h - 0.085, h - 0.065, z1 - 0.01, z1 + 0.04, 'neon-pink')
    rail_z, rail_y = z1 + 0.16, 0.22
    m.tube((x0 + 0.1, rail_y, rail_z), (x1 - 0.1, rail_y, rail_z), 0.025, 'fabric-amber', seg=10)
    for k in range(6):
        x = x0 + 0.3 + k * (w - 0.6) / 5
        m.tube((x, rail_y, z1 - 0.05), (x, rail_y, rail_z), 0.015, 'fabric-amber', seg=8)
    # The barman's side: a shelf under the top with glasses upside down, a sink.
    m.box(x0 + 0.1, x1 - 0.1, 0.55, 0.58, z0 + 0.02, z0 + 0.3, 'metal')
    for k in range(24):
        x = x0 + 0.3 + k * (w - 0.6) / 23
        m.lathe(x, z0 + 0.14, [(0.035, 0.0), (0.04, 0.12), (0.0, 0.12)], 'win-white', seg=8, y0=0.58)
    m.box(1.6, 2.2, h - 0.08, h - 0.02, z0 + 0.06, z0 + 0.36, 'metal')
    return m


def bottle(m, x, z, y0, seed):
    """A bottle of one of five shapes (wine, spirit, square whisky, sake, beer), its colour by the seed."""
    kind = int(seed * 5)
    role = ('glass-blue', 'shop-warm', 'fabric-amber', 'plant', 'glass-dark')[int(hashf(seed) * 5)]
    if kind == 0:
        prof = [(0.035, 0), (0.037, 0.2), (0.012, 0.26), (0.011, 0.31)]
    elif kind == 1:
        prof = [(0.04, 0), (0.04, 0.17), (0.015, 0.22), (0.013, 0.27)]
    elif kind == 2:
        m.box(x - 0.04, x + 0.04, y0, y0 + 0.2, z - 0.03, z + 0.03, role, bevel=0.008)
        m.cyl(x, z, 0.013, y0 + 0.2, y0 + 0.25, 'dark', seg=8)
        return
    elif kind == 3:
        prof = [(0.045, 0), (0.048, 0.14), (0.02, 0.2), (0.012, 0.24)]
    else:
        prof = [(0.03, 0), (0.031, 0.14), (0.012, 0.2), (0.011, 0.22)]
    m.lathe(x, z, prof, role, seg=6, y0=y0)
    m.cyl(x, z, prof[-1][0] + 0.002, y0 + prof[-1][1], y0 + prof[-1][1] + 0.02, 'dark', seg=6)
    if kind != 4:
        m.quad([(x - 0.025, y0 + 0.06, z + prof[0][0] + 0.002), (x + 0.025, y0 + 0.06, z + prof[0][0] + 0.002),
                (x + 0.025, y0 + 0.12, z + prof[0][0] + 0.002), (x - 0.025, y0 + 0.12, z + prof[0][0] + 0.002)], 'paint')


def bottle_shelf():
    """The back bar: a dark back panel with a mirror strip, four shelves lit pink at their edges, bottles in rows
    with gaps (taken, sold), the sake kettle and a cash box on the lowest."""
    w, h, d = SHELF
    m = Model('rd-koi-shelf')
    x0, x1, z0, z1 = -w / 2, w / 2, -d / 2, d / 2
    m.box(x0, x1, 0.0, h, z0, z0 + 0.05, 'dark')
    m.box(x0, x1, 0.0, 0.9, z0, z1, 'rust', bevel=0.01)
    for k in range(9):
        x = x0 + (k + 0.5) * w / 9
        m.box(x - 0.005, x + 0.005, 0.08, 0.86, z1 - 0.004, z1 + 0.002, 'dark')
    m.box(x0, x1, 1.15, 1.6, z0 + 0.05, z0 + 0.06, 'glass-blue')
    for x in (x0, x1):
        m.box(x - 0.02 if x > 0 else x, x if x > 0 else x + 0.02, 0.9, h, z0, z1, 'trim')
    for s, y in enumerate((0.9, 1.25, 1.65, 2.05)):
        m.box(x0, x1, y - 0.03, y, z0 + 0.05, z1, 'trim')
        m.box(x0, x1, y - 0.03, y - 0.015, z1, z1 + 0.006, 'neon-pink')
        x = x0 + 0.12
        k = 0
        while x < x1 - 0.12:
            seed = hashf(s, k, 7)
            if seed > 0.12 and not (s == 0 and abs(x) < 0.6):
                bottle(m, x, z1 - 0.2, y, seed)
            x += 0.13 + 0.06 * hashf(k, s)
            k += 1
    # The sake kettle and the cash box on the counter top of the back bar.
    m.lathe(-0.3, 0.05, [(0.1, 0), (0.12, 0.08), (0.1, 0.16), (0.04, 0.2), (0.0, 0.21)], 'metal', seg=12, y0=0.9)
    m.tube((-0.2, 0.98, 0.05), (-0.13, 1.06, 0.12), 0.012, 'metal')
    m.box(0.25, 0.6, 0.9, 1.08, -0.05, 0.2, 'dark', bevel=0.01)
    m.box(0.3, 0.55, 1.08, 1.09, 0.0, 0.15, 'win-teal')
    return m


def bar_stool():
    """A bar stool: a padded round seat, a chrome column, a foot ring, a heavy round base."""
    m = Model('rd-koi-stool')
    top = 0.74
    m.lathe(0, 0, [(0.2, 0.0), (0.2, 0.02)], 'metal', seg=16, y0=0.0)
    m.lathe(0, 0, [(0.09, 0.0), (0.03, 0.06)], 'metal', seg=12, y0=0.02)
    m.cyl(0, 0, 0.028, 0.06, top - 0.08, 'ac', seg=10)
    m.lathe(0, 0, [(0.16, 0.0), (0.17, 0.03), (0.17, 0.06), (0.16, 0.08), (0.0, 0.085)], 'fabric-magenta', seg=16, y0=top - 0.08)
    m.lathe(0, 0, [(0.14, 0.0), (0.155, 0.0), (0.155, 0.018), (0.14, 0.018)], 'ac', seg=16, y0=0.28, cap=False)
    for a in range(3):
        t = 2 * math.pi * a / 3
        m.tube((0.03 * math.cos(t), 0.29, 0.03 * math.sin(t)), (0.148 * math.cos(t), 0.29, 0.148 * math.sin(t)), 0.008, 'ac', seg=6)
    return m


def cafe_table():
    """A bar table: a square top with a dark edge band, a pedestal on a cross foot, a beer and a full ashtray on it."""
    m = Model('rd-koi-table')
    m.box(-0.45, 0.45, 0.71, 0.75, -0.45, 0.45, 'rust', bevel=0.01)
    m.box(-0.455, 0.455, 0.69, 0.71, -0.455, 0.455, 'dark')
    m.cyl(0, 0, 0.04, 0.03, 0.69, 'metal', seg=10)
    m.box(-0.33, 0.33, 0.0, 0.04, -0.04, 0.04, 'metal', bevel=0.01)
    m.box(-0.04, 0.04, 0.0, 0.04, -0.33, 0.33, 'metal', bevel=0.01)
    m.lathe(0.15, 0.1, [(0.035, 0), (0.04, 0.13), (0.0, 0.13)], 'shop-warm', seg=10, y0=0.75)
    m.lathe(0.15, 0.1, [(0.04, 0.0), (0.041, 0.03), (0.0, 0.03)], 'win-white', seg=10, y0=0.88)
    m.lathe(-0.18, -0.12, [(0.06, 0), (0.065, 0.025), (0.05, 0.025), (0.05, 0.01), (0.0, 0.01)], 'glass-dark', seg=10, y0=0.75)
    m.tube((-0.17, 0.778, -0.1), (-0.09, 0.79, -0.06), 0.005, 'win-white', seg=6)
    m.box(-0.1, -0.08, 0.78, 0.8, -0.07, -0.05, 'neon-red')
    return m


def cafe_chair():
    """A bar chair: a round seat on four splayed steel legs, a bent back rail."""
    m = Model('rd-koi-chair')
    seat = 0.47
    m.lathe(0, 0, [(0.19, 0.0), (0.2, 0.03), (0.19, 0.05), (0.0, 0.05)], 'rust', seg=14, y0=seat - 0.05)
    for dx, dz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        m.tube((dx * 0.12, seat - 0.05, dz * 0.12), (dx * 0.17, 0.0, dz * 0.17), 0.012, 'metal')
    m.tube((-0.12, 0.17, -0.12), (0.12, 0.17, -0.12), 0.008, 'metal')
    m.tube((-0.14, seat, -0.14), (-0.14, 0.85, -0.16), 0.012, 'metal')
    m.tube((0.14, seat, -0.14), (0.14, 0.85, -0.16), 0.012, 'metal')
    m.box(-0.17, 0.17, 0.72, 0.85, -0.19, -0.15, 'rust', bevel=0.01)
    return m


def jukebox():
    """The jukebox turned radio: a rounded wooden case, lit tubes up its sides and over the arch, the record window,
    the speaker grille, a row of buttons, the radio's screen added on its front (Yoru FM)."""
    w, h, d = JUKEBOX
    m = Model('rd-koi-jukebox')
    x0, x1, z0, z1 = -w / 2, w / 2, -d / 2, d / 2
    m.box(x0, x1, 0.0, 1.15, z0, z1, 'rust', bevel=0.03)
    # The arch: a lying half cylinder over the case, a lit tube along its front edge.
    m.tube((0, 1.15, z0), (0, 1.15, z1), w / 2, 'rust', seg=20)
    for k in range(8):
        a0, a1 = math.pi * k / 8, math.pi * (k + 1) / 8
        r = w / 2 - 0.05
        m.tube((-r * math.cos(a0), 1.15 + r * math.sin(a0), z1 + 0.01), (-r * math.cos(a1), 1.15 + r * math.sin(a1), z1 + 0.01), 0.025, 'neon-amber', seg=8)
    for x in (x0 + 0.06, x1 - 0.06):
        m.tube((x, 0.1, z1 + 0.01), (x, 1.15, z1 + 0.01), 0.025, 'neon-amber', seg=8)
    m.box(x0 + 0.14, x1 - 0.14, 0.85, 1.25, z1 - 0.01, z1 + 0.005, 'win-warm')
    m.box(x0 + 0.14, x1 - 0.14, 0.15, 0.6, z1 - 0.01, z1 + 0.005, 'ac-grille')
    for k in range(8):
        x = x0 + 0.18 + k * (w - 0.36) / 7
        m.box(x - 0.015, x + 0.015, 0.68, 0.72, z1, z1 + 0.02, 'trim-light')
    m.box(x0 + 0.25, x1 - 0.25, 0.75, 0.82, z1, z1 + 0.012, 'neon-cyan')
    return m


def aquarium():
    """The koi's tank on the back bar: glass in a black frame, water lit from above, gravel, a plant and the koi."""
    m = Model('rd-koi-aquarium')
    w, h, d = 1.2, 0.6, 0.5
    m.box(-w / 2, w / 2, 0.0, 0.06, -d / 2, d / 2, 'dark')
    m.box(-w / 2, w / 2, h - 0.04, h, -d / 2, d / 2, 'dark')
    for x in (-w / 2, w / 2 - 0.03):
        m.box(x, x + 0.03, 0.06, h - 0.04, -d / 2, d / 2, 'dark')
    # The water's body set back from the front, so the koi swim in sight before it.
    m.box(-w / 2 + 0.03, w / 2 - 0.03, 0.06, h - 0.1, -d / 2 + 0.01, d / 2 - 0.12, 'glass-blue')
    m.box(-w / 2 + 0.03, w / 2 - 0.03, 0.06, 0.1, -d / 2 + 0.02, d / 2 - 0.02, 'fabric-amber')
    m.box(-w / 2 + 0.05, w / 2 - 0.05, h - 0.08, h - 0.06, -0.05, 0.05, 'win-white')
    for k in range(5):
        x = -0.4 + 0.07 * k
        m.tube((x, 0.1, -0.1), (x + 0.03, 0.4 - 0.04 * k, -0.08), 0.012, 'plant', seg=6)
    for fx, fy, s in ((0.15, 0.32, 1.0), (-0.1, 0.22, 0.8)):
        m.lathe(fx, d / 2 - 0.06, [(0.0, -0.11 * s), (0.04 * s, -0.06 * s), (0.045 * s, 0.0), (0.03 * s, 0.06 * s), (0.0, 0.1 * s)], 'neon-amber', seg=8, y0=fy)
        m.box(fx - 0.004, fx + 0.004, fy + 0.08 * s, fy + 0.16 * s, d / 2 - 0.05, d / 2 - 0.01, 'neon-red')
    return m


def counter_things():
    """On the counter: the beer tap's tower with three handles and its drip tray, a half-drunk beer, an ashtray with a
    cigarette still burning, coasters, a bill under a glass (someone left a moment ago)."""
    m = Model('rd-koi-counter-things')
    m.box(-0.25, 0.25, 0.0, 0.02, -0.1, 0.1, 'metal')
    m.box(-0.2, 0.2, 0.02, 0.42, -0.04, 0.04, 'metal', bevel=0.01)
    for k, role in enumerate(('neon-amber', 'fabric-magenta', 'trim-light')):
        x = -0.12 + 0.12 * k
        m.tube((x, 0.36, 0.04), (x, 0.36, 0.09), 0.01, 'metal')
        m.tube((x, 0.36, 0.08), (x, 0.24, 0.09), 0.008, 'metal')
        m.cyl(x, 0.07, 0.018, 0.42, 0.58, role, seg=8)
    m.lathe(0.6, 0.05, [(0.035, 0), (0.042, 0.15), (0.0, 0.15)], 'shop-warm', seg=10)
    m.lathe(0.6, 0.05, [(0.042, 0.0), (0.043, 0.025), (0.0, 0.025)], 'win-white', seg=10, y0=0.15)
    m.lathe(0.85, -0.05, [(0.06, 0), (0.065, 0.025), (0.05, 0.025), (0.05, 0.01), (0.0, 0.01)], 'glass-dark', seg=10)
    m.tube((0.86, 0.028, -0.04), (0.95, 0.04, 0.0), 0.005, 'win-white', seg=6)
    m.box(0.945, 0.96, 0.033, 0.047, -0.006, 0.006, 'neon-red')
    for k, (x, z) in enumerate(((0.45, 0.12), (1.1, 0.1), (-0.6, 0.08))):
        m.lathe(x, z, [(0.05, 0.0), (0.05, 0.004), (0.0, 0.004)], ('fabric-magenta', 'fabric-teal', 'paint')[k], seg=12)
    m.quad([(1.05, 0.005, -0.1), (1.17, 0.005, -0.1), (1.17, 0.005, 0.06), (1.05, 0.005, 0.06)], 'paint')
    return m


MODELS = [bar_counter, bottle_shelf, bar_stool, cafe_table, cafe_chair, jukebox, aquarium, counter_things]
