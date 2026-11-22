"""P-1, Alchemia's car park (`docs/pomieszczenia/alchemia-parking.md`, ADR-0098): what its card asks for besides the
shell, the ramp, the cabins, the bays' lines, the charger posts, the columns, the pay machine and the console Alchemia's
engine draws, and the cars of the scenery (`packages/sim/src/content/alchemia/parking.ts`).

Sizes from the simulation: P-1 2.7 m high, the columns 0.4 m square, the chargers' posts 0.3 x 0.5 x 1.4, the console
1.2 m high. Each model's foot is on y = 0 where it stands (the floor, a post's face, the console's top, the ceiling for
what hangs), its front to +z.
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-alchemia-props.glb'


def column():
    """A column's dress (round a 0.4 m square column, centred): yellow and black hazard bands at bumper height, rubber
    corner guards, the bay's level and number on a white plate on each face, a fire extinguisher sign (0.44 x 2.2)."""
    m = Model('rd-p1-column')
    h = 0.21
    for k in range(6):
        y0 = 0.15 + k * 0.15
        role = 'neon-amber' if k % 2 == 0 else 'dark'
        for (x0, x1, z0, z1) in ((-h, h, h - 0.002, h + 0.008), (-h, h, -h - 0.008, -h + 0.002), (h - 0.002, h + 0.008, -h, h), (-h - 0.008, -h + 0.002, -h, h)):
            m.box(x0, x1, y0, y0 + 0.15, z0, z1, role)
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box(sx * h - 0.035, sx * h + 0.035, 0.0, 1.05, sz * h - 0.035, sz * h + 0.035, 'tyre', bevel=0.01)
    for s in (-1, 1):
        face = s * (h + 0.008)
        z0, z1 = sorted((face, face + s * 0.004))
        m.box(-0.14, 0.14, 1.7, 2.0, z0, z1, 'win-white')
        z0, z1 = sorted((face + s * 0.004, face + s * 0.006))
        m.box(-0.1, 0.1, 1.76, 1.94, z0, z1, 'neon-blue')
    m.box(h + 0.008, h + 0.012, 1.7, 1.95, -0.1, 0.1, 'neon-red')
    return m


def charger():
    """A charger post's dress on its face (the post 0.3 x 0.5 x 1.4 behind z 0): a screen with the charge in green, a
    ring of light round the holster, the plug in it and its thick cable coiled on a hook, a QR sticker (0.5 x 1.4 x 0.2)."""
    m = Model('rd-p1-charger')
    m.box(-0.16, 0.16, 0.95, 1.25, 0.0, 0.015, 'dark')
    m.box(-0.13, 0.13, 0.98, 1.22, 0.015, 0.017, 'win-teal')
    m.box(-0.1, 0.06, 1.05, 1.09, 0.017, 0.019, 'neon-green')
    m.tube((0.0, 0.7, 0.0), (0.0, 0.7, 0.03), 0.07, 'neon-cyan', seg=14)
    m.tube((0.0, 0.7, 0.03), (0.0, 0.7, 0.04), 0.05, 'dark', seg=12)
    m.tube((0.0, 0.7, 0.04), (0.0, 0.62, 0.12), 0.03, 'dark', seg=8)
    m.box(0.17, 0.22, 0.8, 0.86, 0.0, 0.06, 'metal')
    pts = [(0.0, 0.62, 0.12), (0.05, 0.4, 0.14), (0.18, 0.3, 0.12)]
    for k in range(10):
        a = 2 * math.pi * k / 10
        pts.append((0.2 + 0.12 * math.cos(a) * 0.4, 0.6 + 0.2 * math.sin(a), 0.08 + 0.03 * math.cos(a)))
    for a, b in zip(pts, pts[1:]):
        m.tube(a, b, 0.016, 'dark', seg=6)
    m.box(-0.08, 0.0, 0.4, 0.48, 0.0, 0.003, 'win-white')
    return m


def ceiling():
    """Under the deck's ceiling along its aisle (along x, 21 m; foot at the ceiling): a sprinkler main with heads every 3
    m, a cable tray on hangers, fluorescent battens every 4 m, one flickering dim (0.9 x 0.4)."""
    m = Model('rd-p1-ceiling')
    n = 21.0
    m.tube((-n / 2, -0.15, -0.3), (n / 2, -0.15, -0.3), 0.04, 'neon-red', seg=10)
    m.box(-n / 2, n / 2, -0.22, -0.2, 0.15, 0.45, 'metal')
    for z in (0.15, 0.45):
        m.box(-n / 2, n / 2, -0.22, -0.16, z - 0.01, z + 0.01, 'metal')
    m.tube((-n / 2, -0.18, 0.25), (n / 2, -0.18, 0.25), 0.025, 'cable', seg=6)
    m.tube((-n / 2, -0.18, 0.35), (n / 2, -0.18, 0.35), 0.02, 'dark', seg=6)
    x = -n / 2 + 0.5
    while x < n / 2:
        for z in (0.15, 0.45):
            m.box(x - 0.008, x + 0.008, -0.22, 0.0, z - 0.008, z + 0.008, 'metal')
        m.tube((x + 1.0, -0.15, -0.3), (x + 1.0, -0.22, -0.3), 0.01, 'metal', seg=6)
        x += 3.0
    k = 0
    x = -n / 2 + 1.5
    while x < n / 2:
        m.box(x - 0.6, x + 0.6, -0.08, 0.0, -0.12, 0.0, 'trim-light')
        m.box(x - 0.58, x + 0.58, -0.09, -0.08, -0.1, -0.02, 'win-white' if k != 3 else 'trim')
        x += 4.0
        k += 1
    return m


def barrier():
    """The barrier by the ramp's foot, up: its housing with a stripe and a lamp, the boom raised near upright with its red
    and white bands (0.4 x 3.3 x 0.35)."""
    m = Model('rd-p1-barrier')
    m.box(-0.18, 0.18, 0.0, 1.05, -0.15, 0.15, 'neon-amber', bevel=0.02)
    m.box(-0.181, 0.181, 0.75, 0.82, -0.151, 0.151, 'dark')
    m.cyl(0.0, 0.0, 0.05, 1.05, 1.13, 'neon-red', seg=10)
    m.tube((0.0, 0.95, 0.17), (0.0, 0.95, 0.2), 0.05, 'dark', seg=10)
    a = math.radians(82)
    for k in range(8):
        s0, s1 = k * 0.3, (k + 1) * 0.3
        p0 = (s0 * math.cos(a), 0.95 + s0 * math.sin(a), 0.2)
        p1 = (s1 * math.cos(a), 0.95 + s1 * math.sin(a), 0.2)
        m.tube(p0, p1, 0.035, 'neon-red' if k % 2 == 0 else 'win-white', seg=8)
    return m


def cabin_screen():
    """The in-cabin's screen and light on its wall by the shutter: a screen showing a car's outline and an arrow, a
    red and a green lamp, a sign over it (0.7 x 0.9)."""
    m = Model('rd-p1-cabin-screen')
    m.box(-0.35, 0.35, 0.0, 0.45, 0.0, 0.05, 'dark', bevel=0.01)
    m.box(-0.32, 0.32, 0.03, 0.42, 0.05, 0.052, 'win-teal')
    m.box(-0.18, 0.12, 0.15, 0.27, 0.052, 0.054, 'dark')
    m.box(0.16, 0.26, 0.19, 0.23, 0.052, 0.054, 'neon-green')
    for k, role in enumerate(('neon-red', 'dark')):
        m.tube((-0.25 + k * 0.12, 0.62, 0.0), (-0.25 + k * 0.12, 0.62, 0.06), 0.045, role, seg=10)
    m.tube((0.0, 0.62, 0.0), (0.0, 0.62, 0.06), 0.045, 'dark', seg=10)
    m.tube((0.12, 0.62, 0.0), (0.12, 0.62, 0.06), 0.045, 'neon-green', seg=10)
    m.box(-0.35, 0.35, 0.74, 0.9, 0.0, 0.02, 'neon-blue')
    return m


def guard():
    """On the console's top: the guard's mug with a tea bag's string, a pile of parking tickets, a phone face down, a
    biro (0.5 x 0.12 x 0.6)."""
    m = Model('rd-p1-guard')
    m.lathe(-0.12, -0.15, [(0.04, 0.0), (0.045, 0.1), (0.0, 0.1)], 'trim-light', seg=12)
    m.tube((-0.075, 0.03, -0.15), (-0.075, 0.08, -0.15), 0.01, 'trim-light', seg=6)
    m.tube((-0.14, 0.1, -0.15), (-0.165, 0.04, -0.15), 0.002, 'win-white', seg=4)
    m.box(-0.18, -0.15, 0.03, 0.05, -0.155, -0.153, 'neon-amber')
    for k in range(5):
        a = 0.6 * (hashf(k, 1.0) - 0.5)
        m.obox((0.08 + 0.03 * hashf(k, 2.0), 0.003 + k * 0.002, 0.05 + 0.03 * hashf(k, 3.0)), (math.cos(a), 0, math.sin(a)), (0, 1, 0), (0.04, 0.001, 0.07), 'win-white')
    m.box(0.05, 0.13, 0.0, 0.01, 0.18, 0.33, 'dark', bevel=0.004)
    m.tube((-0.15, 0.004, 0.15), (-0.02, 0.004, 0.22), 0.004, 'neon-blue', seg=4)
    return m


def floor_bits():
    """By the pay machine on the floor: a traffic cone, two parking tickets dropped, an oil stain (1.3 x 0.7 x 1.0)."""
    m = Model('rd-p1-floor')
    m.box(-0.2, 0.2, 0.0, 0.03, -0.2, 0.2, 'neon-amber', bevel=0.008)
    m.lathe(0.0, 0.0, [(0.14, 0.03), (0.02, 0.7), (0.0, 0.7)], 'neon-amber', seg=14)
    for y in (0.25, 0.45):
        m.lathe(0.0, 0.0, [(0.14 - 0.12 * (y - 0.03) / 0.67 + 0.002, 0.0), (0.14 - 0.12 * (y + 0.08 - 0.03) / 0.67 + 0.002, 0.08)], 'win-white', seg=14, y0=y)
    for k, (x, z) in enumerate(((0.45, 0.2), (0.6, -0.1))):
        a = hashf(k, 4.0) * math.pi
        m.obox((x, 0.002, z), (math.cos(a), 0, math.sin(a)), (0, 1, 0), (0.035, 0.001, 0.06), 'win-white')
    m.lathe(-0.5, 0.25, [(0.3, 0.0), (0.0, 0.002)], 'glass-dark', seg=14)
    return m


MODELS = [column, charger, ceiling, barrier, cabin_screen, guard, floor_bits]
