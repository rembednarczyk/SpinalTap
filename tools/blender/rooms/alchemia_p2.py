"""P-2, Alchemia's automated car store (`docs/pomieszczenia/alchemia-p2.md`, ADR-0098): what its card asks for besides
the pallets, cars, racks, rails, beacons, robots and the control room's console Alchemia's engine and the scenery
draw (`packages/sim/src/content/alchemia/p2-store.ts`).

Sizes from the simulation: the store 2.3 m high, the control room in the south-east corner. Each model's foot is on
y = 0 where it stands (the floor, a wall's spot, the ceiling for what hangs), its front to +z.
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-alchemia-props.glb'


def tech():
    """What the service technician left by the control room's door: overalls hung open on a hook, a red toolbox on the
    floor with its lid up and spanners in it, a grease canister, rags (0.9 x 1.75 x 0.45)."""
    m = Model('rd-p2-tech')
    m.box(-0.03, 0.03, 1.66, 1.7, 0.0, 0.05, 'metal')
    m.tube((0.0, 1.68, 0.05), (0.0, 1.64, 0.09), 0.008, 'metal', seg=6)
    # The overalls: shoulders on the hook, the body, the sleeves hanging, the legs.
    m.box(-0.22, 0.22, 1.05, 1.62, 0.02, 0.1, 'fabric-teal', bevel=0.03)
    for s in (-1, 1):
        m.obox((s * 0.27, 1.32, 0.06), (0, 0, 1), (0.25 * s, -0.97, 0.0), (0.04, 0.27, 0.05), 'fabric-teal')
    for x0, x1 in ((-0.2, -0.02), (0.02, 0.2)):
        m.box(x0, x1, 0.25, 1.06, 0.02, 0.09, 'fabric-teal', bevel=0.02)
    m.box(-0.2, 0.2, 1.28, 1.34, 0.1, 0.105, 'neon-amber')
    m.box(-0.12, -0.02, 1.45, 1.5, 0.1, 0.104, 'win-white')
    # The toolbox, its lid up, spanners and a screwdriver in its tray.
    m.box(0.25, 0.75, 0.0, 0.22, 0.1, 0.36, 'neon-red', bevel=0.01)
    m.obox((0.5, 0.33, 0.08), (1, 0, 0), (0, 0.6, -0.8), (0.25, 0.13, 0.01), 'neon-red')
    for k in range(3):
        x = 0.33 + k * 0.12
        m.box(x, x + 0.02, 0.22, 0.235, 0.14, 0.32, 'metal')
    m.tube((0.7, 0.23, 0.15), (0.6, 0.23, 0.33), 0.008, 'neon-amber', seg=6)
    # The grease canister and the rags by it.
    m.box(-0.62, -0.38, 0.0, 0.34, 0.12, 0.34, 'neon-green', bevel=0.02)
    m.cyl(-0.45, 0.2, 0.025, 0.34, 0.39, 'dark', seg=8)
    m.box(-0.58, -0.42, 0.34, 0.37, 0.16, 0.3, 'dark')
    for k in range(3):
        x = -0.3 + 0.12 * k
        m.box(x, x + 0.16, 0.0, 0.03 + 0.02 * hashf(k, 1.0), 0.3 + 0.03 * k, 0.42, 'trim-light', bevel=0.012)
    return m


def cabinet():
    """The control cabinet in the control room against its east wall: a grey steel cabinet with a screen showing the
    store's plan, a row of lamps (one red: robot three), two key switches, an emergency stop, cable ducts up to the ceiling
    (0.6 x 2.3 x 0.5)."""
    m = Model('rd-p2-cabinet')
    w, h, d = 0.6, 2.0, 0.5
    m.box(-w / 2, w / 2, 0.0, 0.08, -d / 2 + 0.02, d / 2 - 0.02, 'dark')
    m.box(-w / 2, w / 2, 0.08, h, -d / 2, d / 2, 'trim', bevel=0.012)
    m.box(-w / 2 + 0.03, w / 2 - 0.03, 0.12, h - 0.04, d / 2, d / 2 + 0.008, 'trim-light')
    m.box(-0.22, 0.22, 1.3, 1.65, d / 2 + 0.008, d / 2 + 0.012, 'dark')
    m.box(-0.2, 0.2, 1.32, 1.63, d / 2 + 0.012, d / 2 + 0.014, 'win-teal')
    for i in range(2):
        for j in range(10):
            x = -0.18 + j * 0.04
            z = d / 2 + 0.015
            y = 1.38 + i * 0.12
            m.box(x, x + 0.025, y, y + 0.06, z, z + 0.002, 'neon-amber' if (i * 10 + j) % 7 else 'dark')
    for k in range(5):
        x = -0.2 + k * 0.1
        m.tube((x, 1.15, d / 2 + 0.008), (x, 1.15, d / 2 + 0.03), 0.018, 'neon-red' if k == 2 else 'neon-green', seg=8)
    for x in (-0.12, 0.0):
        m.tube((x, 0.95, d / 2 + 0.008), (x, 0.95, d / 2 + 0.03), 0.022, 'metal', seg=8)
    m.tube((0.15, 0.95, d / 2 + 0.008), (0.15, 0.95, d / 2 + 0.02), 0.04, 'neon-amber', seg=12)
    m.tube((0.15, 0.95, d / 2 + 0.02), (0.15, 0.95, d / 2 + 0.05), 0.03, 'neon-red', seg=12)
    m.box(0.2, 0.24, 0.85, 1.05, d / 2 + 0.008, d / 2 + 0.03, 'dark')
    m.box(-0.2, 0.2, h, 2.3, -0.1, 0.05, 'metal')
    return m


def pipes():
    """Service pipes under the ceiling along the store's east wall (along x, 23.4 m): a sprinkler main with its heads, a
    drain pipe, their hangers every 2 m."""
    m = Model('rd-p2-pipes')
    n = 23.4
    m.tube((-n / 2, 0.0, 0.0), (n / 2, 0.0, 0.0), 0.05, 'neon-red', seg=10)
    m.tube((-n / 2, 0.02, 0.18), (n / 2, 0.02, 0.18), 0.04, 'pipe', seg=10)
    x = -n / 2 + 0.6
    k = 0
    while x < n / 2:
        m.box(x - 0.02, x + 0.02, 0.0, 0.2, -0.06, 0.24, 'dark')
        if k % 2 == 0:
            m.tube((x + 1.0, -0.05, 0.0), (x + 1.0, -0.14, 0.0), 0.012, 'metal', seg=6)
            m.lathe(x + 1.0, 0.0, [(0.03, -0.16), (0.012, -0.14), (0.0, -0.14)], 'metal', seg=8)
        x += 2.0
        k += 1
    return m


def lamp():
    """A bulkhead fitting in a wire cage under the ceiling (foot at the ceiling): a grey body, its frosted lens lit cold
    white, the cage's bars (0.5 x 0.18 x 0.2)."""
    m = Model('rd-p2-lamp')
    m.box(-0.25, 0.25, -0.1, 0.0, -0.1, 0.1, 'trim', bevel=0.01)
    m.box(-0.22, 0.22, -0.12, -0.1, -0.08, 0.08, 'win-white')
    for k in range(6):
        x = -0.22 + k * 0.088
        m.tube((x, -0.1, -0.09), (x, -0.17, 0.0), 0.004, 'metal', seg=4)
        m.tube((x, -0.17, 0.0), (x, -0.1, 0.09), 0.004, 'metal', seg=4)
    m.tube((-0.24, -0.17, 0.0), (0.24, -0.17, 0.0), 0.005, 'metal', seg=4)
    return m


def oil():
    """Oil stains on the lane's floor where a robot leaks, a rag dropped in one (1.4 x 0.9)."""
    m = Model('rd-p2-oil')
    for k in range(5):
        x = -0.6 + 1.2 * hashf(k, 1.0)
        z = -0.35 + 0.7 * hashf(k, 2.0)
        r = 0.08 + 0.18 * hashf(k, 3.0)
        m.lathe(x, z, [(r, 0.0), (0.0, 0.002)], 'glass-dark', seg=12)
    m.box(0.2, 0.4, 0.0, 0.015, -0.1, 0.05, 'trim-light', bevel=0.006)
    return m


def butts():
    """Where somebody waits at the tunnel's end by the car store (§14's clutter cluster): cigarette butts ground out on the
    concrete, a crushed can of beer, a cheap lighter, a ripped cigarette pack (0.5 x 0.06 x 0.4; foot on the floor)."""
    m = Model('rd-p2t-butts')
    for k in range(7):
        a = k * 2.4
        x, z = 0.12 * math.cos(a) * (0.4 + 0.1 * k), 0.1 * math.sin(a) * (0.5 + 0.08 * k)
        m.tube((x, 0.006, z), (x + 0.022 * math.cos(a * 1.7), 0.006, z + 0.022 * math.sin(a * 1.7)), 0.005, 'win-white' if k % 3 else 'fabric-amber', seg=6)
    m.tube((0.14, 0.025, 0.1), (0.2, 0.03, 0.14), 0.028, 'metal', seg=10)
    m.lathe(0.2, 0.14, [(0.03, 0.0), (0.015, 0.012), (0.0, 0.014)], 'neon-red', seg=10, y0=0.02)
    m.box(-0.2, -0.17, 0.0, 0.012, -0.08, -0.03, 'neon-pink', bevel=0.003)
    m.box(-0.06, 0.03, 0.0, 0.02, -0.17, -0.12, 'win-white', bevel=0.004)
    m.box(-0.06, 0.03, 0.02, 0.022, -0.17, -0.12, 'neon-red')
    return m


def gate_debris():
    """At the shelter's gate in the tunnel's east wall: chips of concrete and paint the crowbar levered off its frame, a
    lump of plaster, a work glove dropped, the crowbar's bright scars on the frame's edge (0.7 x 1.3 x 0.4; foot on the
    floor, the wall at -z)."""
    m = Model('rd-p2t-gate')
    for k in range(9):
        x = -0.3 + 0.07 * k + 0.02 * math.sin(k * 3.1)
        z = 0.05 + 0.1 * abs(math.sin(k * 1.9))
        r = 0.012 + 0.008 * (k % 3)
        m.box(x - r, x + r, 0.0, r * 1.2, z - r, z + r * 0.8, 'wall' if k % 2 else 'trim', bevel=0.003)
    m.box(0.12, 0.26, 0.0, 0.06, 0.12, 0.24, 'wall', bevel=0.02)
    m.box(-0.18, -0.06, 0.0, 0.025, 0.2, 0.3, 'fabric-amber', bevel=0.01)
    for y, h in ((0.95, 0.12), (1.18, 0.08)):
        m.box(-0.33, -0.3, y, y + h, 0.0, 0.006, 'metal')
    return m


def litter():
    """What the rain and the draught blow in at the portal from the cutting: dead leaves, a soaked newspaper flattened on
    the wet concrete, a noodle cup, a plastic bottle (0.9 x 0.08 x 0.6; foot on the floor)."""
    m = Model('rd-p2t-litter')
    for k in range(8):
        a = k * 2.2
        x, z = 0.38 * math.cos(a) * (0.3 + 0.08 * k), 0.24 * math.sin(a) * (0.4 + 0.07 * k)
        m.box(x - 0.03, x + 0.03, 0.0, 0.004, z - 0.018, z + 0.018, 'plant' if k % 3 else 'fabric-amber')
    m.box(-0.28, 0.02, 0.0, 0.004, -0.05, 0.17, 'trim-light')
    m.box(-0.24, -0.04, 0.004, 0.005, -0.02, 0.06, 'dark')
    m.tube((0.12, 0.04, -0.12), (0.2, 0.045, -0.08), 0.04, 'win-white', seg=12)
    m.tube((0.28, 0.03, 0.12), (0.46, 0.032, 0.18), 0.03, 'glass-blue', seg=10)
    m.tube((0.46, 0.032, 0.18), (0.51, 0.033, 0.2), 0.012, 'neon-cyan', seg=8)
    return m


MODELS = [tech, cabinet, pipes, lamp, oil, butts, gate_debris, litter]
