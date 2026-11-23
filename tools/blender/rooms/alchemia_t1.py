"""Alchemia's T1 after the scene's card (`docs/lokacje/alchemia-t1.md`, ADR-0102 point 5, ADR-0098): Hana's handcart
with its tarp and the cool box a delivery just went into, the awning and the kitchen's extract over Fumiko's hatch, her
stools with the bowls and cups on the hatch's counter, the smokers' leavings under the gallery's front.

Sizes from the simulation (`packages/sim/src/content/alchemia/market.ts`, `fumiko-p0.ts`, `foodhall.ts`): the cart is
the solid's 0.9 x 1.0 x 1.8 m, its lamp on its pole 1.6 m north of its middle; the hatch is 4.6 m wide and 2.4 m high in
the front wall, its counter 1.0 m over T1 and 0.8 m deep; the stools stand 1.2 m out of it. Each model's foot is on y = 0
where it stands (T1, the front wall's foot), its front to +z (north, out onto T1); variations from `hashf`, so the same
script gives the same file. Comic realism (`docs/zasady-lokacji.md` §9): a real two-wheeled market handcart, a real
canvas awning and extract fan, real bar stools.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-t1-props.glb'

# The cart's solid: 0.9 across (x), 1.8 along (z), its bed's top under 1.0.
HALF_W = 0.45
HALF_L = 0.9
BED = 0.62
# The hatch in the front wall (its middle at x 0, the wall's outer face at z 0) and its counter.
HATCH = 2.3
HATCH_TOP = 2.4
COUNTER = 1.0


def _ring(m, cx, y, cz, r, role, n=10, t=0.012):
    """A coil lying flat: a ring of short tubes."""
    for k in range(n):
        a0 = 2 * math.pi * k / n
        a1 = 2 * math.pi * (k + 1) / n
        m.tube((cx + r * math.cos(a0), y, cz + r * math.sin(a0)), (cx + r * math.cos(a1), y, cz + r * math.sin(a1)), t, role, seg=6)


def cart():
    """Hana's handcart, a delivery just in (0.9 x 1.0 x 1.8 m, its middle at the origin, its handles to the south, -z):
    two spoked wheels on an axle under the bed's middle, two legs at its north end, the plank bed with low sides, the
    handles of its drawbar, the blue tarp on three hoops over the south half, folded back off the north one, where the
    cool box stands open with the modules in their foil, the crates of parts, a coil of cable, the tape, her mug and the
    cardboard price board; the battery of the lamp at the lamp pole's foot with its lead up the pole."""
    m = Model('rd-t1-cart')
    # The wheels, their axle and the bed's frame.
    for s in (-1, 1):
        x = s * (HALF_W + 0.06)
        m.tube((x - 0.04, 0.3, 0.0), (x + 0.04, 0.3, 0.0), 0.3, 'tyre', seg=16)
        m.tube((x - 0.05, 0.3, 0.0), (x + 0.05, 0.3, 0.0), 0.07, 'metal', seg=10)
        for k in range(6):
            a = k * math.pi / 3 + 0.2
            m.tube((x, 0.3, 0.0), (x, 0.3 + 0.24 * math.sin(a), 0.24 * math.cos(a)), 0.012, 'metal', seg=6)
    m.tube((-HALF_W - 0.02, 0.3, 0.0), (HALF_W + 0.02, 0.3, 0.0), 0.025, 'metal', seg=8)
    for s in (-1, 1):
        m.box(s * 0.3 - 0.03, s * 0.3 + 0.03, 0.3, BED - 0.04, -0.04, 0.04, 'metal')
        m.box(s * HALF_W - 0.04, s * HALF_W, BED - 0.08, BED - 0.02, -HALF_L, HALF_L, 'metal')
    # The legs at the north end, the bed's planks, its low sides and the end boards.
    for s in (-1, 1):
        m.box(s * 0.36 - 0.03, s * 0.36 + 0.03, 0.0, BED - 0.06, HALF_L - 0.12, HALF_L - 0.06, 'metal')
    for k in range(6):
        x0 = -HALF_W + k * 0.15
        m.box(x0 + 0.005, x0 + 0.145, BED - 0.04, BED, -HALF_L, HALF_L, 'door', bevel=0.005)
    for s in (-1, 1):
        m.box(s * HALF_W - (0.025 if s > 0 else 0.0), s * HALF_W + (0.0 if s > 0 else 0.025), BED, BED + 0.18, -HALF_L, HALF_L, 'door')
    m.box(-HALF_W, HALF_W, BED, BED + 0.18, HALF_L - 0.025, HALF_L, 'door')
    m.box(-HALF_W, HALF_W, BED, BED + 0.12, -HALF_L, -HALF_L + 0.025, 'door')
    # The drawbar's two handles and the grip between them, out of the south end.
    for s in (-1, 1):
        m.tube((s * 0.3, BED - 0.05, -HALF_L), (s * 0.27, 0.72, -HALF_L - 0.45), 0.02, 'metal', seg=8)
    m.tube((-0.29, 0.72, -HALF_L - 0.45), (0.29, 0.72, -HALF_L - 0.45), 0.022, 'dark', seg=8)
    # The tarp's hoops over the south half and the tarp on them, its north edge folded back in a roll.
    for z in (-0.85, -0.45, -0.05):
        prev = None
        for k in range(7):
            a = math.pi * k / 6
            p = (-HALF_W * math.cos(a), BED + 0.18 + 0.32 * math.sin(a), z)
            if prev:
                m.tube(prev, p, 0.01, 'metal', seg=6)
            prev = p
    for k in range(6):
        a0 = math.pi * k / 6
        a1 = math.pi * (k + 1) / 6
        x0, y0 = -HALF_W * math.cos(a0), BED + 0.18 + 0.32 * math.sin(a0)
        x1, y1 = -HALF_W * math.cos(a1), BED + 0.18 + 0.32 * math.sin(a1)
        sag = 0.012 * hashf(k, 3.0)
        m.quad([(x0, y0 + 0.012 - sag, -0.9), (x1, y1 + 0.012 - sag, -0.9), (x1, y1 + 0.012, 0.0), (x0, y0 + 0.012, 0.0)], 'fabric-teal')
    m.tube((-HALF_W, BED + 0.2, 0.04), (HALF_W, BED + 0.2, 0.04), 0.05, 'fabric-teal', seg=10)
    m.box(-HALF_W - 0.01, -HALF_W + 0.01, BED + 0.05, BED + 0.2, -0.9, 0.0, 'fabric-teal')
    m.box(HALF_W - 0.01, HALF_W + 0.01, BED + 0.05, BED + 0.2, -0.9, 0.0, 'fabric-teal')
    # Under the tarp: two crates of parts, the cable coil on the nearer one.
    m.box(-0.38, 0.0, BED, BED + 0.26, -0.82, -0.36, 'rust', bevel=0.01)
    m.box(-0.34, -0.04, BED + 0.26, BED + 0.29, -0.78, -0.4, 'dark')
    m.box(0.04, 0.38, BED, BED + 0.22, -0.8, -0.3, 'trim', bevel=0.01)
    for k in range(4):
        x = 0.1 + k * 0.07
        m.cyl(x, -0.55 + 0.04 * hashf(k, 1.0), 0.025, BED + 0.22, BED + 0.3, 'metal', seg=8)
    _ring(m, -0.19, BED + 0.31, -0.6, 0.11, 'cable', n=12, t=0.014)
    _ring(m, -0.19, BED + 0.33, -0.6, 0.09, 'cable', n=10, t=0.014)
    # The cool box open on the north half: its walls, the lid up against its back, the frost and the modules in foil.
    z0, z1 = 0.14, 0.8
    m.box(-0.33, 0.33, BED, BED + 0.4, z0, z1, 'trim-light', bevel=0.015)
    m.box(-0.29, 0.29, BED + 0.08, BED + 0.39, z0 + 0.04, z1 - 0.04, 'dark')
    m.box(-0.33, 0.33, BED + 0.38, BED + 0.84, z1 - 0.02, z1 + 0.03, 'trim-light', bevel=0.01)
    m.box(-0.2, 0.2, BED + 0.58, BED + 0.66, z1 + 0.03, z1 + 0.04, 'neon-blue')
    for k in range(6):
        x = -0.22 + (k % 3) * 0.15
        z = z0 + 0.14 + (k // 3) * 0.26
        m.box(x - 0.06, x + 0.06, BED + 0.24, BED + 0.33 + 0.02 * hashf(k, 5.0), z - 0.09, z + 0.09, 'glass-blue', bevel=0.01)
    for k in range(5):
        x = -0.28 + k * 0.14
        m.box(x - 0.03, x + 0.03, BED + 0.38, BED + 0.4, z0 + 0.02, z0 + 0.05, 'win-white')
    # On the bed by the box: the tape, her mug, the price board leaning on the west side facing the customers.
    m.cyl(0.38, 0.32, 0.05, BED, BED + 0.05, 'paint', seg=12)
    m.cyl(0.38, 0.32, 0.025, BED, BED + 0.051, 'dark', seg=8)
    m.cyl(-0.38, 0.4, 0.04, BED, BED + 0.1, 'win-white', seg=12)
    m.obox((-HALF_W - 0.03, BED + 0.24, 0.4), (0, 0, 1), (0.15, 0.99, 0), (0.28, 0.2, 0.006), 'sign-back')
    m.obox((-HALF_W - 0.04, BED + 0.26, 0.4), (0, 0, 1), (0.15, 0.99, 0), (0.22, 0.14, 0.002), 'win-white')
    # The lamp's battery at the pole's foot (1.6 m north), its lead up to the lamp.
    m.box(0.12, 0.42, 0.0, 0.22, 1.5, 1.7, 'dark', bevel=0.01)
    m.box(0.16, 0.22, 0.22, 0.25, 1.56, 1.6, 'neon-red')
    m.box(0.32, 0.38, 0.22, 0.25, 1.56, 1.6, 'metal')
    m.tube((0.19, 0.25, 1.58), (0.08, 0.9, 1.6), 0.008, 'cable', seg=6)
    m.tube((0.08, 0.9, 1.6), (0.06, 2.4, 1.6), 0.008, 'cable', seg=6)
    return m


def hatch():
    """Over Fumiko's hatch in the gallery's front (the wall's outer face at z 0, the hatch's middle at x 0): the striped
    canvas awning on its steel arms, the noren in the hatch's top, a red paper lantern at its east end and the menu
    board by it (5.2 x 2.6 x 1.1). The kitchen's extract over the awning is a model of its own (`extract`)."""
    m = Model('rd-t1-hatch')
    # The awning: its frame on the wall, the arms, the canvas sloping out, the valance.
    y0, y1, out = HATCH_TOP + 0.45, HATCH_TOP + 0.15, 1.1
    m.box(-HATCH - 0.3, HATCH + 0.3, y0 - 0.06, y0 + 0.04, 0.0, 0.08, 'metal')
    for x in (-HATCH - 0.2, 0.0, HATCH + 0.2):
        m.tube((x, y0 - 0.5, 0.04), (x, y1, out), 0.02, 'metal', seg=8)
    for k in range(10):
        x0 = -HATCH - 0.3 + k * (2 * HATCH + 0.6) / 10
        x1 = x0 + (2 * HATCH + 0.6) / 10
        m.quad([(x0, y0, 0.06), (x1, y0, 0.06), (x1, y1, out), (x0, y1, out)], 'fabric-amber' if k % 2 == 0 else 'trim-light')
        m.quad([(x0, y1, out), (x1, y1, out), (x1, y1 - 0.22, out + 0.01), (x0, y1 - 0.22, out + 0.01)], 'fabric-amber' if k % 2 == 0 else 'trim-light')
    # The noren: five panels hanging from a rod in the hatch's top.
    m.tube((-HATCH, HATCH_TOP - 0.06, 0.06), (HATCH, HATCH_TOP - 0.06, 0.06), 0.012, 'metal', seg=6)
    for k in range(5):
        x0 = -HATCH + 0.04 + k * (2 * HATCH - 0.08) / 5
        x1 = x0 + (2 * HATCH - 0.08) / 5 - 0.03
        m.box(x0, x1, HATCH_TOP - 0.55, HATCH_TOP - 0.06, 0.05, 0.065, 'fabric-magenta')
    # The red paper lantern at the east end on its bracket, the menu board under it.
    m.tube((HATCH + 0.15, 2.2, 0.0), (HATCH + 0.15, 2.2, 0.3), 0.012, 'metal', seg=6)
    m.lathe(HATCH + 0.15, 0.3, [(0.0, 0.0), (0.12, 0.04), (0.16, 0.18), (0.12, 0.34), (0.0, 0.38)], 'neon-red', seg=14, y0=1.78)
    m.box(HATCH + 0.05, HATCH + 0.65, 1.0, 1.75, 0.0, 0.04, 'dark')
    for k in range(5):
        y = 1.12 + k * 0.12
        m.box(HATCH + 0.1, HATCH + 0.1 + 0.25 + 0.25 * hashf(k, 2.0), y, y + 0.04, 0.04, 0.045, 'win-white')
    return m


# The extract's fan box stands this far out of the wall: its model's origin is there, so its sound is the open air's
# (a source within 0.6 m of a room counts as the room's, `room-sound-map.ts`), and its geometry goes back to the wall.
EXTRACT_OUT = 0.65
# Its place along the front from the hatch's middle (west, over the stove).
EXTRACT_X = -HATCH + 0.9


def extract():
    """The kitchen's extract out through the front over the awning (its origin 0.65 m out of the wall's face, the wall
    at z -0.65): the duct, the fan box with its louvres and the grease run down the wall under it (0.64 x 0.6 x 0.65)."""
    m = Model('rd-t1-extract')
    y0 = HATCH_TOP + 0.45
    w = -EXTRACT_OUT
    m.box(-0.2, 0.2, y0 + 0.25, y0 + 0.65, w, w + 0.35, 'metal')
    m.box(-0.32, 0.32, y0 + 0.15, y0 + 0.75, w + 0.35, w + 0.6, 'metal', bevel=0.02)
    for k in range(5):
        y = y0 + 0.22 + k * 0.1
        m.obox((0.0, y, w + 0.61), (1, 0, 0), (0, 0.7, 0.7), (0.28, 0.035, 0.005), 'ac-grille')
    m.box(-0.12, 0.08, y0 + 0.02, y0 + 0.15, w, w + 0.012, 'rust')
    return m


def stools():
    """Before the hatch (its middle at x 0, the wall's face at z 0): three bar stools 1.2 m out, the leavings under them,
    and on the counter in the hatch two bowls with chopsticks across, cups of tea, the napkin box, the chilli jar and the
    soy bottle (4.0 x 0.8 x 2.0)."""
    m = Model('rd-t1-stools')
    for k, x in enumerate((-1.6, 0.0, 1.35)):
        z = 1.2
        m.cyl(x, z, 0.035, 0.0, 0.72, 'metal', seg=8)
        m.lathe(x, z, [(0.0, 0.0), (0.2, 0.0), (0.21, 0.02), (0.0, 0.03)], 'dark', seg=16, y0=0.0)
        m.tube((x - 0.15, 0.3, z), (x + 0.15, 0.3, z), 0.012, 'metal', seg=6)
        m.lathe(x, z, [(0.0, 0.0), (0.17, 0.0), (0.18, 0.04), (0.16, 0.07), (0.0, 0.075)], 'neon-red' if k == 1 else 'fabric-magenta', seg=16, y0=0.72)
        for j in range(3):
            a = hashf(k, j) * 2 * math.pi
            r = 0.25 + 0.15 * hashf(j, k, 2.0)
            bx, bz = x + r * math.cos(a), z + r * math.sin(a)
            m.tube((bx, 0.008, bz), (bx + 0.03 * math.cos(a + 1), 0.008, bz + 0.03 * math.sin(a + 1)), 0.005, 'win-white', seg=5)
    # On the counter (1.0 over T1, from the wall's face 0.8 in): bowls, chopsticks, cups, napkins, chilli, soy.
    c = COUNTER
    for k, x in enumerate((-1.3, 0.4)):
        m.lathe(x, -0.25, [(0.0, 0.0), (0.05, 0.0), (0.09, 0.04), (0.1, 0.08), (0.0, 0.075)], 'trim-light', seg=14, y0=c)
        m.tube((x - 0.1, c + 0.085, -0.28), (x + 0.12, c + 0.085, -0.22), 0.004, 'paint', seg=5)
        m.tube((x - 0.1, c + 0.085, -0.25), (x + 0.12, c + 0.085, -0.19), 0.004, 'paint', seg=5)
    for k, x in enumerate((-0.7, 1.0, 1.15)):
        m.lathe(x, -0.15, [(0.0, 0.0), (0.03, 0.0), (0.035, 0.07), (0.0, 0.07)], 'trim-light', seg=10, y0=c)
    m.box(-0.2, -0.05, c, c + 0.1, -0.45, -0.35, 'win-white')
    m.lathe(0.05, -0.42, [(0.0, 0.0), (0.03, 0.0), (0.03, 0.08), (0.015, 0.1), (0.0, 0.1)], 'neon-red', seg=10, y0=c)
    m.lathe(0.13, -0.42, [(0.0, 0.0), (0.025, 0.0), (0.025, 0.1), (0.01, 0.13), (0.0, 0.14)], 'dark', seg=10, y0=c)
    return m


def butts():
    """Where people smoke under the gallery's front (the wall's foot at z 0): butts in the joint and round it, two cans,
    one crushed, a night-market flyer trodden flat (1.0 x 0.12 x 0.6)."""
    m = Model('rd-t1-butts')
    for k in range(12):
        a = hashf(k, 1.0) * math.pi
        x = -0.45 + 0.9 * hashf(k, 2.0)
        z = 0.04 + 0.45 * hashf(k, 3.0) ** 2
        m.tube((x, 0.006, z), (x + 0.032 * math.cos(a), 0.006, z + 0.032 * math.sin(a)), 0.0045, 'win-white' if k % 3 else 'fabric-amber', seg=5)
    m.cyl(0.32, 0.1, 0.033, 0.0, 0.12, 'neon-cyan', seg=12)
    m.tube((-0.2, 0.025, 0.35), (-0.09, 0.025, 0.4), 0.03, 'paint', seg=10)
    m.quad([(-0.05, 0.003, 0.2), (0.16, 0.003, 0.17), (0.18, 0.003, 0.47), (-0.03, 0.003, 0.5)], 'neon-pink')
    return m


MODELS = [cart, hatch, extract, stools, butts]
