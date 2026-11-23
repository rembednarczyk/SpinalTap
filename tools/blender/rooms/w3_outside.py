"""W-3's outside after the scenes' cards (`docs/lokacje/w3-pas-publiczny.md`, `w3-wieza.md`, `w3-rurociag-basen.md`,
ADR-0102 point 5, ADR-0098): Genzō's fire barrel where the crate by KAIUN stands and his things under the container;
the smokers' corner by the pass office's door in the tower; what the pipe walkers leave on the landing over the bank;
the warning board at the ladder's foot.

Sizes from the simulation (`packages/sim/src/content/tessen-w3/public.ts`, `tower-pipes.ts`): the crate the barrel
stands for is 0.7 x 0.9 x 0.7 m; the landing is 4 x 3 m over the pipe walk's trestle. Each model's foot is on y = 0
where it stands, its front to +z. Variations from `hashf`, so the same script gives the same file. Comic realism
(`docs/zasady-lokacji.md` §9): a real 200 l drum cut into a brazier, a real sand-bucket ashtray, a real enamel board.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-w3-out-props.glb'


def _butts(m, n, r, seed, y=0.006):
    for k in range(n):
        a = hashf(k, seed) * math.pi
        t = 2 * math.pi * hashf(k, seed + 1.0)
        d = r * hashf(k, seed + 2.0) ** 0.5
        x, z = d * math.cos(t), d * math.sin(t)
        m.tube((x, y, z), (x + 0.032 * math.cos(a), y, z + 0.032 * math.sin(a)), 0.0045, 'win-white' if k % 3 else 'fabric-amber', seg=5)


def barrel():
    """Genzō's brazier (in the crate's 0.7 x 0.9 x 0.7 m): a 200 l drum cut open at the top, its rolling hoops, air holes
    punched round its foot glowing, a grill over its mouth, the embers in it, two bricks it stands on (0.7 x 0.92 x 0.7)."""
    m = Model('rd-w3-barrel')
    for x in (-0.15, 0.15):
        m.box(x - 0.11, x + 0.11, 0.0, 0.065, -0.2, 0.2, 'brick', bevel=0.005)
    prof = [(0.0, 0.0), (0.29, 0.0), (0.29, 0.8), (0.275, 0.8), (0.275, 0.06), (0.0, 0.06)]
    m.lathe(0.0, 0.0, prof, 'rust', seg=12, y0=0.065)
    for y in (0.3, 0.58):
        m.lathe(0.0, 0.0, [(0.0, 0.0), (0.3, 0.0), (0.3, 0.03), (0.0, 0.03)], 'dark', seg=12, y0=0.065 + y)
    for k in range(8):
        a = 2 * math.pi * k / 8 + 0.2
        m.box(-0.03, 0.03, 0.15, 0.21, -0.01, 0.01, 'neon-amber')
        m.obox((0.292 * math.cos(a), 0.18, 0.292 * math.sin(a)), (-math.sin(a), 0, math.cos(a)), (0, 1, 0), (0.035, 0.03, 0.004), 'neon-amber')
    m.lathe(0.0, 0.0, [(0.0, 0.0), (0.27, 0.0), (0.2, 0.08), (0.0, 0.12)], 'neon-red', seg=10, y0=0.72)
    for k in range(7):
        x = -0.24 + k * 0.08
        m.tube((x, 0.88, -0.27), (x, 0.88, 0.27), 0.006, 'metal', seg=5)
    m.tube((-0.28, 0.88, 0.0), (0.28, 0.88, 0.0), 0.008, 'metal', seg=5)
    return m


def barrel_lod():
    """The brazier on the phone (`docs/zasady-lokacji.md` §9, simplified only there): the drum, its glowing embers and
    the grill as a plate, in few faces (0.6 x 0.9 x 0.6)."""
    m = Model('rd-w3-barrel-lod')
    m.box(-0.26, 0.26, 0.0, 0.065, -0.2, 0.2, 'brick')
    m.cyl(0.0, 0.0, 0.29, 0.065, 0.865, 'rust', seg=8)
    m.cyl(0.0, 0.0, 0.25, 0.865, 0.87, 'neon-red', seg=8)
    m.box(-0.28, 0.28, 0.875, 0.885, -0.27, 0.27, 'metal')
    return m


def genzo():
    """Genzō's things under KAIUN's north wall (the wall at z 0): two rods leaning on it, a cool box with a thermos on
    it, a coil of net with its floats, a folded chair, a carton of cigarettes on the box (1.6 x 2.4 x 0.8)."""
    m = Model('rd-w3-genzo')
    for k, x in enumerate((-0.6, -0.45)):
        m.tube((x, 0.0, 0.3), (x + 0.1, 2.35, 0.03), 0.009, 'dark', seg=6)
        m.tube((x + 0.005, 0.35, 0.27), (x + 0.02, 0.6, 0.25), 0.02, 'metal', seg=8)
    m.box(-0.2, 0.3, 0.0, 0.35, 0.05, 0.4, 'trim-light', bevel=0.02)
    m.box(-0.2, 0.3, 0.33, 0.38, 0.05, 0.4, 'fabric-teal', bevel=0.01)
    m.cyl(0.18, 0.15, 0.045, 0.38, 0.68, 'metal', seg=12)
    m.cyl(0.18, 0.15, 0.05, 0.68, 0.73, 'fabric-teal', seg=12)
    m.box(-0.12, 0.08, 0.38, 0.43, 0.15, 0.3, 'neon-red', bevel=0.005)
    for k in range(9):
        a = 2 * math.pi * k / 9
        m.tube((0.65 + 0.22 * math.cos(a), 0.05 + 0.03 * (k % 2), 0.45 + 0.18 * math.sin(a)), (0.65 + 0.22 * math.cos(a + 0.7), 0.06, 0.45 + 0.18 * math.sin(a + 0.7)), 0.025, 'fabric-amber', seg=6)
    for k in range(4):
        a = 2 * math.pi * k / 4 + 0.4
        m.lathe(0.65 + 0.2 * math.cos(a), 0.45 + 0.16 * math.sin(a), [(0.0, 0.0), (0.04, 0.01), (0.04, 0.05), (0.0, 0.06)], 'neon-red', seg=8, y0=0.06)
    m.obox((0.85, 0.42, 0.08), (1, 0, 0), (0, 0.98, 0.2), (0.2, 0.42, 0.02), 'fabric-teal')
    for s in (-1, 1):
        m.tube((0.85 + s * 0.18, 0.0, 0.16), (0.85 + s * 0.18, 0.85, 0.0), 0.01, 'metal', seg=5)
    return m


def tower_door():
    """By the pass office's door (the wall at z 0): a sand bucket for an ashtray, butts round it and in it, a crate of
    bottled water for the shift, a hard hat on it (0.9 x 0.6 x 0.6)."""
    m = Model('rd-w3-tower-door')
    m.lathe(-0.25, 0.25, [(0.0, 0.0), (0.13, 0.0), (0.15, 0.32), (0.0, 0.32)], 'neon-red', seg=14, y0=0.0)
    m.lathe(-0.25, 0.25, [(0.0, 0.0), (0.14, 0.0), (0.0, 0.002)], 'fabric-amber', seg=12, y0=0.3)
    for k in range(6):
        a = 2 * math.pi * k / 6
        m.tube((-0.25 + 0.07 * math.cos(a), 0.31, 0.25 + 0.07 * math.sin(a)), (-0.25 + 0.05 * math.cos(a), 0.34, 0.25 + 0.05 * math.sin(a)), 0.004, 'win-white', seg=4)
    m.box(0.05, 0.45, 0.0, 0.25, 0.05, 0.35, 'trim', bevel=0.01)
    for k in range(6):
        x = 0.1 + (k % 3) * 0.13
        z = 0.12 + (k // 3) * 0.15
        m.lathe(x, z, [(0.0, 0.0), (0.035, 0.0), (0.035, 0.22), (0.012, 0.28), (0.0, 0.28)], 'glass-blue', seg=8, y0=0.02)
    m.lathe(0.25, 0.2, [(0.0, 0.0), (0.16, 0.0), (0.15, 0.05), (0.11, 0.13), (0.0, 0.15)], 'fabric-amber', seg=14, y0=0.3)
    _butts(m, 10, 0.45, 11.0)
    return m


def landing():
    """On the pipe walk's landing over the bank (its middle at the origin): a canvas tool bag open with a pipe wrench
    out of it, a thermos, a rag, a coil of rope, butts by the rail (1.6 x 0.35 x 1.2)."""
    m = Model('rd-w3-landing')
    m.box(-0.5, -0.1, 0.0, 0.22, -0.15, 0.1, 'fabric-amber', bevel=0.03)
    m.box(-0.46, -0.14, 0.18, 0.24, -0.13, 0.08, 'dark')
    m.tube((-0.3, 0.22, 0.0), (-0.05, 0.35, 0.1), 0.012, 'neon-red', seg=6)
    m.box(-0.08, 0.0, 0.3, 0.38, 0.06, 0.14, 'metal')
    m.cyl(0.2, -0.3, 0.04, 0.0, 0.3, 'metal', seg=12)
    m.box(0.35, 0.65, 0.0, 0.01, 0.1, 0.3, 'fabric-teal')
    for k in range(10):
        a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
        m.tube((0.55 + 0.14 * math.cos(a0), 0.02, -0.3 + 0.14 * math.sin(a0)), (0.55 + 0.14 * math.cos(a1), 0.02, -0.3 + 0.14 * math.sin(a1)), 0.015, 'fabric-amber', seg=5)
    _butts(m, 7, 0.6, 21.0)
    return m


def ladder_board():
    """At the ladder's foot on the bank (facing the path): an enamel board on two posts warning of the pipeline and
    the restricted zone, its corner rusted, a padlocked chain across the ladder's foot (0.8 x 1.6 x 0.3)."""
    m = Model('rd-w3-ladder-board')
    for x in (-0.3, 0.3):
        m.cyl(x, 0.0, 0.025, 0.0, 1.55, 'metal', seg=8)
    m.box(-0.38, 0.38, 0.95, 1.5, 0.03, 0.045, 'trim-light', bevel=0.005)
    m.box(-0.34, 0.34, 1.36, 1.46, 0.045, 0.047, 'neon-red')
    for k in range(4):
        w = 0.25 + 0.3 * hashf(k, 31.0)
        m.box(-0.3, -0.3 + w, 1.26 - k * 0.07, 1.29 - k * 0.07, 0.045, 0.047, 'dark')
    m.obox((-0.1, 1.07, 0.047), (1, 0, 0), (0, 1, 0), (0.09, 0.09, 0.002), 'fabric-amber')
    m.box(0.26, 0.38, 0.95, 1.05, 0.046, 0.048, 'rust')
    for k in range(8):
        x = -0.35 + k * 0.1
        m.tube((x, 0.6 - 0.04 * math.sin(k * 0.45), 0.2), (x + 0.1, 0.6 - 0.04 * math.sin((k + 1) * 0.45), 0.2), 0.012, 'metal', seg=5)
    m.box(-0.03, 0.03, 0.48, 0.56, 0.18, 0.23, 'fabric-amber')
    return m


def locker14():
    """Locker 14 in the basement's locker room (its front at z 0, its middle at x 0, 2.75 x 2 m, ADR-0082 §1 Q1): the
    number stencilled on its left door, its right door ajar on its hinges with the hasp hanging, a technician's overalls
    half out of it and the hard hat on the floor before it (2.8 x 2.0 x 0.9)."""
    m = Model('rd-w3-locker14')
    digits = {'1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'], '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.']}
    cell = 0.035
    for i, ch in enumerate('14'):
        for r, row in enumerate(digits[ch]):
            for c, on in enumerate(row):
                if on == '#':
                    x = -0.95 + (i * 6 + c) * cell
                    y = 1.75 - r * cell
                    m.box(x, x + cell, y - cell, y, 0.0, 0.004, 'trim-light')
    for k in range(4):
        m.box(-1.2, -0.3, 0.4 + k * 0.08, 0.43 + k * 0.08, 0.0, 0.004, 'dark')
    # The right door swung out 25 degrees on its hinge at x 1.375.
    a = math.radians(25)
    hx = 1.375
    w = 1.3
    cx, cz = hx - math.cos(a) * w / 2, math.sin(a) * w / 2
    m.obox((cx, 1.0, cz + 0.01), (-math.cos(a), 0, math.sin(a)), (0, 1, 0), (w / 2, 0.98, 0.012), 'metal')
    m.obox((cx - math.cos(a) * 0.4, 1.75, cz + math.sin(a) * 0.4 + 0.02), (-math.cos(a), 0, math.sin(a)), (0, 1, 0), (0.12, 0.05, 0.003), 'trim-light')
    m.tube((0.1, 1.0, 0.02), (0.08, 0.85, 0.05), 0.006, 'metal', seg=5)
    m.box(0.02, 0.2, 0.0, 0.004, 0.0, 0.004, 'dark')
    # The overalls: a sleeve and a leg out of the gap, the rest folded on the floor; the hard hat by them.
    m.tube((0.35, 1.3, 0.02), (0.45, 0.6, 0.18), 0.06, 'fabric-amber', seg=8)
    m.box(-0.2, 0.5, 0.0, 0.12, 0.25, 0.75, 'fabric-amber', bevel=0.04)
    m.box(-0.18, 0.48, 0.12, 0.13, 0.4, 0.43, 'trim-light')
    m.lathe(0.85, 0.6, [(0.0, 0.0), (0.16, 0.0), (0.15, 0.05), (0.11, 0.13), (0.0, 0.15)], 'fabric-amber', seg=14, y0=0.0)
    return m


MODELS = [barrel, barrel_lod, genzo, tower_door, landing, ladder_board, locker14]
