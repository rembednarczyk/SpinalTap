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


# The holo-fara's origin in the world (the nave's axis z 42.3, x between the west wall and the chancel arch) and its
# yaw (pi/2: local +z is the world's +x, local +x the world's -z). The plan is the foundations' (OSM r18507552,
# r18507551, w1348806697-708, the curator's review of 24.11); the heights are approximate (Gothic town churches of
# Little Poland: walls about 13 m, the ridge about 27 m, the tower with its spire 45-55 m), to check against the
# 1618 view of Braun and Hogenberg and the bronze model on the terrace.
FARA_O = (676.0, 42.3)


def _fp(wx, y, wz):
    """A world point (x, z) of the plan at height y, in the model's frame."""
    return (-(wz - FARA_O[1]), y, wx - FARA_O[0])


def _ring(m, pts, y, r=0.035):
    for k, (ax, az) in enumerate(pts):
        bx, bz = pts[(k + 1) % len(pts)]
        m.tube(_fp(ax, y, az), _fp(bx, y, bz), r, 'neon-cyan', seg=6)


def _walls(m, pts, top, step=3.0):
    """The outline's base, its top and a scan line every `step` m, and a line up every corner."""
    y = 0.1
    while y < top - 0.5:
        _ring(m, pts, y, 0.025 if y > 0.1 else 0.04)
        y += step
    _ring(m, pts, top, 0.04)
    for (x, z) in pts:
        m.tube(_fp(x, 0.1, z), _fp(x, top, z), 0.035, 'neon-cyan', seg=6)


def holo_fara():
    """The hologram of the parish church of St Michael over its foundations (Plac po Farze, demolished in the 1840s):
    an outline of light lines, not a rebuilding (ADR-0062: the 2077 layer on a monument is light, never a building).
    Its nave of three bays, the polygonal chancel, the west tower with its spire; scan lines every 3 m."""
    m = Model('rd-fara-holo')
    # The nave's outside (the foundations' inner faces 1 m out), walls ~13 m, the gable roof's ridge ~27 m on the axis.
    nave = [(658.5, 32.5), (681.3, 32.5), (681.3, 52.1), (658.5, 52.1)]
    _walls(m, nave, 13.0)
    ridge = 27.0
    m.tube(_fp(658.5, ridge, 42.3), _fp(681.3, ridge, 42.3), 0.04, 'neon-cyan', seg=6)
    x = 658.5
    while x <= 681.3 + 1e-6:
        for z in (32.5, 52.1):
            m.tube(_fp(x, 13.0, z), _fp(x, ridge, 42.3), 0.025, 'neon-cyan', seg=6)
        x += (681.3 - 658.5) / 5
    # The chancel: walls ~12 m, closed in three sides of an octagon, its ridge ~19.5 m and the hips down to the apse.
    chancel = [(681.3, 37.0), (691.0, 37.0), (694.6, 39.4), (695.7, 42.3), (694.6, 45.2), (691.0, 48.0), (681.3, 48.0)]
    _walls(m, chancel, 12.0)
    m.tube(_fp(681.3, 19.5, 42.3), _fp(691.0, 19.5, 42.3), 0.04, 'neon-cyan', seg=6)
    for (x, z) in chancel[1:-1]:
        m.tube(_fp(x, 12.0, z), _fp(691.0, 19.5, 42.3), 0.025, 'neon-cyan', seg=6)
    for z in (37.0, 48.0):
        m.tube(_fp(681.3, 12.0, z), _fp(681.3, 19.5, 42.3), 0.025, 'neon-cyan', seg=6)
    # The west tower (the ruins' square on the axis, 8.1 x 8.3 m): walls ~30 m, a pyramid spire to ~50 m.
    tower = [(650.1, 39.5), (658.2, 39.5), (658.2, 47.8), (650.1, 47.8)]
    _walls(m, tower, 30.0)
    apex = _fp(654.15, 50.0, 43.65)
    for (x, z) in tower:
        m.tube(_fp(x, 30.0, z), apex, 0.035, 'neon-cyan', seg=6)
    return m


MODELS = [telescope, holo_fara]
