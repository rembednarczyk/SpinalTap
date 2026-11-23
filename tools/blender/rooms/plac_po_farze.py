"""Plac po Farze after the scene's card (`docs/lokacje/plac-po-farze.md`, ADR-0102 point 5, ADR-0098): the coin-op
viewing telescope on the square's east side looking over the escarpment to the Castle, its paid AR screen lit, its
column stickered, a paper cup on its foot.

Its foot is on y = 0, its front to +z (the view). Variations from `hashf`, so the same script gives the same file.
Comic realism (`docs/zasady-lokacji.md` §9): a real tower viewer (binocular head on a yoke, coin box, column, round
foot), its eyepieces worn bright.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-fara-props.glb'


def telescope():
    """The viewer (0.5 x 1.6 x 0.8): round cast foot, fluted column, the yoke and the binocular head tilted a little up
    with its two barrels and hood, the eyepieces behind, the coin box with its slot and the AR screen on its back lit
    cyan, stickers on the column, a paper cup by its foot (0.7 x 1.6 x 0.9)."""
    m = Model('rd-fara-telescope')
    m.lathe(0.0, 0.0, [(0.0, 0.0), (0.22, 0.0), (0.22, 0.04), (0.15, 0.07), (0.0, 0.08)], 'dark', seg=18, y0=0.0)
    m.lathe(0.0, 0.0, [(0.0, 0.0), (0.07, 0.0), (0.06, 0.9), (0.08, 0.95), (0.0, 0.96)], 'paint', seg=14, y0=0.07)
    for k in range(3):
        y = 0.4 + k * 0.15
        m.box(-0.071, -0.069, y, y + 0.08, -0.03 + 0.02 * k, 0.02 + 0.02 * k, ('neon-pink', 'trim-light', 'neon-green')[k])
    m.box(-0.2, 0.2, 1.02, 1.06, -0.05, 0.05, 'dark')
    for s in (-1, 1):
        m.box(s * 0.2 - 0.025, s * 0.2 + 0.025, 1.02, 1.3, -0.04, 0.04, 'dark')
    tilt = math.radians(8)
    for s in (-1, 1):
        x = s * 0.075
        p0 = (x, 1.24 - 0.28 * math.sin(tilt), -0.28 * math.cos(tilt))
        p1 = (x, 1.24 + 0.3 * math.sin(tilt), 0.3 * math.cos(tilt))
        m.tube(p0, p1, 0.065, 'paint', seg=14)
        m.tube(p1, (x, p1[1] + 0.06 * math.sin(tilt), p1[2] + 0.06 * math.cos(tilt)), 0.075, 'dark', seg=14)
        m.tube((x, p0[1] - 0.04 * math.sin(tilt), p0[2] - 0.05), p0, 0.035, 'metal', seg=10)
    m.box(-0.16, 0.16, 0.95, 1.16, -0.38, -0.16, 'paint', bevel=0.01)
    m.box(-0.12, 0.12, 0.98, 1.13, -0.381, -0.379, 'neon-cyan')
    m.box(-0.03, 0.03, 1.12, 1.14, -0.25, -0.2, 'dark')
    m.lathe(0.18, 0.12, [(0.0, 0.0), (0.03, 0.0), (0.04, 0.1), (0.0, 0.1)], 'trim-light', seg=10, y0=0.0)
    return m


MODELS = [telescope]
