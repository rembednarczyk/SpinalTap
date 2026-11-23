"""The yard behind Neon Koi (`docs/lokacje/koi-podworko.md`, ADR-0102 point 5): what its card asks for at the bar's back
door, by its bins and on its walls, after the scenario (the cook's smoke by the door, the Hebi who meet here, the bar's
deliveries).

Real sizes (comic realism, `docs/zasady-lokacji.md` §9): a beer crate 0.40 x 0.30 x 0.29 m for twenty bottles, a 50 l
keg 0.6 m high, a bottle bank's bell 1.5 m across, a 50 cc delivery scooter 1.8 m long with 12" wheels, a bulkhead lamp
0.3 m across. A wall's things have their back on z = 0 and their front to +z, centred on x; the rest stand with their
foot on y = 0, their front to +z. The lamps' glass is the neon the simulation hangs in them (`koi-back.ts`), lit by it.
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-sceny-props.glb'


def door_canopy():
    """Over the back door (foot at its sill): a canopy of corrugated sheet on two steel struts at 2.75 m, a bulkhead lamp
    under it (an oval cast body, the lens left for the neon, a cage of three bars) and its conduit to a junction box
    (1.5 x 3.0 x 0.85)."""
    m = Model('rd-kb-canopy')
    w, d, y = 1.5, 0.8, 2.75
    for k in range(10):
        x0 = -w / 2 + k * w / 10
        lift = 0.015 if k % 2 else 0.0
        m.obox((x0 + w / 20, y + d * 0.12 + lift, d / 2), (1, 0, 0), (0, 0.99, -0.14), (w / 20, 0.006, d / 2), 'metal')
    m.box(-w / 2, w / 2, y + 0.09, y + 0.14, 0.0, 0.05, 'trim')
    for s in (-1, 1):
        m.tube((s * (w / 2 - 0.1), y - 0.45, 0.0), (s * (w / 2 - 0.1), y + 0.02, d - 0.05), 0.016, 'dark', seg=6)
        m.box(s * (w / 2 - 0.1) - 0.04, s * (w / 2 - 0.1) + 0.04, y - 0.5, y - 0.4, 0.0, 0.015, 'dark')
    # The bulkhead under the canopy: its body round the neon's lens (0.16 x 0.1 at y 2.55, z 0.075), the cage over it.
    ly = 2.55
    m.box(-0.15, 0.15, ly - 0.1, ly + 0.1, 0.0, 0.06, 'trim', bevel=0.02)
    m.box(-0.1, 0.1, ly - 0.07, ly + 0.07, 0.06, 0.07, 'win-warm')
    for k in (-1, 0, 1):
        m.tube((-0.12, ly + k * 0.05, 0.09), (0.12, ly + k * 0.05, 0.09), 0.006, 'dark', seg=5)
    for s in (-1, 1):
        m.tube((s * 0.12, ly - 0.06, 0.06), (s * 0.12, ly + 0.06, 0.09), 0.006, 'dark', seg=5)
    m.tube((0.15, ly, 0.03), (0.45, ly, 0.03), 0.012, 'pipe', seg=6)
    m.box(0.45, 0.6, ly - 0.08, ly + 0.08, 0.0, 0.07, 'trim', bevel=0.008)
    m.tube((0.52, ly + 0.08, 0.035), (0.52, y + 0.05, 0.035), 0.012, 'pipe', seg=6)
    return m


def lantern():
    """A wall lantern on a bracket by the way in from the deptak, at 3 m: a scrolled arm, the lantern's cap and finial,
    four glass panes in a frame (the front one the neon's), its bottom and a drip of rust under the arm (0.3 x 3.5 x
    0.55)."""
    m = Model('rd-kb-lantern')
    y = 3.0
    m.box(-0.07, 0.07, y + 0.2, y + 0.45, 0.0, 0.02, 'dark', bevel=0.008)
    m.tube((0.0, y + 0.42, 0.02), (0.0, y + 0.42, 0.42), 0.015, 'dark', seg=6)
    m.tube((0.0, y + 0.24, 0.02), (0.0, y + 0.4, 0.3), 0.012, 'dark', seg=6)
    m.tube((0.0, y + 0.42, 0.4), (0.0, y + 0.33, 0.4), 0.01, 'dark', seg=6)
    cz = 0.4
    m.lathe(0.0, cz, [(0.13, 0.0), (0.11, 0.03), (0.03, 0.13), (0.0, 0.14)], 'dark', seg=4, y0=y + 0.12)
    m.lathe(0.0, cz, [(0.015, 0.0), (0.0, 0.06)], 'dark', seg=6, y0=y + 0.26)
    m.box(-0.09, 0.09, y - 0.22, y + 0.12, cz - 0.09, cz + 0.09, 'win-warm')
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box(sx * 0.1 - 0.012, sx * 0.1 + 0.012, y - 0.24, y + 0.13, cz + sz * 0.1 - 0.012, cz + sz * 0.1 + 0.012, 'dark')
    m.lathe(0.0, cz, [(0.11, 0.0), (0.06, -0.06), (0.0, -0.08)], 'dark', seg=4, y0=y - 0.24)
    m.quad([(-0.02, 0.6, 0.002), (0.02, 0.6, 0.002), (0.03, y + 0.2, 0.002), (-0.03, y + 0.2, 0.002)], 'rust')
    return m


def batten():
    """A fluorescent batten over the annex's door at 2.6 m: a steel back, its opal diffuser (the neon's), end caps, a
    conduit from its side up the wall, a sticker of a cleaning firm on it (1.3 x 2.1 x 0.12)."""
    m = Model('rd-kb-batten')
    y = 2.6
    m.box(-0.65, 0.65, y - 0.06, y + 0.06, 0.0, 0.05, 'trim', bevel=0.01)
    m.box(-0.6, 0.6, y - 0.045, y + 0.045, 0.05, 0.08, 'win-white')
    for s in (-1, 1):
        m.box(s * 0.62 - 0.03, s * 0.62 + 0.03, y - 0.055, y + 0.055, 0.04, 0.09, 'trim-light', bevel=0.008)
    m.tube((0.65, y, 0.025), (0.8, y, 0.025), 0.01, 'pipe', seg=6)
    m.tube((0.8, y, 0.025), (0.8, y + 1.5, 0.025), 0.01, 'pipe', seg=6)
    m.box(-0.4, -0.3, y - 0.04, y + 0.02, 0.051, 0.053, 'neon-amber')
    return m


def extract():
    """The kitchen's extract on the bar's back wall: a square duct out of the wall at 2.6 m, a wall fan's box with a round
    grille and its blades behind it, a hood against the rain, the duct's riser up the wall with its bands, a grease streak
    down the wall under it and the fan's cable (0.7 x 4.6 x 0.55)."""
    m = Model('rd-kb-extract')
    y = 2.6
    m.box(-0.2, 0.2, y - 0.2, y + 0.2, 0.0, 0.2, 'metal', bevel=0.01)
    m.box(-0.32, 0.32, y - 0.32, y + 0.32, 0.2, 0.45, 'metal', bevel=0.015)
    m.tube((0.0, y, 0.44), (0.0, y, 0.452), 0.25, 'dark', seg=20)
    for k in range(5):
        a = 2 * math.pi * k / 5
        m.obox((0.12 * math.cos(a), y + 0.12 * math.sin(a), 0.43), (math.cos(a), math.sin(a), 0), (0, 0, 1), (0.11, 0.03, 0.004), 'trim-light')
    m.tube((0.0, y, 0.42), (0.0, y, 0.46), 0.05, 'trim', seg=10)
    for k in range(6):
        r = 0.05 + k * 0.04
        seg = 16
        for j in range(seg):
            a0, a1 = 2 * math.pi * j / seg, 2 * math.pi * (j + 1) / seg
            m.tube((r * math.cos(a0), y + r * math.sin(a0), 0.465), (r * math.cos(a1), y + r * math.sin(a1), 0.465), 0.004, 'trim-light', seg=4)
    for x in (-0.24, 0.0, 0.24):
        m.tube((x, y - 0.25, 0.465), (x, y + 0.25, 0.465), 0.004, 'trim-light', seg=4)
    m.obox((0.0, y + 0.38, 0.4), (1, 0, 0), (0, 0.8, 0.6), (0.36, 0.008, 0.16), 'metal')
    m.box(-0.18, 0.18, y + 0.32, y + 2.0, 0.0, 0.36, 'metal', bevel=0.01)
    for k in range(3):
        by = y + 0.6 + k * 0.5
        m.box(-0.19, 0.19, by, by + 0.04, 0.0, 0.37, 'trim')
    m.box(-0.22, 0.22, y + 2.0, y + 2.05, -0.02, 0.4, 'trim')
    m.quad([(-0.18, 0.4, 0.003), (0.1, 0.4, 0.003), (0.16, y - 0.2, 0.003), (-0.16, y - 0.2, 0.003)], 'dark')
    m.tube((0.32, y - 0.1, 0.3), (0.5, y - 0.4, 0.02), 0.008, 'cable', seg=5)
    return m


def downpipe():
    """The bar's downpipe from the gutter at the eaves (12 m) to the ground: the gutter's stub and outlet, the swan neck,
    the pipe in its brackets every 2 m, a shoe spilling onto the yard; two fibre cables zip-tied to it from 3 m down to a
    junction box and into the wall (the bar's net, the card's contrast) (0.5 x 12.1 x 0.4)."""
    m = Model('rd-kb-downpipe')
    top, z = 12.0, 0.12
    m.box(-0.25, 0.25, top - 0.06, top + 0.08, 0.0, 0.3, 'metal')
    m.box(-0.23, 0.23, top + 0.02, top + 0.08, 0.02, 0.28, 'dark')
    m.tube((0.0, top - 0.06, 0.2), (0.0, top - 0.3, 0.2), 0.05, 'metal', seg=10)
    m.tube((0.0, top - 0.3, 0.2), (0.0, top - 0.55, z), 0.05, 'metal', seg=10)
    m.tube((0.0, top - 0.55, z), (0.0, 0.25, z), 0.05, 'metal', seg=10)
    for k in range(6):
        by = 1.5 + 2 * k
        m.tube((0.0, by, z), (0.0, by + 0.05, z), 0.058, 'trim', seg=10)
        m.box(-0.01, 0.01, by, by + 0.05, 0.0, z - 0.05, 'trim')
    m.tube((0.0, 0.25, z), (0.0, 0.06, z + 0.16), 0.05, 'metal', seg=10)
    m.lathe(0.0, z + 0.17, [(0.055, 0.0), (0.062, 0.03)], 'metal', seg=10, y0=0.04)
    for s in (-1, 1):
        x = s * 0.075
        m.tube((x, 3.0, z), (x, 1.85, z), 0.008, 'fabric-amber', seg=5)
        m.tube((x, 1.85, z), (s * 0.03, 1.6, 0.06), 0.008, 'fabric-amber', seg=5)
    for k in range(4):
        ty = 1.9 + k * 0.3
        m.box(-0.09, 0.09, ty, ty + 0.012, z - 0.06, z + 0.06, 'dark')
    m.box(-0.12, 0.12, 1.3, 1.6, 0.0, 0.09, 'trim-light', bevel=0.008)
    m.box(-0.05, 0.05, 1.42, 1.48, 0.09, 0.092, 'neon-green')
    return m


def smoke():
    """Where the cook smokes by the back door (§5: someone left a moment ago): a beer crate upside down for a stool, a mug
    of coffee on it, a tin can for an ashtray full of butts, butts ground out round it, a crushed pack and a lighter
    (0.7 x 0.42 x 0.55)."""
    m = Model('rd-kb-smoke')
    m.box(-0.2, 0.2, 0.0, 0.29, -0.15, 0.15, 'fabric-teal', bevel=0.012)
    for s in (-1, 1):
        m.box(s * 0.2 - 0.002, s * 0.2 + 0.002, 0.05, 0.12, -0.06, 0.06, 'dark')
    m.box(-0.18, 0.18, 0.29, 0.292, -0.13, 0.13, 'dark')
    m.lathe(0.06, 0.03, [(0.04, 0.0), (0.042, 0.095), (0.0, 0.095)], 'win-white', seg=12, y0=0.292)
    m.lathe(0.06, 0.03, [(0.036, 0.0), (0.0, 0.001)], 'rust', seg=12, y0=0.38)
    m.tube((0.1, 0.33, 0.03), (0.12, 0.33, 0.03), 0.02, 'win-white', seg=6)
    m.lathe(0.3, 0.12, [(0.034, 0.0), (0.034, 0.11), (0.0, 0.11)], 'metal', seg=12)
    for k in range(6):
        a = k * 1.05
        m.tube((0.3 + 0.015 * math.cos(a), 0.1, 0.12 + 0.015 * math.sin(a)), (0.3 + 0.03 * math.cos(a), 0.135, 0.12 + 0.03 * math.sin(a)), 0.004, 'win-white' if k % 2 else 'fabric-amber', seg=5)
    for k in range(9):
        a = k * 2.3
        x, z = 0.3 + 0.18 * math.cos(a) * (0.5 + 0.06 * k), 0.12 + 0.15 * math.sin(a) * (0.5 + 0.05 * k)
        m.tube((x, 0.005, z), (x + 0.02 * math.cos(a * 1.9), 0.005, z + 0.02 * math.sin(a * 1.9)), 0.004, 'win-white' if k % 3 else 'fabric-amber', seg=5)
    m.box(-0.33, -0.25, 0.0, 0.015, 0.12, 0.18, 'neon-red', bevel=0.003)
    m.box(-0.33, -0.25, 0.015, 0.016, 0.12, 0.15, 'win-white')
    m.box(0.12, 0.14, 0.0, 0.012, 0.2, 0.26, 'neon-amber', bevel=0.003)
    return m


def crate(m, x0, y0, z0, role, bottles):
    """A plastic beer crate (0.40 x 0.29 x 0.30) with its handles' slots, full of brown bottles if `bottles`."""
    m.box(x0, x0 + 0.4, y0, y0 + 0.29, z0, z0 + 0.3, role, bevel=0.01)
    for s in (0, 1):
        x = x0 - 0.001 if s == 0 else x0 + 0.401
        m.box(x - 0.001, x + 0.001, y0 + 0.2, y0 + 0.25, z0 + 0.1, z0 + 0.2, 'dark')
    m.box(x0 + 0.1, x0 + 0.3, y0 + 0.2, y0 + 0.25, z0 + 0.299, z0 + 0.301, 'dark')
    if not bottles:
        return
    m.box(x0 + 0.02, x0 + 0.38, y0 + 0.285, y0 + 0.29, z0 + 0.02, z0 + 0.28, 'dark')
    for i in range(5):
        for j in range(4):
            if hashf(x0, y0, i, j) < 0.15:
                continue
            bx, bz = x0 + 0.05 + i * 0.075, z0 + 0.045 + j * 0.07
            m.lathe(bx, bz, [(0.024, 0.0), (0.024, 0.04), (0.011, 0.08), (0.01, 0.1)], 'rust', seg=6, y0=y0 + 0.24)


def crates():
    """The bar's empties by its back wall, waiting for the brewery's van: beer crates two deep, three wide and four high,
    the top row full of empty bottles, one crate of another brewery's colour, and a steel 50 l keg by them on its end
    (1.75 x 1.16 x 0.6)."""
    m = Model('rd-kb-crates')
    for col in range(3):
        for row in range(2):
            for level in range(4):
                odd = hashf(col, row, level) < 0.2
                role = 'neon-red' if odd else 'fabric-teal'
                x0 = -0.6 + col * 0.4 + 0.01 * math.sin(col + level * 1.7)
                crate(m, x0, level * 0.29, -0.3 + row * 0.3, role, level == 3)
    kx, kz = 0.85, 0.05
    m.lathe(kx, kz, [(0.2, 0.0), (0.205, 0.04), (0.2, 0.08), (0.2, 0.25), (0.205, 0.3), (0.2, 0.35), (0.2, 0.52), (0.205, 0.56), (0.19, 0.6), (0.0, 0.6)], 'metal', seg=16)
    m.cyl(kx, kz, 0.03, 0.6, 0.66, 'trim', seg=8)
    m.box(kx - 0.06, kx + 0.06, 0.62, 0.64, kz - 0.21, kz - 0.17, 'trim')
    return m


def scooter():
    """The bar's delivery scooter on its centre stand: 12" wheels, the front fork and mudguard, the leg shield, the
    handlebar with its headlamp and mirrors, the floorboard, the seat over the rear body, the rear rack with a delivery box
    (its lid's sticker the bar's pink), a number plate (0.72 x 1.2 x 1.8; front to +z)."""
    m = Model('rd-kb-scooter')
    r = 0.2
    for z in (0.62, -0.62):
        m.tube((-0.06, r, z), (0.06, r, z), r, 'tyre', seg=16)
        m.tube((-0.065, r, z), (0.065, r, z), 0.1, 'metal', seg=10)
    m.obox((0.0, 0.42, 0.66), (1, 0, 0), (0, 0.3, 1), (0.08, 0.02, 0.18), 'fabric-amber')
    for s in (-1, 1):
        m.tube((s * 0.07, r, 0.62), (s * 0.06, 0.7, 0.5), 0.02, 'dark', seg=6)
    m.obox((0.0, 0.62, 0.42), (1, 0, 0), (0, 0.97, -0.24), (0.21, 0.36, 0.03), 'fabric-amber', bevel=0.02)
    m.tube((0.0, 0.96, 0.38), (0.0, 1.08, 0.42), 0.03, 'dark', seg=8)
    m.tube((-0.36, 1.08, 0.4), (0.36, 1.08, 0.4), 0.014, 'dark', seg=6)
    for s in (-1, 1):
        m.tube((s * 0.36, 1.08, 0.4), (s * 0.31, 1.08, 0.4), 0.02, 'tyre', seg=6)
        m.tube((s * 0.25, 1.08, 0.4), (s * 0.3, 1.26, 0.36), 0.006, 'dark', seg=4)
        m.box(s * 0.3 - 0.05, s * 0.3 + 0.05, 1.24, 1.3, 0.35, 0.37, 'glass-blue')
    m.box(-0.12, 0.12, 1.0, 1.12, 0.42, 0.5, 'fabric-amber', bevel=0.02)
    m.box(-0.07, 0.07, 1.03, 1.09, 0.5, 0.502, 'headlight')
    m.box(-0.17, 0.17, 0.3, 0.36, -0.3, 0.38, 'dark', bevel=0.01)
    m.box(-0.2, 0.2, 0.32, 0.72, -0.85, -0.25, 'fabric-amber', bevel=0.06)
    m.box(-0.16, 0.16, 0.72, 0.82, -0.75, -0.12, 'dark', bevel=0.04)
    m.box(-0.06, 0.06, 0.48, 0.52, -0.87, -0.85, 'taillight')
    m.box(-0.1, 0.1, 0.3, 0.42, -0.9, -0.88, 'win-white')
    for s in (-1, 1):
        m.tube((s * 0.15, 0.84, -0.6), (s * 0.15, 0.84, -0.95), 0.012, 'dark', seg=6)
    m.box(-0.21, 0.21, 0.86, 1.24, -1.0, -0.58, 'fabric-magenta', bevel=0.02)
    m.box(-0.12, 0.12, 1.0, 1.12, -0.581, -0.579, 'neon-pink')
    m.box(-0.04, 0.04, 0.0, 0.22, -0.2, -0.1, 'dark')
    return m


def glass_bin():
    """The street's bottle bank by the yard's way in: a green bell 1.5 m across and 1.6 m high, two round slots with
    their black rubber collars, the lifting ring on top, the council's sticker and a bottle left on the ground by it
    (1.6 x 1.75 x 1.6)."""
    m = Model('rd-kb-glass-bin')
    m.lathe(0.0, 0.0, [(0.72, 0.0), (0.75, 0.06), (0.74, 0.9), (0.64, 1.25), (0.42, 1.48), (0.15, 1.58), (0.0, 1.6)], 'dumpster', seg=20)
    m.lathe(0.0, 0.0, [(0.76, 0.0), (0.77, 0.08), (0.0, 0.08)], 'dark', seg=20)
    for a in (0.35, -0.35):
        cx, cz = 0.66 * math.sin(a), 0.66 * math.cos(a)
        m.tube((cx * 0.97, 1.18, cz * 0.97), (cx * 1.06, 1.16, cz * 1.06), 0.11, 'dark', seg=14)
    m.tube((0.0, 1.58, 0.0), (0.0, 1.68, 0.0), 0.03, 'metal', seg=8)
    for k in range(10):
        a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
        m.tube((0.09 * math.cos(a0), 1.74, 0.09 * math.sin(a0)), (0.09 * math.cos(a1), 1.74, 0.09 * math.sin(a1)), 0.012, 'metal', seg=4)
    m.obox((0.0, 0.7, 0.745), (1, 0, 0), (0, 1, 0.03), (0.18, 0.12, 0.004), 'win-white')
    m.obox((0.0, 0.72, 0.75), (1, 0, 0), (0, 1, 0.03), (0.12, 0.04, 0.004), 'plant')
    m.tube((0.5, 0.032, 0.75), (0.7, 0.032, 0.68), 0.031, 'plant', seg=10)
    m.tube((0.7, 0.032, 0.68), (0.76, 0.032, 0.66), 0.012, 'plant', seg=6)
    return m


def camera():
    """A CCTV camera on the bar's back wall over its bins at 3.2 m: a wall plate and arm, the housing with its sun hood,
    the lens and the red diode that tells the yard it records, the cable taped down the wall (0.25 x 3.5 x 0.5)."""
    m = Model('rd-kb-camera')
    y = 3.2
    m.box(-0.07, 0.07, y - 0.08, y + 0.08, 0.0, 0.02, 'trim-light', bevel=0.006)
    m.tube((0.0, y, 0.02), (0.0, y - 0.04, 0.18), 0.018, 'trim-light', seg=8)
    m.obox((0.0, y - 0.08, 0.3), (1, 0, 0), (0, 0.96, 0.28), (0.06, 0.055, 0.14), 'win-white', bevel=0.01)
    m.obox((0.0, y - 0.01, 0.32), (1, 0, 0), (0, 0.96, 0.28), (0.075, 0.006, 0.18), 'trim-light')
    m.tube((0.0, y - 0.115, 0.43), (0.0, y - 0.125, 0.445), 0.035, 'glass-dark', seg=10)
    m.box(0.035, 0.05, y - 0.06, y - 0.045, 0.43, 0.445, 'neon-red')
    m.tube((0.0, y - 0.08, 0.01), (0.0, 1.0, 0.01), 0.006, 'cable', seg=5)
    for k in range(4):
        ty = 1.4 + k * 0.5
        m.box(-0.025, 0.025, ty, ty + 0.05, 0.0, 0.016, 'trim-light')
    return m


def tag():
    """The Hebi's mark on the wall where they meet (the card's history): a snake in an S over a ring sprayed teal, its
    tongue in magenta, the paint's drips, two stickers of the gang beside it and a club's poster half torn off (2.2 x 2.1
    x 0.01; its back on the wall)."""
    m = Model('rd-kb-tag')
    pts = []
    for k in range(25):
        t = k / 24
        pts.append((-0.8 + 1.6 * t, 1.25 + 0.38 * math.sin(t * 2 * math.pi * 1.2), 0.004))
    for k in range(len(pts) - 1):
        (x0, y0, z), (x1, y1, _) = pts[k], pts[k + 1]
        w = 0.07 * (1 - 0.6 * k / 24) + 0.02
        m.quad([(x0, y0 - w, z), (x1, y1 - w, z), (x1, y1 + w, z), (x0, y0 + w, z)], 'fabric-teal')
    hx, hy = pts[-1][0], pts[-1][1]
    m.quad([(hx - 0.02, hy - 0.11, 0.005), (hx + 0.16, hy - 0.05, 0.005), (hx + 0.16, hy + 0.07, 0.005), (hx - 0.02, hy + 0.12, 0.005)], 'fabric-teal')
    m.quad([(hx + 0.16, hy - 0.01, 0.006), (hx + 0.32, hy - 0.06, 0.006), (hx + 0.32, hy + 0.02, 0.006), (hx + 0.16, hy + 0.03, 0.006)], 'fabric-magenta')
    for k in range(20):
        a0, a1 = 2 * math.pi * k / 20, 2 * math.pi * (k + 1) / 20
        r0, r1 = 0.62, 0.68
        c0, s0, c1, s1 = math.cos(a0), math.sin(a0), math.cos(a1), math.sin(a1)
        m.quad([(r0 * c0, 1.25 + r0 * s0, 0.003), (r0 * c1, 1.25 + r0 * s1, 0.003), (r1 * c1, 1.25 + r1 * s1, 0.003), (r1 * c0, 1.25 + r1 * s0, 0.003)], 'fabric-magenta')
    for k in range(6):
        x = -0.55 + k * 0.21 + 0.05 * math.sin(k * 2.7)
        top = 1.25 - 0.6 * abs(math.cos(k * 1.3)) - 0.05
        m.quad([(x - 0.012, top - 0.25 - 0.15 * hashf(k), 0.0035), (x + 0.012, top - 0.25 - 0.15 * hashf(k), 0.0035), (x + 0.012, top, 0.0035), (x - 0.012, top, 0.0035)], 'fabric-teal')
    for k, (x, y) in enumerate(((0.95, 1.5), (1.05, 1.1))):
        m.quad([(x - 0.06, y - 0.06, 0.006), (x + 0.06, y - 0.06, 0.006), (x + 0.06, y + 0.06, 0.006), (x - 0.06, y + 0.06, 0.006)], 'win-white')
        m.quad([(x - 0.04, y - 0.03, 0.007), (x + 0.04, y - 0.03, 0.007), (x + 0.04, y + 0.03, 0.007), (x - 0.04, y + 0.03, 0.007)], 'fabric-teal')
    m.quad([(-1.1, 0.6, 0.002), (-0.75, 0.62, 0.002), (-0.7, 1.05, 0.002), (-1.1, 1.1, 0.002)], 'fabric-amber')
    m.quad([(-1.08, 0.75, 0.0025), (-0.8, 0.76, 0.0025), (-0.79, 0.9, 0.0025), (-1.08, 0.92, 0.0025)], 'dark')
    return m


MODELS = [door_canopy, lantern, batten, extract, downpipe, smoke, crates, scooter, glass_bin, camera, tag]
