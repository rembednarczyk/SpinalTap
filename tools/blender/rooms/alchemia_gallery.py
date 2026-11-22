"""Alchemia's gallery (`docs/pomieszczenia/alchemia-gallery.md`, ADR-0098): the goods on its shops' shelves by trade, where
the shelves had boxes of goods (`packages/sim/src/content/alchemia/shop-fittings.ts`, `shelves`).

One model a trade: half a metre of a shelf's goods (0.5 x 0.36 x 0.28 at most, the shelves 0.45 m apart, their boards
0.03 thick), its foot on the board, its front to +z, to the customers. The shelves line them up with a gap now and then,
a sold-out place, each run this model or its mirror (`-b`) by a hash of its place. Each has a phone's model (`-lod`,
`docs/zasady-lokacji.md` §9: simplified only on the phone and from afar): the same goods' outline in a few plain boxes,
the colours the eye reads from the aisle.
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-galeria-props.glb'


def label(m, x0, x1, y0, y1, z, role):
    """A printed label flat on a front at `z`."""
    m.quad([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], role)


def carton_row(m, xs, role, tape, key):
    """Cartons side by side along x (their [x0, x1] spans), heights a hash of the place, a strip of tape over each."""
    for i, (x0, x1) in enumerate(xs):
        h = 0.18 + 0.14 * hashf(key, i)
        d = 0.1 + 0.03 * hashf(key, i, 1.0)
        m.box(x0, x1, 0.0, h, -d, d, role)
        label(m, (x0 + x1) / 2 - 0.02, (x0 + x1) / 2 + 0.02, 0.0, h, d + 0.001, tape)


def pharmacy():
    """A pharmacy's shelf: boxes of pills printed white with a green cross, brown glass bottles with white caps, a row of
    blister packs on their hook strip."""
    m = Model('rd-gl-pharmacy')
    for i, (x0, x1) in enumerate(((-0.24, -0.15), (-0.14, -0.05))):
        h = 0.14 + 0.04 * i
        m.box(x0, x1, 0.0, h, -0.06, 0.06, 'trim-light')
        cx = (x0 + x1) / 2
        label(m, cx - 0.025, cx + 0.025, h * 0.45, h * 0.55, 0.061, 'neon-green')
        label(m, cx - 0.008, cx + 0.008, h * 0.35, h * 0.65, 0.0612, 'neon-green')
    for i, x in enumerate((0.0, 0.07, 0.14)):
        z = 0.02 * (i % 2)
        m.lathe(x, z, [(0.025, 0.0), (0.028, 0.08), (0.012, 0.1), (0.012, 0.11)], 'fabric-amber', seg=8)
        m.cyl(x, z, 0.014, 0.11, 0.13, 'trim-light', seg=8)
    m.box(0.18, 0.245, 0.0, 0.2, -0.08, -0.06, 'metal')
    for j in range(3):
        y = 0.04 + j * 0.055
        m.box(0.185, 0.24, y, y + 0.045, -0.06, -0.055, 'win-white')
    return m


def pharmacy_lod():
    m = Model('rd-gl-pharmacy-lod')
    m.box(-0.24, -0.05, 0.0, 0.17, -0.06, 0.06, 'trim-light')
    m.box(-0.03, 0.17, 0.0, 0.13, -0.03, 0.05, 'fabric-amber')
    m.box(0.18, 0.245, 0.0, 0.2, -0.08, -0.055, 'metal')
    return m


def electronics():
    """An electronics shop's shelf: gadgets boxed dark with their picture lit on the front, a phone on a stand showing its
    screen, a pair of headphones on a hook."""
    m = Model('rd-gl-electronics')
    for i, (x0, x1, h) in enumerate(((-0.24, -0.1, 0.22), (-0.09, 0.02, 0.16))):
        m.box(x0, x1, 0.0, h, -0.09, 0.09, 'dark')
        label(m, x0 + 0.015, x1 - 0.015, h * 0.3, h * 0.85, 0.091, 'win-teal' if i == 0 else 'neon-blue')
    m.obox((0.09, 0.075, 0.02), (1, 0, 0), (0, 0.97, -0.24), (0.035, 0.075, 0.005), 'dark')
    m.quad([(0.06, 0.01, 0.027), (0.12, 0.01, 0.027), (0.12, 0.14, -0.005), (0.06, 0.14, -0.005)], 'win-teal')
    m.box(0.06, 0.12, 0.0, 0.01, -0.03, 0.04, 'metal')
    m.tube((0.2, 0.0, -0.1), (0.2, 0.3, -0.1), 0.005, 'metal', seg=4)
    pts = [(0.2 + 0.06 * math.cos(a), 0.22 + 0.07 * math.sin(a), -0.07) for a in (0.0, 0.8, 1.6, 2.4, 3.14)]
    for a, b in zip(pts, pts[1:]):
        m.tube(a, b, 0.008, 'dark', seg=5)
    for x in (0.14, 0.26):
        m.cyl(x, -0.07, 0.03, 0.1, 0.13, 'neon-pink', seg=8)
    return m


def electronics_lod():
    m = Model('rd-gl-electronics-lod')
    m.box(-0.24, 0.02, 0.0, 0.22, -0.09, 0.09, 'dark')
    m.box(-0.22, 0.0, 0.07, 0.19, 0.09, 0.092, 'win-teal')
    m.box(0.06, 0.12, 0.0, 0.15, -0.03, 0.03, 'dark')
    return m


def food():
    """A synthetic-food shop's shelf: cans in their printed colours, cups of instant noodles stacked, a packet leaning."""
    m = Model('rd-gl-food')
    for i, x in enumerate((-0.21, -0.14, -0.07)):
        for j in range(2):
            role = ('fabric-magenta', 'fabric-teal', 'neon-red')[(i + j) % 3]
            m.cyl(x, -0.04 + 0.08 * j, 0.032, 0.0, 0.12, role, seg=8)
            m.cyl(x, -0.04 + 0.08 * j, 0.03, 0.12, 0.125, 'metal', seg=8)
    for j in range(3):
        y = j * 0.085
        m.lathe(0.05, 0.0, [(0.035, 0.0), (0.047, 0.085), (0.0, 0.085)], 'trim-light', seg=10, y0=y)
        label(m, 0.03, 0.07, y + 0.03, y + 0.06, 0.042, 'neon-red')
    m.obox((0.17, 0.11, 0.0), (0.97, 0.24, 0), (-0.24, 0.97, 0), (0.06, 0.11, 0.035), 'fabric-amber')
    label(m, 0.13, 0.2, 0.08, 0.16, 0.036, 'neon-amber')
    return m


def food_lod():
    m = Model('rd-gl-food-lod')
    m.box(-0.245, -0.035, 0.0, 0.125, -0.075, 0.075, 'fabric-magenta')
    m.box(0.01, 0.095, 0.0, 0.25, -0.045, 0.045, 'trim-light')
    m.box(0.12, 0.23, 0.0, 0.21, -0.035, 0.035, 'fabric-amber')
    return m


def pawn():
    """A pawn shop's shelf of what people left: an old radio with its dial and knobs, a vase, a camera with its lens, a
    watch in an open box, a ticket tied to each."""
    m = Model('rd-gl-pawn')
    m.box(-0.245, -0.07, 0.0, 0.14, -0.06, 0.06, 'rust')
    label(m, -0.23, -0.14, 0.03, 0.11, 0.061, 'metal')
    label(m, -0.13, -0.085, 0.07, 0.11, 0.061, 'win-warm')
    for x in (-0.12, -0.09):
        m.tube((x, 0.04, 0.06), (x, 0.04, 0.075), 0.01, 'dark', seg=6)
    m.lathe(0.0, 0.0, [(0.03, 0.0), (0.05, 0.08), (0.025, 0.2), (0.03, 0.24)], 'brick', seg=10)
    m.box(0.07, 0.17, 0.0, 0.08, -0.04, 0.04, 'dark')
    m.tube((0.12, 0.04, 0.04), (0.12, 0.04, 0.09), 0.028, 'metal', seg=10)
    m.box(0.18, 0.245, 0.0, 0.03, -0.04, 0.04, 'fabric-magenta')
    m.lathe(0.212, 0.0, [(0.02, 0.0), (0.02, 0.012), (0.0, 0.012)], 'neon-amber', seg=10, y0=0.03)
    for x in (-0.16, 0.0, 0.12):
        m.box(x - 0.012, x + 0.012, 0.0, 0.03, 0.08, 0.082, 'win-white')
    return m


def pawn_lod():
    m = Model('rd-gl-pawn-lod')
    m.box(-0.245, -0.07, 0.0, 0.14, -0.06, 0.06, 'rust')
    m.box(-0.035, 0.035, 0.0, 0.24, -0.035, 0.035, 'brick')
    m.box(0.07, 0.17, 0.0, 0.08, -0.04, 0.09, 'dark')
    return m


def repair():
    """A repair shop's shelf: parts bins, their fronts labelled, phone screens stacked, a soldering iron in its stand."""
    m = Model('rd-gl-repair')
    for i, x0 in enumerate((-0.245, -0.13)):
        m.box(x0, x0 + 0.11, 0.0, 0.1, -0.12, 0.12, 'neon-blue' if i == 0 else 'neon-amber')
        m.box(x0 + 0.01, x0 + 0.1, 0.1, 0.101, -0.11, 0.11, 'dark')
        label(m, x0 + 0.02, x0 + 0.09, 0.03, 0.07, 0.121, 'win-white')
        for j in range(3):
            g = hashf(i, j, 5.0)
            m.box(x0 + 0.02 + 0.025 * j, x0 + 0.04 + 0.025 * j, 0.1, 0.12 + 0.03 * g, -0.05 + 0.04 * j, -0.03 + 0.04 * j, 'metal')
    for j in range(4):
        y = j * 0.012
        d = 0.004 * (j % 2)
        m.box(0.0 + d, 0.08 + d, y, y + 0.008, -0.07, 0.08, 'dark')
    label(m, 0.006, 0.086, 0.04, 0.048, 0.0801, 'win-teal')
    m.box(0.13, 0.2, 0.0, 0.015, -0.05, 0.05, 'metal')
    m.tube((0.165, 0.015, 0.0), (0.2, 0.09, 0.03), 0.006, 'metal', seg=5)
    m.tube((0.2, 0.09, 0.03), (0.23, 0.12, 0.05), 0.012, 'neon-red', seg=6)
    return m


def repair_lod():
    m = Model('rd-gl-repair-lod')
    m.box(-0.245, -0.135, 0.0, 0.1, -0.12, 0.12, 'neon-blue')
    m.box(-0.13, -0.02, 0.0, 0.1, -0.12, 0.12, 'neon-amber')
    m.box(0.0, 0.2, 0.0, 0.05, -0.07, 0.08, 'dark')
    return m


def implants():
    """An implant clinic's shelf: specimen jars lit from under with an eye or a chip in each, chromed forearm frames
    lying, a case with a lit strip."""
    m = Model('rd-gl-implants')
    for i, x in enumerate((-0.2, -0.11)):
        m.cyl(x, 0.0, 0.04, 0.0, 0.02, 'dark', seg=10)
        m.lathe(x, 0.0, [(0.035, 0.0), (0.035, 0.14), (0.0, 0.14)], 'glass-blue', seg=10, y0=0.02)
        m.lathe(x, 0.0, [(0.0, 0.0), (0.018, 0.018), (0.0, 0.036)], 'neon-cyan' if i == 0 else 'neon-violet', seg=8, y0=0.07)
        m.cyl(x, 0.0, 0.037, 0.16, 0.175, 'metal', seg=10)
    for j in range(2):
        z = -0.05 + 0.09 * j
        m.tube((-0.04, 0.02, z), (0.12, 0.02, z + 0.02), 0.018, 'metal', seg=8)
        m.tube((-0.04, 0.02, z), (-0.06, 0.03, z), 0.024, 'trim-light', seg=8)
    m.box(0.14, 0.245, 0.0, 0.06, -0.1, 0.1, 'dark')
    m.box(0.145, 0.24, 0.06, 0.062, -0.09, 0.09, 'neon-cyan')
    return m


def implants_lod():
    m = Model('rd-gl-implants-lod')
    m.box(-0.24, -0.07, 0.0, 0.175, -0.04, 0.04, 'glass-blue')
    m.box(-0.06, 0.12, 0.0, 0.04, -0.07, 0.06, 'metal')
    m.box(0.14, 0.245, 0.0, 0.062, -0.1, 0.1, 'dark')
    return m


def arms():
    """A gun shop's shelf behind its bars: olive ammunition tins with stencilled lots, boxes of cartridges, magazines
    leaning in a row, a rifle scope."""
    m = Model('rd-gl-arms')
    for i, x0 in enumerate((-0.245, -0.14)):
        m.box(x0, x0 + 0.095, 0.0, 0.16, -0.08, 0.08, 'plant')
        m.box(x0 + 0.02, x0 + 0.075, 0.16, 0.175, -0.01, 0.01, 'dark')
        label(m, x0 + 0.015, x0 + 0.08, 0.05, 0.1, 0.081, 'neon-amber')
    for j in range(2):
        y = j * 0.05
        m.box(-0.03, 0.06, y, y + 0.045, -0.06, 0.06, 'fabric-amber')
        label(m, -0.02, 0.05, y + 0.015, y + 0.03, 0.061, 'neon-red')
    for j in range(4):
        x = 0.09 + 0.035 * j
        m.obox((x, 0.07, -0.02), (1, 0, 0), (0, 0.97, -0.24), (0.012, 0.07, 0.03), 'dark')
    m.tube((0.0, 0.135, -0.05), (0.2, 0.135, -0.05), 0.016, 'dark', seg=8)
    m.tube((0.0, 0.135, -0.05), (-0.02, 0.135, -0.05), 0.022, 'dark', seg=8)
    m.box(0.05, 0.07, 0.1, 0.12, -0.06, -0.04, 'metal')
    return m


def arms_lod():
    m = Model('rd-gl-arms-lod')
    m.box(-0.245, -0.045, 0.0, 0.16, -0.08, 0.08, 'plant')
    m.box(-0.03, 0.06, 0.0, 0.095, -0.06, 0.06, 'fabric-amber')
    m.box(0.08, 0.22, 0.0, 0.14, -0.05, 0.01, 'dark')
    return m


def tattoo():
    """A tattoo studio's shelf: ink bottles with their coloured caps in a row, a jar of needles, a binder of flash with
    a design on its spine."""
    m = Model('rd-gl-tattoo')
    caps = ('neon-pink', 'neon-cyan', 'neon-amber', 'neon-green', 'neon-violet', 'neon-red')
    for i in range(6):
        x = -0.22 + 0.045 * i
        z = 0.03 * (i % 2)
        m.lathe(x, z, [(0.016, 0.0), (0.016, 0.07), (0.008, 0.085)], 'dark', seg=8)
        m.cyl(x, z, 0.009, 0.085, 0.1, caps[i], seg=8)
    m.lathe(0.09, 0.0, [(0.03, 0.0), (0.03, 0.12), (0.0, 0.12)], 'glass-blue', seg=10)
    for j in range(3):
        a = 0.3 * (j - 1)
        m.tube((0.09, 0.05, 0.0), (0.09 + 0.08 * math.sin(a), 0.17, 0.02 * j - 0.02), 0.003, 'metal', seg=4)
    m.box(0.15, 0.2, 0.0, 0.3, -0.12, 0.12, 'fabric-magenta')
    label(m, 0.16, 0.19, 0.08, 0.22, 0.121, 'neon-cyan')
    m.box(0.205, 0.245, 0.0, 0.27, -0.12, 0.12, 'dark')
    return m


def tattoo_lod():
    m = Model('rd-gl-tattoo-lod')
    m.box(-0.24, 0.02, 0.0, 0.1, -0.02, 0.05, 'dark')
    m.box(0.06, 0.12, 0.0, 0.12, -0.03, 0.03, 'glass-blue')
    m.box(0.15, 0.245, 0.0, 0.3, -0.12, 0.12, 'fabric-magenta')
    return m


def vr():
    """A VR parlour's shelf: headset boxes with the worlds on their fronts, one headset out on its stand, its strap
    hanging, a pair of hand controllers."""
    m = Model('rd-gl-vr')
    for i, (x0, x1) in enumerate(((-0.245, -0.12), (-0.11, 0.0))):
        h = 0.2 - 0.03 * i
        m.box(x0, x1, 0.0, h, -0.1, 0.1, 'dark')
        label(m, x0 + 0.01, x1 - 0.01, 0.03, h - 0.03, 0.101, 'neon-violet' if i == 0 else 'shop-pink')
    m.box(0.07, 0.1, 0.0, 0.12, -0.02, 0.02, 'metal')
    m.box(0.03, 0.17, 0.12, 0.19, -0.03, 0.06, 'trim-light')
    label(m, 0.04, 0.16, 0.13, 0.18, 0.061, 'glass-dark')
    m.tube((0.03, 0.155, 0.0), (0.0, 0.06, -0.04), 0.008, 'dark', seg=5)
    m.tube((0.17, 0.155, 0.0), (0.2, 0.06, -0.04), 0.008, 'dark', seg=5)
    for x in (0.2, 0.235):
        m.tube((x, 0.0, 0.03), (x, 0.09, 0.05), 0.012, 'dark', seg=6)
        m.lathe(x, 0.05, [(0.02, 0.0), (0.022, 0.01), (0.0, 0.02)], 'neon-blue', seg=8, y0=0.09)
    return m


def vr_lod():
    m = Model('rd-gl-vr-lod')
    m.box(-0.245, 0.0, 0.0, 0.2, -0.1, 0.1, 'dark')
    m.box(0.03, 0.17, 0.0, 0.19, -0.03, 0.06, 'trim-light')
    m.box(0.19, 0.245, 0.0, 0.1, 0.01, 0.07, 'dark')
    return m


def florist():
    """A plastic-flower shop's shelf: small pots, each with its flowers of moulded plastic in colours no plant has, their
    leaves; a watering can for show."""
    m = Model('rd-gl-florist')
    blooms = ('neon-pink', 'neon-violet', 'neon-amber')
    for i, x in enumerate((-0.19, -0.06, 0.07)):
        m.lathe(x, 0.0, [(0.035, 0.0), (0.05, 0.09), (0.054, 0.1), (0.0, 0.1)], 'brick' if i != 1 else 'trim', seg=10)
        for j in range(3):
            a = 2.1 * j + i
            tip = (x + 0.035 * math.cos(a), 0.2 + 0.04 * hashf(i, j), 0.035 * math.sin(a))
            m.tube((x, 0.09, 0.0), tip, 0.003, 'plant', seg=4)
            m.lathe(tip[0], tip[2], [(0.0, 0.0), (0.022, 0.012), (0.0, 0.024)], blooms[(i + j) % 3], seg=6, y0=tip[1] - 0.012)
        m.obox((x + 0.03, 0.13, 0.02), (0.8, 0.6, 0), (0, 0, 1), (0.03, 0.003, 0.012), 'plant')
    m.lathe(0.19, 0.0, [(0.04, 0.0), (0.042, 0.11), (0.0, 0.11)], 'fabric-teal', seg=10)
    m.tube((0.215, 0.08, 0.0), (0.245, 0.14, 0.0), 0.008, 'fabric-teal', seg=5)
    return m


def florist_lod():
    m = Model('rd-gl-florist-lod')
    m.box(-0.24, 0.125, 0.0, 0.1, -0.05, 0.05, 'brick')
    m.box(-0.23, 0.115, 0.15, 0.23, -0.04, 0.04, 'neon-pink')
    m.box(0.15, 0.23, 0.0, 0.11, -0.04, 0.04, 'fabric-teal')
    return m


def stock():
    """A back room's stock: brown cartons of the trade's goods, their tape across, a shrink-wrapped pack."""
    m = Model('rd-gl-stock')
    carton_row(m, ((-0.245, -0.08), (-0.07, 0.1)), 'fabric-amber', 'trim-light', 7.0)
    m.box(0.11, 0.245, 0.0, 0.16, -0.11, 0.11, 'glass-dark')
    for y in (0.05, 0.11):
        m.box(0.108, 0.247, y, y + 0.004, -0.112, 0.112, 'win-white')
    return m


def stock_lod():
    m = Model('rd-gl-stock-lod')
    m.box(-0.245, -0.08, 0.0, 0.28, -0.12, 0.12, 'fabric-amber')
    m.box(-0.07, 0.1, 0.0, 0.24, -0.12, 0.12, 'fabric-amber')
    m.box(0.11, 0.245, 0.0, 0.16, -0.11, 0.11, 'glass-dark')
    return m


TRADES = [pharmacy, electronics, food, pawn, repair, implants, arms, tattoo, vr, florist, stock]
LODS = [pharmacy_lod, electronics_lod, food_lod, pawn_lod, repair_lod, implants_lod, arms_lod, tattoo_lod, vr_lod, florist_lod,
        stock_lod]


def _mirror(make):
    return lambda: (lambda m: m.mirrored(m.key + '-b'))(make())


# Each trade's goods, its mirror (`-b`, the goods in the other order: no run of a shelf the same as the next) and the phone's.
MODELS = TRADES + [_mirror(t) for t in TRADES] + LODS
