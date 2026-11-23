"""The bus station after the scene's card (`docs/lokacje/dworzec-autobusowy.md`, ADR-0102 point 5, ADR-0098): Kiku the
fortune teller's folding table by the metro pavilion B, where she reads palms at night (`enc_targ_fortune`).

Its foot is on y = 0, its front to +z (where the client sits). Variations from `hashf`, so the same script gives the
same file. Comic realism (`docs/zasady-lokacji.md` §9): a real card table with its cloth, a real tarot spread, a real
glass candle holder and two real folding stools.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-dworzec-props.glb'

TOP = 0.72


def kiku():
    """Kiku's table (0.8 x 0.6 m): its folding legs, a fringed purple cloth to the ground, a spread of cards face up
    in a cross, the deck, a candle in a red glass, a cracked crystal ball on its stand, a tin for coins and a chip
    reader beside it; her stool behind, the client's before (1.4 x 1.0 x 1.8)."""
    m = Model('rd-dw-kiku')
    for x in (-0.35, 0.35):
        for z in (-0.25, 0.25):
            m.tube((x, 0.0, z), (x * 0.9, TOP - 0.02, z * 0.9), 0.012, 'metal', seg=6)
    m.box(-0.42, 0.42, TOP - 0.02, TOP, -0.32, 0.32, 'fabric-magenta', bevel=0.005)
    for s in (-1, 1):
        m.box(-0.42, 0.42, 0.12, TOP - 0.01, s * 0.32 - 0.004, s * 0.32 + 0.004, 'fabric-magenta')
        m.box(s * 0.42 - 0.004, s * 0.42 + 0.004, 0.12, TOP - 0.01, -0.32, 0.32, 'fabric-magenta')
    for k in range(24):
        x = -0.42 + k * 0.0365
        m.box(x, x + 0.006, 0.06, 0.12, 0.316, 0.324, 'fabric-amber')
    cards = [(0.0, 0.05, 0.0), (0.0, 0.05, 0.4), (-0.11, 0.05, 0.0), (0.11, 0.05, 0.0), (0.0, -0.11, 0.0), (0.0, 0.21, 0.0)]
    for k, (x, z, a) in enumerate(cards):
        m.obox((x, TOP + 0.002 + 0.001 * k, z), (math.cos(a), 0, math.sin(a)), (0, 1, 0), (0.035, 0.001, 0.06), 'trim-light')
        m.obox((x, TOP + 0.0035 + 0.001 * k, z), (math.cos(a), 0, math.sin(a)), (0, 1, 0), (0.025, 0.0005, 0.045), 'neon-violet' if k % 2 else 'fabric-amber')
    m.box(0.22, 0.29, TOP, TOP + 0.04, -0.2, -0.08, 'dark', bevel=0.003)
    m.lathe(-0.28, -0.18, [(0.0, 0.0), (0.035, 0.0), (0.04, 0.09), (0.0, 0.09)], 'neon-red', seg=12, y0=TOP)
    m.lathe(-0.28, -0.18, [(0.0, 0.0), (0.008, 0.01), (0.005, 0.03), (0.0, 0.04)], 'neon-amber', seg=6, y0=TOP + 0.08)
    m.lathe(0.28, 0.12, [(0.0, 0.0), (0.05, 0.0), (0.03, 0.03), (0.0, 0.03)], 'dark', seg=12, y0=TOP)
    m.lathe(0.28, 0.12, [(0.0, 0.0), (0.06, 0.01), (0.075, 0.08), (0.06, 0.14), (0.0, 0.155)], 'glass-blue', seg=16, y0=TOP + 0.03)
    m.tube((0.25, TOP + 0.08, 0.12), (0.31, TOP + 0.13, 0.12), 0.002, 'win-white', seg=4)
    m.cyl(-0.3, 0.2, 0.05, TOP, TOP + 0.03, 'metal', seg=12)
    m.box(-0.18, -0.12, TOP, TOP + 0.015, 0.18, 0.28, 'dark')
    m.box(-0.17, -0.13, TOP + 0.015, TOP + 0.017, 0.25, 0.27, 'neon-green')
    for z, role in ((-0.75, 'dark'), (0.75, 'fabric-teal')):
        for x in (-0.15, 0.15):
            m.tube((x, 0.0, z - 0.12), (-x, 0.45, z + 0.12), 0.01, 'metal', seg=5)
        m.box(-0.18, 0.18, 0.45, 0.48, z - 0.15, z + 0.15, role)
    return m


MODELS = [kiku]
