"""Plac Katedralny after the scene's card (`docs/lokacje/plac-katedralny.md`, ADR-0102 point 5, ADR-0098): the LED grave
candles, flowers and intention cards at the foot of the Wyszyński monument; the AR legend terminal by the Executioner's
Stone (Głaz Katowski).

Each model's foot is on y = 0, its front to +z. Variations from `hashf`, so the same script gives the same file. Comic
realism (`docs/zasady-lokacji.md` §9): real glass grave candles with their LED inserts, real cut flowers in cellophane,
a real slim kiosk terminal on its foot.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-katedralny-props.glb'


def candles():
    """At a monument's foot (the plinth's face at z 0): two rows of grave candles in coloured glass, their LED flames,
    bunches of flowers in cellophane leaning on the plinth, folded intention cards under a stone (1.8 x 0.5 x 0.7)."""
    m = Model('rd-kat-candles')
    for k in range(11):
        x = -0.8 + 0.16 * k + 0.03 * hashf(k, 1.0)
        z = 0.12 + (0.18 if k % 2 else 0.0)
        role = ('neon-red', 'glass-blue', 'neon-red', 'trim-light')[k % 4]
        h = 0.1 + 0.06 * hashf(k, 2.0)
        m.lathe(x, z, [(0.0, 0.0), (0.035, 0.0), (0.04, h * 0.8), (0.03, h), (0.0, h)], role, seg=10, y0=0.0)
        m.lathe(x, z, [(0.0, 0.0), (0.03, 0.0), (0.025, 0.02), (0.0, 0.025)], 'metal', seg=8, y0=h)
        if k % 3 != 2:
            m.lathe(x, z, [(0.0, 0.0), (0.008, 0.008), (0.005, 0.025), (0.0, 0.035)], 'neon-amber', seg=6, y0=h * 0.5)
    for k, x in enumerate((-0.55, 0.1, 0.6)):
        m.obox((x, 0.3, 0.05), (1, 0, 0), (0, 0.9, 0.44), (0.07, 0.3, 0.03), 'glass-blue')
        for j in range(5):
            a = 2 * math.pi * j / 5
            m.lathe(x + 0.04 * math.cos(a), 0.18 + 0.03 * math.sin(a), [(0.0, 0.0), (0.025, 0.01), (0.0, 0.035)], ('neon-red', 'trim-light', 'fabric-amber')[k], seg=6, y0=0.52 + 0.03 * hashf(j, k))
    for k in range(4):
        x = -0.2 + k * 0.12
        m.obox((x, 0.01, 0.48), (math.cos(k * 0.4), 0, math.sin(k * 0.4)), (0, 1, 0), (0.05, 0.004, 0.035), 'win-white')
    m.lathe(0.0, 0.5, [(0.0, 0.0), (0.06, 0.0), (0.05, 0.03), (0.0, 0.04)], 'trim', seg=8, y0=0.0)
    return m


def terminal():
    """The AR legend terminal (0.4 x 1.5 x 0.3): its cast foot, its slim body in dark enamel, the screen tilted up
    lit cyan with the stone's legend, the city's arms in brass over it, a scanner for the visitor's lens (0.5 x 1.6 x 0.5)."""
    m = Model('rd-kat-terminal')
    m.box(-0.25, 0.25, 0.0, 0.05, -0.2, 0.2, 'dark', bevel=0.01)
    m.box(-0.16, 0.16, 0.05, 1.3, -0.1, 0.1, 'dark', bevel=0.02)
    m.obox((0.0, 1.15, 0.12), (1, 0, 0), (0, 0.87, -0.5), (0.15, 0.13, 0.02), 'dark')
    m.obox((0.0, 1.155, 0.135), (1, 0, 0), (0, 0.87, -0.5), (0.13, 0.11, 0.003), 'neon-cyan')
    m.lathe(0.0, 0.101, [(0.0, 0.0), (0.06, 0.0), (0.0, 0.01)], 'fabric-amber', seg=10, y0=1.38)
    m.box(-0.06, 0.06, 1.33, 1.45, 0.1, 0.11, 'fabric-amber')
    m.cyl(0.1, 0.101, 0.02, 0.95, 0.97, 'neon-green', seg=8)
    return m


MODELS = [candles, terminal]
