"""The assembly hall of W-3 (`docs/pomieszczenia/w3-hall.md`, ADR-0098): what its card asks for that the engine's own
dressing of the hall (`packages/engine/src/renderer/tessen-w3/`: the line's arms and screens, the drones, the words)
has not got.

Sizes from the simulation (`packages/sim/src/content/tessen-w3/layout.ts`, `hall-inside.ts`): the pallets of parts
2.4 x 1.4 x 1.2 m, the doors 2.6 m high, the walk on crane track N at +12. Each model's foot is on y = 0 where it stands
(the floor, the walk, a wall's spot), its front to +z.
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-w3-props.glb'


def _pallet_base(m, w, d):
    """A wooden pallet (w along x, d along z): three runners under deck boards."""
    for z in (-d / 2 + 0.05, 0.0, d / 2 - 0.05):
        m.box(-w / 2, w / 2, 0.0, 0.1, z - 0.05, z + 0.05, 'fabric-amber')
    # The deck boards, five across (the phones carry every pallet: it draws a solid).
    for k in range(5):
        x = -w / 2 + k * (w - 0.14) / 4
        m.box(x, x + 0.14, 0.1, 0.13, -d / 2, d / 2, 'fabric-amber')


def pallet(variant, key):
    """A pallet of the line's parts (2.4 x 1.4 x 1.2, the solid's box): on a wooden pallet, crates of rotor arms in two
    layers with their stencilled bands, or two layers of sacks of resin granulate and a coil of cable; wrapped in film up
    to its top layer. Light (the phones draw it: it stands for a solid the hall's mesh leaves out)."""
    m = Model(key)
    w, d, h = 2.4, 1.2, 1.4
    _pallet_base(m, w, d)
    if variant == 0:
        for layer in range(2):
            y0 = 0.13 + layer * 0.62
            for i in range(3):
                for j in range(2):
                    x0 = -w / 2 + 0.02 + i * 0.79
                    z0 = -d / 2 + 0.02 + j * 0.58
                    top = y0 + 0.6 - (0.0 if layer == 0 or hashf(i, j) > 0.3 else 0.6)
                    if top <= y0:
                        continue
                    m.box(x0, x0 + 0.76, y0, top, z0, z0 + 0.56, 'trim')
                    m.box(x0 + 0.02, x0 + 0.74, y0 + 0.2, y0 + 0.26, z0 + 0.56, z0 + 0.565, 'neon-amber')
        # The film round the bottom layer.
        m.box(-w / 2 - 0.005, w / 2 + 0.005, 0.15, 0.7, -d / 2 - 0.005, d / 2 + 0.005, 'glass-blue')
    else:
        for layer in range(2):
            y0 = 0.13 + layer * 0.24
            for i in range(4):
                for j in range(2):
                    x0 = -w / 2 + 0.03 + i * 0.59 + (0.05 if layer % 2 else 0.0)
                    z0 = -d / 2 + 0.03 + j * 0.57
                    if x0 + 0.55 > w / 2:
                        continue
                    m.box(x0, x0 + 0.55, y0, y0 + 0.22, z0, z0 + 0.54, 'trim-light')
                    if j == 1:
                        m.box(x0 + 0.1, x0 + 0.45, y0 + 0.08, y0 + 0.14, z0 + 0.54, z0 + 0.545, 'neon-red')
        # A coil of cable on top.
        m.lathe(0.4, 0.0, [(0.3, 0.0), (0.32, 0.03), (0.32, 0.17), (0.3, 0.2), (0.15, 0.2), (0.13, 0.17), (0.13, 0.03), (0.15, 0.0)],
                'cable', seg=12, y0=0.61)
    return m


def jack():
    """A hand pallet truck parked by the wall (along x, 1.6 m): the forks with their wheels, the pump's body, the
    handle up with its grip (1.6 x 1.25 x 0.55)."""
    m = Model('rd-w3h-jack')
    for z in (-0.18, 0.18):
        m.box(-0.75, 0.45, 0.03, 0.09, z - 0.08, z + 0.08, 'neon-amber', bevel=0.01)
        m.tube((-0.7, 0.04, z - 0.06), (-0.7, 0.04, z + 0.06), 0.035, 'dark', seg=8)
    m.box(0.4, 0.62, 0.03, 0.3, -0.27, 0.27, 'neon-amber', bevel=0.02)
    m.cyl(0.52, 0.0, 0.05, 0.3, 0.55, 'metal', seg=10)
    m.tube((0.52, 0.06, -0.12), (0.52, 0.06, 0.12), 0.07, 'dark', seg=12)
    m.tube((0.52, 0.55, 0.0), (0.62, 1.2, 0.0), 0.02, 'dark', seg=8)
    m.tube((0.62, 1.2, -0.17), (0.62, 1.2, 0.17), 0.022, 'dark', seg=8)
    m.tube((0.55, 0.75, -0.17), (0.62, 1.2, -0.17), 0.02, 'dark', seg=8)
    m.tube((0.55, 0.75, 0.17), (0.62, 1.2, 0.17), 0.02, 'dark', seg=8)
    return m


def barrels():
    """Four blue chemical drums on a yellow spill pallet, a hand pump in one, a hazard label on each (1.3 x 1.12)."""
    m = Model('rd-w3h-barrels')
    m.box(-0.65, 0.65, 0.0, 0.18, -0.65, 0.65, 'neon-amber', bevel=0.02)
    for k in range(7):
        x = -0.6 + k * 0.2
        m.box(x, x + 0.03, 0.18, 0.19, -0.6, 0.6, 'dark')
    for i, (x, z) in enumerate(((-0.31, -0.31), (0.31, -0.31), (-0.31, 0.31), (0.31, 0.31))):
        m.lathe(x, z, [(0.28, 0.0), (0.29, 0.02), (0.29, 0.28), (0.3, 0.3), (0.29, 0.32), (0.29, 0.58), (0.3, 0.6), (0.29, 0.62),
                       (0.29, 0.86), (0.28, 0.88), (0.0, 0.88)], 'glass-blue', seg=16, y0=0.19)
        m.box(x - 0.1, x + 0.1, 0.55, 0.72, z + 0.285, z + 0.295, 'neon-amber')
        m.cyl(x + 0.15, z - 0.1, 0.03, 1.07, 1.09, 'dark', seg=8)
        if i == 1:
            m.tube((x + 0.12, 1.07, z), (x + 0.12, 1.55, z), 0.02, 'metal', seg=8)
            m.tube((x + 0.12, 1.5, z), (x + 0.3, 1.45, z), 0.012, 'metal', seg=6)
    return m


def leak():
    """The leak by the north wall: a drain pipe down the wall, its joint wrapped in grey tape that drips, a red bucket
    under it half full, a puddle round it, a folded yellow wet-floor sign (0.9 x 6 x 0.6)."""
    m = Model('rd-w3h-leak')
    m.tube((0.0, 0.0, 0.1), (0.0, 6.0, 0.1), 0.06, 'pipe', seg=12)
    for y in (1.2, 3.0, 4.8):
        m.box(-0.08, 0.08, y - 0.03, y + 0.03, 0.0, 0.17, 'dark')
    m.tube((0.0, 2.15, 0.1), (0.0, 2.45, 0.1), 0.075, 'trim-light', seg=12)
    m.tube((0.0, 2.2, 0.1), (0.0, 2.26, 0.1), 0.08, 'trim-light', seg=12)
    m.lathe(0.0, 0.32, [(0.11, 0.0), (0.14, 0.3), (0.145, 0.31), (0.135, 0.31), (0.105, 0.02), (0.0, 0.02)], 'neon-red', seg=14)
    m.lathe(0.0, 0.32, [(0.125, 0.0), (0.0, 0.0)], 'glass-dark', seg=14, y0=0.18)
    m.tube((-0.13, 0.3, 0.32), (0.0, 0.42, 0.32), 0.004, 'metal', seg=4)
    m.tube((0.0, 0.42, 0.32), (0.13, 0.3, 0.32), 0.004, 'metal', seg=4)
    m.lathe(0.15, 0.35, [(0.42, 0.0), (0.0, 0.004)], 'glass-dark', seg=14)
    m.box(0.35, 0.65, 0.0, 0.62, 0.42, 0.45, 'neon-amber')
    m.box(0.35, 0.65, 0.0, 0.62, 0.5, 0.53, 'neon-amber')
    m.box(0.35, 0.65, 0.6, 0.63, 0.42, 0.53, 'neon-amber')
    m.box(0.42, 0.58, 0.3, 0.45, 0.535, 0.54, 'dark')
    return m


def trays():
    """A cable tray along the south wall (along x, 36 m): a ladder tray on brackets every 2 m, three bundles of cable in it,
    one cable sagging out to a junction box (0.4 x 0.3)."""
    m = Model('rd-w3h-trays')
    n = 36.0
    for z in (0.08, 0.38):
        m.box(-n / 2, n / 2, 0.0, 0.08, z - 0.01, z + 0.01, 'metal')
    x = -n / 2 + 0.15
    while x < n / 2:
        m.box(x - 0.015, x + 0.015, 0.0, 0.01, 0.07, 0.39, 'metal')
        x += 0.6
    x = -n / 2 + 0.5
    while x < n / 2:
        m.box(x - 0.025, x + 0.025, -0.05, 0.0, 0.0, 0.4, 'dark')
        m.box(x - 0.025, x + 0.025, -0.3, 0.0, 0.0, 0.04, 'dark')
        x += 2.0
    for z, r, role in ((0.15, 0.035, 'cable'), (0.24, 0.03, 'dark'), (0.32, 0.025, 'neon-amber')):
        m.tube((-n / 2, 0.01 + r, z), (n / 2, 0.01 + r, z), r, role, seg=6)
    m.tube((6.0, 0.05, 0.38), (6.4, -0.5, 0.42), 0.015, 'cable', seg=6)
    m.tube((6.4, -0.5, 0.42), (6.8, -0.7, 0.05), 0.015, 'cable', seg=6)
    m.box(6.65, 6.95, -0.95, -0.7, 0.0, 0.12, 'trim', bevel=0.01)
    return m


def break_kit():
    """The night shift's leftovers on the walk's grating: a steel thermos and its cup, a sandwich in foil, a white hard hat
    upside down with work gloves in it (0.8 x 0.35)."""
    m = Model('rd-w3h-break')
    m.cyl(-0.25, 0.0, 0.045, 0.0, 0.28, 'metal', seg=14)
    m.lathe(-0.25, 0.0, [(0.045, 0.0), (0.03, 0.03), (0.0, 0.035)], 'dark', seg=14, y0=0.28)
    m.lathe(-0.12, 0.08, [(0.035, 0.0), (0.045, 0.07), (0.0, 0.07)], 'dark', seg=12)
    m.box(-0.05, 0.12, 0.0, 0.045, -0.06, 0.04, 'metal', bevel=0.015)
    m.lathe(0.3, 0.0, [(0.0, 0.0), (0.09, 0.01), (0.14, 0.05), (0.15, 0.13), (0.16, 0.14), (0.0, 0.14)], 'win-white', seg=16)
    m.box(0.22, 0.36, 0.1, 0.16, -0.06, 0.06, 'neon-amber', bevel=0.02)
    m.box(0.28, 0.44, 0.11, 0.15, 0.0, 0.09, 'neon-amber', bevel=0.015)
    return m


def exit_sign():
    """An emergency exit sign over a door: a lit green box with a white running figure and an arrow, its two hangers
    (0.4 x 0.35)."""
    m = Model('rd-w3h-exit')
    m.box(-0.2, 0.2, 0.0, 0.2, 0.0, 0.08, 'neon-green', bevel=0.01)
    m.box(-0.14, -0.1, 0.12, 0.16, 0.08, 0.085, 'win-white')
    m.tube((-0.12, 0.12, 0.084), (-0.08, 0.06, 0.084), 0.012, 'win-white', seg=4)
    m.tube((-0.08, 0.06, 0.084), (-0.14, 0.02, 0.084), 0.012, 'win-white', seg=4)
    m.tube((-0.08, 0.06, 0.084), (-0.03, 0.03, 0.084), 0.012, 'win-white', seg=4)
    m.box(0.0, 0.12, 0.09, 0.11, 0.08, 0.085, 'win-white')
    m.tube((0.12, 0.1, 0.084), (0.08, 0.14, 0.084), 0.01, 'win-white', seg=4)
    m.tube((0.12, 0.1, 0.084), (0.08, 0.06, 0.084), 0.01, 'win-white', seg=4)
    for x in (-0.15, 0.15):
        m.box(x - 0.01, x + 0.01, 0.2, 0.35, 0.03, 0.05, 'metal')
    return m


def warning():
    """A warning plate on the wall: a yellow triangle with a black border and mark over a white plate with lines of text,
    its four screws (0.42 x 0.6)."""
    m = Model('rd-w3h-warning')
    m.box(-0.21, 0.21, 0.0, 0.6, 0.0, 0.006, 'win-white')
    c, b, s = 0.38, 0.03, 0.32
    pts = [(-s / 2, c - s * 0.43), (s / 2, c - s * 0.43), (0.0, c + s * 0.43)]
    for k in range(3):
        (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % 3]
        m.tube((x0, y0, 0.009), (x1, y1, 0.009), b / 2, 'dark', seg=4)
    # The triangle's yellow field: strips narrowing to its apex.
    rows = 10
    for k in range(rows):
        y0 = c - s * 0.43 + k * (s * 0.86 / rows)
        half = s / 2 * (1 - (k + 0.5) / rows)
        m.box(-half, half, y0, y0 + s * 0.86 / rows, 0.006, 0.008, 'neon-amber')
    m.box(-0.012, 0.012, c - 0.06, c + 0.06, 0.008, 0.011, 'dark')
    m.box(-0.012, 0.012, c - 0.1, c - 0.075, 0.008, 0.011, 'dark')
    for k in range(4):
        y = 0.16 - k * 0.035
        m.box(-0.17, 0.17 - 0.08 * hashf(k, 9.0), y, y + 0.015, 0.006, 0.008, 'dark')
    for x, y in ((-0.18, 0.03), (0.18, 0.03), (-0.18, 0.57), (0.18, 0.57)):
        m.box(x - 0.008, x + 0.008, y - 0.008, y + 0.008, 0.006, 0.01, 'metal')
    return m


def station():
    """What the welder left on a station's top by the belt (§14's clutter cluster): the welding mask face down with its
    visor up, the leather gloves, a parts tray of screws, a can of energy drink, the checklist tablet in its rugged case
    with its screen lit (0.6 x 0.3 x 0.18; foot on the station's top, along x, front to +z the aisle)."""
    m = Model('rd-w3h-station')
    m.lathe(-0.2, 0.0, [(0.0, 0.0), (0.09, 0.005), (0.12, 0.05), (0.115, 0.11), (0.0, 0.12)], 'dark', seg=14)
    m.box(-0.25, -0.15, 0.1, 0.16, 0.06, 0.07, 'glass-dark')
    for x, z in ((-0.06, 0.06), (0.0, 0.09)):
        m.box(x - 0.045, x + 0.045, 0.0, 0.025, z - 0.07, z + 0.07, 'fabric-amber', bevel=0.012)
    m.box(0.05, 0.19, 0.0, 0.03, -0.11, -0.03, 'metal', bevel=0.004)
    for k in range(6):
        x, z = 0.07 + (k % 3) * 0.04, -0.09 + (k // 3) * 0.04
        m.cyl(x, z, 0.006, 0.03, 0.04, 'trim', seg=6)
    m.lathe(0.23, 0.07, [(0.032, 0.0), (0.033, 0.11), (0.026, 0.125), (0.0, 0.125)], 'neon-green', seg=12)
    m.box(-0.05, 0.13, 0.0, 0.018, -0.02, 0.1, 'dark', bevel=0.006)
    m.box(-0.04, 0.12, 0.018, 0.02, -0.01, 0.09, 'neon-cyan')
    return m


MODELS = [lambda: pallet(0, 'rd-w3h-pallet-crates'), lambda: pallet(1, 'rd-w3h-pallet-sacks'), jack, barrels, leak, trays, break_kit,
          exit_sign, warning, station]
