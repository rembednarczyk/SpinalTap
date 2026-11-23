"""Grodzka under the covered footbridge after the scene's card (`docs/lokacje/grodzka-kladka.md`, ADR-0102 point 5,
ADR-0098): the Hebi traders' table of beer crates and a plank with the chips in their trays, the cash tin and the reader;
what they leave where they stand; the footbridge's downpipe on the house at its west end, its spout over a puddle.

Each model's foot is on y = 0 where it stands (the street, a wall's foot), its front to +z (out of the wall). Variations
from `hashf`, so the same script gives the same file. Comic realism (`docs/zasady-lokacji.md` §9): real plastic beer
crates, a real zinc downpipe with its clips and shoe.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-grodzka-props.glb'


def chips():
    """The traders' table against the wall (its middle at the origin, the wall behind it at z -0.45): two stacks of
    beer crates and a plank over them, the chips in two trays under a sheet of plastic, a cash tin open, a card reader
    with its green light, two energy cans, a phone face down, a lamp clamped to the plank (1.5 x 1.2 x 0.6)."""
    m = Model('rd-gr-chips')
    for x in (-0.55, 0.55):
        for k in range(2):
            y0 = k * 0.3
            m.box(x - 0.2, x + 0.2, y0, y0 + 0.29, -0.15, 0.15, 'neon-red' if k == 0 else 'fabric-teal', bevel=0.01)
            m.box(x - 0.17, x + 0.17, y0 + 0.03, y0 + 0.29, -0.12, 0.12, 'dark')
    m.box(-0.78, 0.78, 0.6, 0.64, -0.25, 0.25, 'door', bevel=0.005)
    for k, x in enumerate((-0.4, 0.05)):
        m.box(x, x + 0.32, 0.64, 0.67, -0.18, 0.12, 'dark')
        for j in range(12):
            cx = x + 0.03 + (j % 6) * 0.05
            cz = -0.14 + (j // 6) * 0.13
            m.box(cx, cx + 0.03, 0.67, 0.675, cz, cz + 0.1, 'neon-green' if (j + k) % 4 else 'neon-cyan')
        m.box(x - 0.01, x + 0.33, 0.68, 0.682, -0.19, 0.13, 'glass-blue')
    m.box(0.45, 0.7, 0.64, 0.72, -0.2, -0.02, 'metal', bevel=0.005)
    m.box(0.47, 0.68, 0.72, 0.725, -0.18, -0.04, 'fabric-amber')
    m.box(0.45, 0.7, 0.72, 0.9, -0.21, -0.2, 'metal')
    m.box(0.5, 0.58, 0.64, 0.66, 0.05, 0.18, 'dark', bevel=0.004)
    m.box(0.52, 0.56, 0.66, 0.662, 0.13, 0.16, 'neon-green')
    for k, x in enumerate((-0.6, -0.52)):
        m.cyl(x, 0.12 + 0.04 * k, 0.033, 0.64, 0.76, 'neon-cyan' if k else 'neon-pink', seg=12)
    m.box(-0.2, -0.12, 0.64, 0.65, 0.12, 0.24, 'dark')
    m.tube((-0.75, 0.64, -0.2), (-0.72, 1.05, -0.22), 0.01, 'metal', seg=6)
    m.tube((-0.72, 1.05, -0.22), (-0.45, 1.15, -0.05), 0.01, 'metal', seg=6)
    m.lathe(-0.45, -0.05, [(0.0, 0.0), (0.06, 0.0), (0.045, 0.06), (0.0, 0.065)], 'trim', seg=12, y0=1.08)
    m.lathe(-0.45, -0.05, [(0.0, 0.0), (0.05, 0.0), (0.0, 0.004)], 'win-white', seg=12, y0=1.076)
    return m


def litter():
    """Where the Hebi traders stand (the ring's middle at the origin): butts, cans, a crushed energy can, a chip's empty
    blister, a broken bottle's neck (2.4 x 0.25 x 2.4)."""
    m = Model('rd-gr-litter')
    for k in range(18):
        a = hashf(k, 1.0) * math.pi
        r = 1.6 * hashf(k, 2.0) ** 0.5
        t = 2 * math.pi * hashf(k, 3.0)
        x, z = r * math.cos(t), r * math.sin(t)
        m.tube((x, 0.006, z), (x + 0.032 * math.cos(a), 0.006, z + 0.032 * math.sin(a)), 0.0045, 'win-white' if k % 3 else 'fabric-amber', seg=5)
    m.cyl(0.6, -0.4, 0.033, 0.0, 0.12, 'neon-cyan', seg=12)
    m.tube((-0.5, 0.025, 0.6), (-0.4, 0.025, 0.66), 0.03, 'neon-pink', seg=10)
    m.box(0.2, 0.26, 0.0, 0.006, 0.8, 0.9, 'glass-blue')
    m.lathe(-0.9, -0.3, [(0.0, 0.0), (0.014, 0.0), (0.016, 0.06), (0.03, 0.1), (0.0, 0.1)], 'glass-dark', seg=8, y0=0.0)
    return m


def downpipe():
    """The footbridge's downpipe on the house at its west end (the wall at z 0): from the bridge's gutter at 4.6 m down
    the wall in its clips, its shoe over the street, the stain the water left on the render and the puddle under it
    (0.6 x 4.8 x 0.9)."""
    m = Model('rd-gr-downpipe')
    r = 0.05
    m.box(-0.25, 0.25, 4.6, 4.75, 0.0, 0.3, 'metal')
    m.tube((0.0, 4.6, 0.25), (0.0, 4.3, 0.12), r, 'metal', seg=10)
    m.tube((0.0, 4.3, 0.12), (0.0, 0.35, 0.12), r, 'metal', seg=10)
    for y in (0.9, 2.0, 3.1, 4.1):
        m.box(-0.07, 0.07, y, y + 0.04, 0.0, 0.17, 'dark')
    m.tube((0.0, 0.35, 0.12), (0.0, 0.12, 0.38), r, 'metal', seg=10)
    m.box(-0.18, 0.18, 0.4, 4.3, 0.0, 0.004, 'rust')
    m.box(-0.12, 0.12, 0.0, 0.03, 0.42, 0.52, 'dark')
    m.quad([(-0.3, 0.004, 0.3), (0.32, 0.004, 0.28), (0.36, 0.004, 0.9), (-0.25, 0.004, 0.86)], 'glass-blue')
    return m


MODELS = [chips, litter, downpipe]
