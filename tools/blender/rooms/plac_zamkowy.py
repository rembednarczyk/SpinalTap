"""Plac Zamkowy's flea market after the scene's card (`docs/lokacje/plac-zamkowy.md`, ADR-0102 point 5, ADR-0098):
what each of the market's stalls spreads before it and hangs over it (a blanket of electronics and implants, a string
of bulbs between its front posts, what the day leaves round it), and the green lamp at the metro pavilion's opening.

Sizes from the simulation (`packages/sim/src/content/lublin/furniture.ts`): a stall's counter is 2.1 m wide on its front
(+z) side, its four posts 2.3 m high at x ±1, z ±0.7. Each model's foot is on y = 0, its front to +z. Variations from
`hashf`, so the same script gives the same file. Comic realism (`docs/zasady-lokacji.md` §9): a real festoon of
bulbs on its cable, a real moving blanket with its goods laid out in rows.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-zamkowy-props.glb'


def stall():
    """Before and over a stall (its middle at the origin, its counter on the +z side): the festoon between its front
    posts with its warm bulbs, sagging; a moving blanket 1.6 x 1 m before the counter with phones, earpieces, a
    cyber eye in its case, a hand's prosthetic, cables in coils, a cardboard price sign; butts and a cup round it
    (2.4 x 2.3 x 2.4)."""
    m = Model('rd-pz-stall')
    pts = []
    for k in range(11):
        t = k / 10
        x = -1.0 + 2.0 * t
        y = 2.27 - 0.22 * math.sin(math.pi * t)
        pts.append((x, y, 0.72))
    for a, b in zip(pts, pts[1:]):
        m.tube(a, b, 0.005, 'cable', seg=5)
    for k in range(1, 10):
        x, y, z = pts[k]
        m.tube((x, y, z), (x, y - 0.06, z), 0.003, 'dark', seg=4)
        m.lathe(x, z, [(0.0, 0.0), (0.025, 0.01), (0.03, 0.04), (0.012, 0.07), (0.0, 0.07)], 'win-warm', seg=8, y0=y - 0.13)
    z0, z1 = 1.25, 2.25
    m.box(-0.8, 0.8, 0.0, 0.012, z0, z1, 'fabric-teal')
    for k in range(10):
        x = -0.7 + (k % 5) * 0.3
        z = z0 + 0.2 + (k // 5) * 0.35
        role = ('dark', 'glass-blue', 'trim', 'dark', 'neon-cyan')[k % 5]
        m.box(x, x + 0.08, 0.012, 0.024, z, z + 0.14, role, bevel=0.004)
        if k % 5 == 1:
            m.box(x + 0.005, x + 0.075, 0.024, 0.026, z + 0.01, z + 0.13, 'neon-cyan')
    m.box(0.35, 0.55, 0.012, 0.08, z0 + 0.65, z0 + 0.85, 'dark', bevel=0.01)
    m.lathe(0.45, z0 + 0.75, [(0.0, 0.0), (0.035, 0.0), (0.04, 0.03), (0.0, 0.06)], 'trim-light', seg=12, y0=0.08)
    m.lathe(0.45, z0 + 0.75, [(0.0, 0.0), (0.018, 0.0), (0.0, 0.003)], 'neon-red', seg=8, y0=0.135)
    m.box(-0.75, -0.45, 0.012, 0.05, z0 + 0.7, z0 + 0.9, 'metal', bevel=0.01)
    for k in range(4):
        m.box(-0.45 + k * 0.03, -0.43 + k * 0.03, 0.02, 0.045, z0 + 0.72 + 0.04 * k, z0 + 0.76 + 0.04 * k, 'metal')
    for k in range(10):
        a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
        m.tube((0.0 + 0.1 * math.cos(a0), 0.02, z0 + 0.8 + 0.1 * math.sin(a0)), (0.1 * math.cos(a1), 0.02, z0 + 0.8 + 0.1 * math.sin(a1)), 0.008, 'cable', seg=4)
    m.obox((0.0, 0.18, z1 + 0.05), (1, 0, 0), (0, 0.95, -0.3), (0.2, 0.15, 0.004), 'sign-back')
    m.obox((0.0, 0.19, z1 + 0.055), (1, 0, 0), (0, 0.95, -0.3), (0.15, 0.08, 0.001), 'win-white')
    for k in range(9):
        a = hashf(k, 1.0) * math.pi
        x = -1.2 + 2.4 * hashf(k, 2.0)
        z = 0.9 + 1.4 * hashf(k, 3.0)
        if -0.85 < x < 0.85 and z0 < z < z1:
            continue
        m.tube((x, 0.006, z), (x + 0.032 * math.cos(a), 0.006, z + 0.032 * math.sin(a)), 0.0045, 'win-white' if k % 3 else 'fabric-amber', seg=5)
    m.lathe(1.0, 1.6, [(0.0, 0.0), (0.03, 0.0), (0.04, 0.1), (0.0, 0.1)], 'trim-light', seg=10, y0=0.0)
    return m


def metro_lamp():
    """At the metro pavilion's opening (the wall at z 0): a caged bulkhead lamp with a green lens over the way down,
    its conduit up the wall (0.3 x 1.0 x 0.2)."""
    m = Model('rd-pz-metro-lamp')
    m.box(-0.13, 0.13, 2.5, 2.72, 0.0, 0.08, 'dark', bevel=0.01)
    m.box(-0.1, 0.1, 2.53, 2.69, 0.08, 0.12, 'neon-green', bevel=0.01)
    for x in (-0.07, 0.0, 0.07):
        m.box(x - 0.006, x + 0.006, 2.52, 2.7, 0.12, 0.135, 'metal')
    m.box(-0.012, 0.012, 2.72, 3.5, 0.02, 0.045, 'metal')
    return m


MODELS = [stall, metro_lamp]
