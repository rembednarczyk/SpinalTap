"""The deptak of Krakowskie Przedmieście in M0 after the scene's card (`docs/lokacje/deptak-krakowskie.md`, ADR-0102
point 5, ADR-0098): the street counter on Neon Koi's front where the night drinker of the contract stands, with two
stools; what the bar's door has round it; RAMEN's door; the gate Babcia Ume sleeps in, with her broom and bucket.

Each model's foot is on y = 0 at a front's foot (the wall at z 0, the deptak at +z). Variations from `hashf`, so the
same script gives the same file. Comic realism (`docs/zasady-lokacji.md` §9): a real stand-up counter bolted to a
front, real bar stools, a real birch broom and a zinc bucket.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-deptak-props.glb'

TOP = 1.08


def _butts(m, n, x0, x1, z0, z1, seed):
    for k in range(n):
        a = hashf(k, seed) * math.pi
        x = x0 + (x1 - x0) * hashf(k, seed + 1.0)
        z = z0 + (z1 - z0) * hashf(k, seed + 2.0) ** 2
        m.tube((x, 0.006, z), (x + 0.032 * math.cos(a), 0.006, z + 0.032 * math.sin(a)), 0.0045, 'win-white' if k % 3 else 'fabric-amber', seg=5)


def bar():
    """The stand-up counter on Neon Koi's front (1.8 x 0.35 m, its top 1.08 m, its middle at x 0): its steel brackets,
    the wood top with a ring of glasses' wet marks, two empty glasses and an ashtray, two bar stools before it, a foot
    rail under it; the butts round its feet (1.8 x 1.1 x 1.0)."""
    m = Model('rd-dp-bar')
    m.box(-0.9, 0.9, TOP - 0.05, TOP, 0.0, 0.35, 'door', bevel=0.008)
    for x in (-0.75, 0.0, 0.75):
        m.box(x - 0.02, x + 0.02, TOP - 0.3, TOP - 0.05, 0.0, 0.3, 'metal')
        m.tube((x, TOP - 0.3, 0.02), (x, TOP - 0.06, 0.28), 0.012, 'metal', seg=6)
    m.tube((-0.85, 0.22, 0.25), (0.85, 0.22, 0.25), 0.02, 'metal', seg=8)
    for x in (-0.85, 0.85):
        m.tube((x, 0.0, 0.25), (x, 0.22, 0.25), 0.02, 'metal', seg=8)
    for k, x in enumerate((-0.5, 0.2)):
        m.lathe(x, 0.18, [(0.0, 0.0), (0.035, 0.0), (0.04, 0.13), (0.0, 0.13)], 'glass-blue', seg=12, y0=TOP)
        m.lathe(x + 0.12, 0.2, [(0.0, 0.0), (0.045, 0.0), (0.045, 0.002), (0.0, 0.002)], 'glass-dark', seg=12, y0=TOP)
    m.lathe(0.6, 0.18, [(0.0, 0.0), (0.06, 0.0), (0.06, 0.025), (0.045, 0.02), (0.0, 0.02)], 'metal', seg=12, y0=TOP)
    _butts(m, 3, 0.55, 0.65, 0.12, 0.24, 7.0)
    for x in (-0.45, 0.45):
        z = 0.75
        m.cyl(x, z, 0.03, 0.0, 0.75, 'metal', seg=8)
        m.lathe(x, z, [(0.0, 0.0), (0.18, 0.0), (0.19, 0.02), (0.0, 0.03)], 'dark', seg=14, y0=0.0)
        m.tube((x - 0.13, 0.3, z), (x + 0.13, 0.3, z), 0.01, 'metal', seg=6)
        m.lathe(x, z, [(0.0, 0.0), (0.17, 0.0), (0.18, 0.04), (0.16, 0.07), (0.0, 0.075)], 'fabric-magenta', seg=14, y0=0.75)
    _butts(m, 9, -0.9, 0.9, 0.05, 1.0, 1.0)
    return m


def koi_door():
    """By Neon Koi's door (the wall at z 0): a crate of empties waiting for the brewery, the chalk board of tonight's
    menu, butts in the joint and a coaster dropped flat (1.2 x 1.1 x 0.7)."""
    m = Model('rd-dp-koi-door')
    m.box(-0.5, -0.1, 0.0, 0.28, 0.05, 0.33, 'fabric-teal', bevel=0.01)
    for k in range(6):
        x = -0.44 + (k % 3) * 0.13
        z = 0.11 + (k // 3) * 0.13
        m.lathe(x, z, [(0.0, 0.0), (0.03, 0.0), (0.032, 0.2), (0.012, 0.26), (0.0, 0.26)], 'glass-dark', seg=8, y0=0.04)
    for s in (-1, 1):
        m.obox((0.35, 0.5, 0.35 + s * 0.11), (1, 0, 0), (0, 0.97, -s * 0.24), (0.25, 0.5, 0.012), 'door')
        m.obox((0.35, 0.53, 0.35 + s * 0.123), (1, 0, 0), (0, 0.97, -s * 0.24), (0.21, 0.42, 0.002), 'dark')
    for k in range(5):
        w = 0.1 + 0.18 * hashf(k, 9.0)
        m.obox((0.2 + w / 2, 0.8 - k * 0.11, 0.226), (1, 0, 0), (0, 0.97, 0.24), (w / 2, 0.012, 0.001), 'neon-amber' if k == 0 else 'win-white')
    _butts(m, 8, -0.6, 0.6, 0.02, 0.6, 3.0)
    m.cyl(-0.05, 0.55, 0.05, 0.0, 0.004, 'neon-red', seg=12)
    return m


def ramen():
    """At RAMEN's door (the wall at z 0): a stack of crates of spring onions, a gas bottle chained to the wall, the
    stock pot's lid leaning on it, a bowl with a cat's food (1.1 x 1.2 x 0.6)."""
    m = Model('rd-dp-ramen')
    for k in range(2):
        y0 = k * 0.22
        m.box(-0.5, -0.1, y0, y0 + 0.21, 0.05, 0.4, 'trim', bevel=0.01)
        for j in range(6):
            x = -0.46 + j * 0.06
            m.tube((x, y0 + 0.2, 0.1), (x + 0.01, y0 + 0.32, 0.35), 0.012, 'plant', seg=5)
    m.lathe(0.25, 0.22, [(0.0, 0.0), (0.14, 0.0), (0.15, 0.05), (0.15, 0.85), (0.08, 0.95), (0.04, 1.05), (0.0, 1.05)], 'neon-red', seg=14, y0=0.0)
    m.tube((0.1, 0.7, 0.0), (0.4, 0.7, 0.0), 0.006, 'metal', seg=5)
    m.obox((0.48, 0.25, 0.1), (0, 0, 1), (0.25, 0.97, 0), (0.24, 0.24, 0.01), 'metal')
    m.lathe(0.0, 0.5, [(0.0, 0.0), (0.06, 0.0), (0.08, 0.04), (0.0, 0.035)], 'trim-light', seg=12, y0=0.0)
    m.lathe(0.0, 0.5, [(0.0, 0.0), (0.06, 0.0), (0.0, 0.006)], 'rust', seg=10, y0=0.03)
    return m


def ume():
    """The gate Babcia Ume sleeps in from eleven (the wall at z 0): her birch broom leaning on the wall, the zinc
    bucket, a folded blanket on a flattened carton, her cup and a plastic bag of her things (1.3 x 1.4 x 0.8)."""
    m = Model('rd-dp-ume')
    m.tube((-0.5, 0.0, 0.25), (-0.42, 1.35, 0.03), 0.014, 'door', seg=8)
    for k in range(14):
        a = 2 * math.pi * k / 14
        m.tube((-0.5, 0.25, 0.25), (-0.5 + 0.09 * math.cos(a), 0.0, 0.25 + 0.05 * math.sin(a) + 0.04), 0.006, 'fabric-amber', seg=4)
    m.tube((-0.52, 0.18, 0.25), (-0.48, 0.18, 0.25), 0.05, 'metal', seg=10)
    m.lathe(-0.2, 0.3, [(0.0, 0.0), (0.12, 0.0), (0.15, 0.28), (0.14, 0.3), (0.0, 0.29)], 'metal', seg=14, y0=0.0)
    m.tube((-0.34, 0.3, 0.3), (-0.2, 0.42, 0.3), 0.004, 'metal', seg=4)
    m.tube((-0.2, 0.42, 0.3), (-0.06, 0.3, 0.3), 0.004, 'metal', seg=4)
    m.box(0.0, 0.6, 0.0, 0.01, 0.02, 0.75, 'trim')
    m.box(0.05, 0.55, 0.01, 0.14, 0.08, 0.5, 'fabric-teal', bevel=0.03)
    m.box(0.05, 0.55, 0.14, 0.16, 0.1, 0.48, 'fabric-magenta', bevel=0.02)
    m.lathe(0.45, 0.62, [(0.0, 0.0), (0.035, 0.0), (0.04, 0.09), (0.0, 0.09)], 'trim-light', seg=10, y0=0.01)
    m.lathe(0.2, 0.62, [(0.0, 0.0), (0.12, 0.0), (0.1, 0.2), (0.06, 0.25), (0.0, 0.25)], 'win-white', seg=10, y0=0.01)
    return m


MODELS = [bar, koi_door, ramen, ume]
