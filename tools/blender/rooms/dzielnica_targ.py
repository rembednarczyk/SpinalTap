"""Podzamcze's food markets after the district's card (`docs/lokacje/dzielnica-targ.md`, „Dług sceny” point 1; ADR-0102
point 5, ADR-0098): the string of warm bulbs over each stall of the Bazaar and of Targ na Ruskiej, the light of trade
(§13 of `docs/zasady-lokacji.md`: the game's light in it, no light from nowhere), with the stall's cardboard price tag
hung from it; and the bare bulb by each Hebi group (ADR-0091) on a bracket on the wall or on a pole in a bucket of
concrete, the street's own makeshift light where the group stands.

Sizes from the simulation (`packages/sim/src/content/lublin/furniture.ts`): a stall's counter is 2.1 m wide on its front
(+z) side, its four posts 2.3 m high at x ±1, z ±0.7. Each model's foot is on y = 0, its front to +z. Variations from
`hashf`, so the same script gives the same file. Comic realism (`docs/zasady-lokacji.md` §9): a real festoon of bulbs
on its cable between the posts, a real hand-written cardboard tag on a string.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-targ-props.glb'


def festoon():
    """Over a food stall (its middle at the origin, its counter on the +z side): the festoon between its front posts,
    sagging, its nine warm bulbs on their drops, and a cardboard price tag on a string from its middle
    (2.0 x 0.5 x 0.1)."""
    m = Model('rd-targ-festoon')
    pts = []
    for k in range(11):
        t = k / 10
        x = -1.0 + 2.0 * t
        y = 2.27 - 0.2 * math.sin(math.pi * t)
        pts.append((x, y, 0.72))
    for a, b in zip(pts, pts[1:]):
        m.tube(a, b, 0.005, 'cable', seg=5)
    for k in range(1, 10):
        x, y, z = pts[k]
        drop = 0.05 + 0.02 * hashf(k, 1.0)
        m.tube((x, y, z), (x, y - drop, z), 0.003, 'dark', seg=4)
        m.lathe(x, z, [(0.0, 0.0), (0.025, 0.01), (0.03, 0.04), (0.012, 0.07), (0.0, 0.07)], 'win-warm', seg=8, y0=y - drop - 0.07)
    # The tag on its string from the cable's middle, turned a little in the draught.
    x, y, z = pts[5]
    m.tube((x + 0.12, y, z), (x + 0.12, y - 0.18, z), 0.002, 'dark', seg=4)
    a = (hashf(2, 3.0) - 0.5) * 0.4
    m.obox((x + 0.12, y - 0.27, z), (math.cos(a), 0, math.sin(a)), (0, 1, 0), (0.09, 0.07, 0.003), 'sign-back')
    m.obox((x + 0.12, y - 0.27, z + 0.004), (math.cos(a), 0, math.sin(a)), (0, 1, 0), (0.07, 0.04, 0.001), 'win-white')
    return m


def bulb_wall():
    """On a wall (its face at z 0): a bent steel bracket out 0.35 m with a bare bulb hanging from its end on its
    socket, its cable up the wall in a conduit, tied off on a nail (0.2 x 1.0 x 0.4)."""
    m = Model('rd-targ-bulb-wall')
    m.box(-0.06, 0.06, 2.84, 2.96, 0.0, 0.012, 'metal', bevel=0.004)
    m.tube((0.0, 2.9, 0.01), (0.0, 2.9, 0.3), 0.012, 'metal', seg=6)
    m.tube((0.0, 2.9, 0.3), (0.0, 2.86, 0.36), 0.012, 'metal', seg=6)
    m.tube((0.0, 2.86, 0.36), (0.0, 2.8, 0.36), 0.004, 'cable', seg=4)
    m.cyl(0.0, 0.36, 0.016, 2.76, 2.8, 'dark', seg=8)
    m.lathe(0.0, 0.36, [(0.0, 0.0), (0.012, 0.005), (0.032, 0.03), (0.028, 0.055), (0.012, 0.07), (0.0, 0.072)], 'win-warm', seg=10, y0=2.69)
    m.tube((0.0, 2.96, 0.01), (0.0, 3.6, 0.01), 0.006, 'cable', seg=4)
    m.tube((0.04, 3.3, 0.005), (0.04, 3.3, 0.03), 0.003, 'metal', seg=4)
    return m


def bulb_pole():
    """Standing on the paving (the pole at the origin, its arm to +z): a builder's bucket of concrete, a steel pole
    2.7 m up it, an arm 0.5 m out with a bare bulb hanging in a wire cage, its cable down the pole to the ground
    and away (0.6 x 2.8 x 1.2)."""
    m = Model('rd-targ-bulb-pole')
    m.lathe(0.0, 0.0, [(0.0, 0.0), (0.15, 0.0), (0.18, 0.36), (0.0, 0.36)], 'dark', seg=12, y0=0.0)
    m.cyl(0.0, 0.0, 0.17, 0.33, 0.345, 'concrete', seg=12)
    m.cyl(0.0, 0.0, 0.022, 0.34, 2.7, 'metal', seg=8)
    m.tube((0.0, 2.68, 0.0), (0.0, 2.68, 0.5), 0.014, 'metal', seg=6)
    m.tube((0.0, 2.68, 0.5), (0.0, 2.6, 0.5), 0.004, 'cable', seg=4)
    m.cyl(0.0, 0.5, 0.016, 2.56, 2.6, 'dark', seg=8)
    m.lathe(0.0, 0.5, [(0.0, 0.0), (0.012, 0.005), (0.032, 0.03), (0.028, 0.055), (0.012, 0.07), (0.0, 0.072)], 'win-warm', seg=10, y0=2.49)
    for k in range(6):
        a = 2 * math.pi * k / 6
        m.tube((0.04 * math.cos(a), 2.58, 0.5 + 0.04 * math.sin(a)), (0.045 * math.cos(a), 2.47, 0.5 + 0.045 * math.sin(a)), 0.002, 'metal', seg=3)
    m.tube((0.025, 2.65, 0.0), (0.025, 0.36, 0.0), 0.005, 'cable', seg=4)
    m.tube((0.025, 0.36, 0.0), (0.2, 0.01, -0.5), 0.005, 'cable', seg=4)
    m.tube((0.2, 0.01, -0.5), (0.25, 0.01, -1.2), 0.005, 'cable', seg=4)
    return m


MODELS = [festoon, bulb_wall, bulb_pole]
