"""Alchemia's T2 under the Arkady after the scene's card (`docs/lokacje/alchemia-t2-arkady.md`, ADR-0102 point 5,
ADR-0098): the name of the square cut into the memorial stone with the pebbles left on its top, a grave candle at its
foot and a ribbon on its bed; the outline of the early medieval settlement found under the square, laid in the paving;
what the Hebi lookout keeps by the shelter's hatch and what the Hebi group leaves under the arcades.

Sizes from the simulation (`packages/sim/src/content/alchemia/plaza.ts`, `market.ts`, `territory-groups.ts`): the
stone is 1.6 x 1.8 x 0.4 m standing 0.2 m in its bed, its bed 0.3 m over T2, 3.4 x 4.2 m. Each model's foot is on
y = 0 (T2), its front to +z; the stone's model faces south, to the stairs from T1. Variations from `hashf`, so the same
script gives the same file. Comic realism (`docs/zasady-lokacji.md` §9): a real memorial's cut letters, real pebbles
and a real glass grave candle, a real archaeological outline of stone strips flush with the paving.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-t2-props.glb'

# The stone in the model's frame: its south face at z +0.2, 1.6 wide, its top 1.6 over T2; its bed's top 0.3 over T2,
# its south edge 1.8 out of the stone's middle.
STONE_W = 0.8
STONE_FACE = 0.2
STONE_TOP = 1.6
BED_TOP = 0.3
BED_EDGE = 1.8

# A 5 x 7 cut alphabet for the square's name: rows from the top, '#' a cut cell.
GLYPHS = {
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'I': ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
}


def _cut_line(m, text, y_top, cell, z):
    """One line of cut letters centred on the face: each cell a shallow pale box, read left to right by a walker
    facing the stone (the model's -x is the walker's right at its front)."""
    width = (len(text) * 6 - 1) * cell
    x_left = width / 2
    for i, ch in enumerate(text):
        rows = GLYPHS.get(ch)
        if rows is None:
            continue
        x0 = x_left - i * 6 * cell
        for r, row in enumerate(rows):
            for c, on in enumerate(row):
                if on != '#':
                    continue
                x = x0 - c * cell
                y = y_top - r * cell
                m.box(x - cell, x, y - cell, y, z, z + 0.004, 'trim-light')


def tribute():
    """The memorial's front (its middle at the origin, facing +z, south): the square's name cut in two lines, the
    pebbles left on its top, a glass grave candle burning at its foot on the bed, a white and red ribbon on the bed's
    edge (1.7 x 1.65 x 1.9)."""
    m = Model('rd-t2-tribute')
    _cut_line(m, 'PLAC', 1.28, 0.024, STONE_FACE)
    _cut_line(m, 'OFIAR GETTA', 1.02, 0.018, STONE_FACE)
    # A cut rule under the name.
    m.box(-0.5, 0.5, 0.82, 0.83, STONE_FACE, STONE_FACE + 0.004, 'trim-light')
    # Pebbles on the top, each a squashed round stone.
    for k in range(9):
        x = -0.65 + 1.3 * hashf(k, 1.0)
        z = -0.12 + 0.24 * hashf(k, 2.0)
        r = 0.025 + 0.02 * hashf(k, 3.0)
        m.lathe(x, z, [(0.0, 0.0), (r, 0.004), (r * 1.05, r * 0.5), (r * 0.6, r * 0.9), (0.0, r)], 'trim' if k % 3 else 'trim-light', seg=8, y0=STONE_TOP)
    # The grave candle on the bed before the stone: red glass, its lid, the flame.
    cx, cz = 0.32, 0.55
    m.lathe(cx, cz, [(0.0, 0.0), (0.045, 0.0), (0.05, 0.12), (0.042, 0.16), (0.0, 0.16)], 'neon-red', seg=12, y0=BED_TOP)
    m.lathe(cx, cz, [(0.0, 0.0), (0.04, 0.0), (0.03, 0.03), (0.0, 0.035)], 'metal', seg=10, y0=BED_TOP + 0.16)
    m.lathe(cx, cz, [(0.0, 0.0), (0.012, 0.01), (0.008, 0.04), (0.0, 0.055)], 'neon-amber', seg=6, y0=BED_TOP + 0.05)
    # A second candle, gone out.
    m.lathe(cx - 0.16, cz + 0.08, [(0.0, 0.0), (0.04, 0.0), (0.045, 0.1), (0.0, 0.1)], 'dark', seg=10, y0=BED_TOP)
    # The ribbon lying over the bed's edge, its two tails down its face.
    for k in range(6):
        x0 = -0.55 + k * 0.12
        m.box(x0, x0 + 0.12, BED_TOP, BED_TOP + 0.006, BED_EDGE - 0.12, BED_EDGE, 'trim-light' if k % 2 == 0 else 'neon-red')
    m.box(-0.2, -0.15, BED_TOP - 0.22, BED_TOP, BED_EDGE, BED_EDGE + 0.006, 'trim-light')
    m.box(-0.12, -0.07, BED_TOP - 0.25, BED_TOP, BED_EDGE, BED_EDGE + 0.006, 'neon-red')
    return m


def settlement():
    """The outline of the early medieval settlement found under the square (`docs/plany/alchemia.md`, S9, S13): a ring
    of stone strips round its little square and four sunken huts round it as rectangles, flush with the paving, a
    bronze plate by the ring (11.2 x 0.01 x 9.6, its middle at the origin)."""
    m = Model('rd-t2-settlement')
    w = 0.12
    y = 0.006
    for k in range(28):
        a0 = 2 * math.pi * k / 28
        a1 = 2 * math.pi * (k + 1) / 28
        r = 1.8
        m.obox(((math.cos(a0) + math.cos(a1)) * r / 2, y / 2, (math.sin(a0) + math.sin(a1)) * r / 2),
               (-math.sin((a0 + a1) / 2), 0, math.cos((a0 + a1) / 2)), (0, 1, 0), (r * (a1 - a0) / 2 + 0.01, y / 2, w / 2), 'trim')
    huts = [(-4.2, 0.0, 1.4, 1.0), (4.2, 0.0, 1.4, 1.0), (0.0, -3.8, 1.0, 1.4), (0.0, 3.8, 1.0, 1.4)]
    for hx, hz, ax, az in huts:
        for s in (-1, 1):
            m.box(hx - ax, hx + ax, 0.0, y, hz + s * az - w / 2, hz + s * az + w / 2, 'trim')
            m.box(hx + s * ax - w / 2, hx + s * ax + w / 2, 0.0, y, hz - az, hz + az, 'trim')
        # The hearth's stones in each hut's middle.
        for k in range(5):
            a = 2 * math.pi * k / 5
            m.cyl(hx + 0.22 * math.cos(a), hz + 0.22 * math.sin(a), 0.07, 0.0, y + 0.004, 'brick', seg=8)
    # The plate by the ring's south side, set in the paving.
    m.box(-0.35, 0.35, 0.0, y + 0.004, 2.15, 2.6, 'rust')
    m.box(-0.3, 0.3, y + 0.004, y + 0.006, 2.2, 2.55, 'fabric-amber')
    return m


def lookout():
    """What the Hebi lookout keeps at his post by the hatch (his feet at the origin, facing +z): the drinks crate he
    sits on behind him, butts round it and on the hatch's grate side, a can, a cheap radio with its aerial out on the
    crate (1.2 x 0.6 x 1.0)."""
    m = Model('rd-t2-lookout')
    cx, cz = 0.15, -0.65
    m.box(cx - 0.2, cx + 0.2, 0.0, 0.3, cz - 0.15, cz + 0.15, 'neon-red', bevel=0.01)
    m.box(cx - 0.17, cx + 0.17, 0.05, 0.3, cz - 0.12, cz + 0.12, 'dark')
    for k in range(3):
        x = cx - 0.12 + k * 0.12
        m.box(x - 0.005, x + 0.005, 0.06, 0.3, cz - 0.12, cz + 0.12, 'neon-red')
    m.box(cx - 0.12, cx + 0.06, 0.3, 0.38, cz - 0.05, cz + 0.05, 'dark', bevel=0.01)
    m.cyl(cx - 0.08, cz, 0.022, 0.32, 0.39, 'metal', seg=8)
    m.tube((cx + 0.04, 0.38, cz - 0.03), (cx + 0.1, 0.62, cz - 0.08), 0.004, 'metal', seg=5)
    m.box(cx + 0.065, cx + 0.07, 0.3, 0.37, cz + 0.051, cz + 0.053, 'neon-green')
    m.cyl(cx + 0.35, cz + 0.1, 0.033, 0.0, 0.12, 'neon-cyan', seg=12)
    for k in range(11):
        a = hashf(k, 4.0) * math.pi
        x = -0.45 + 0.95 * hashf(k, 5.0)
        z = -0.9 + 0.75 * hashf(k, 6.0)
        m.tube((x, 0.006, z), (x + 0.032 * math.cos(a), 0.006, z + 0.032 * math.sin(a)), 0.0045, 'win-white' if k % 3 else 'fabric-amber', seg=5)
    return m


def hebi_litter():
    """What the Hebi group leaves where it stands under the arcades (the ring's middle at the origin): butts, two beer
    bottles standing and one lying, a crushed can, a vape's empty pod (1.8 x 0.25 x 1.8)."""
    m = Model('rd-t2-hebi')
    for k in range(16):
        a = hashf(k, 7.0) * math.pi
        r = 1.6 * hashf(k, 8.0) ** 0.5
        t = 2 * math.pi * hashf(k, 9.0)
        x, z = r * math.cos(t), r * math.sin(t)
        m.tube((x, 0.006, z), (x + 0.032 * math.cos(a), 0.006, z + 0.032 * math.sin(a)), 0.0045, 'win-white' if k % 3 else 'fabric-amber', seg=5)
    for k, (x, z) in enumerate(((0.35, -0.2), (0.45, -0.05))):
        m.lathe(x, z, [(0.0, 0.0), (0.03, 0.0), (0.032, 0.15), (0.012, 0.2), (0.012, 0.24), (0.0, 0.24)], 'glass-dark', seg=10, y0=0.0)
    m.tube((-0.3, 0.03, 0.4), (-0.08, 0.03, 0.48), 0.03, 'glass-dark', seg=10)
    m.tube((-0.5, 0.025, -0.35), (-0.4, 0.025, -0.3), 0.03, 'paint', seg=10)
    m.box(0.1, 0.13, 0.0, 0.012, 0.55, 0.6, 'neon-pink')
    return m


MODELS = [tribute, settlement, lookout, hebi_litter]
