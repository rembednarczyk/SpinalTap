"""The metro's platforms (`docs/pomieszczenia/metro-*.md`, ADR-0098): what their cards ask for that the engine's mesh of a
platform (`packages/engine/src/renderer/metro/platform-plan.ts`: the floor with its yellow line, the station's tiles, the
screen doors, the train, the benches, the ticket machine) has not got. One set for the four stations, placed on each
from the platform's own layout (`packages/sim/src/content/metro-platform.ts`): the back wall, the benches 0.45 m high,
the ceiling 4.2 m over the floor.

Each model's foot is on y = 0 where it stands (the floor, a bench's seat, a wall's spot, the ceiling for what hangs),
its front to +z.
"""
from shapes import Model, hashf

FILE = 'room-detail-metro-props.glb'


def vent():
    """A ventilation grille in the back wall: a steel frame, slanted louvres, four bolts, dust streaking down from it
    (1.6 x 0.8)."""
    m = Model('rd-metro-vent')
    w, h = 1.6, 0.8
    m.box(-w / 2, w / 2, 0.0, h, 0.0, 0.02, 'dark')
    for y in (0.0, h - 0.05):
        m.box(-w / 2, w / 2, y, y + 0.05, 0.0, 0.05, 'metal')
    for x in (-w / 2, w / 2 - 0.05):
        m.box(x, x + 0.05, 0.0, h, 0.0, 0.05, 'metal')
    for k in range(9):
        y = 0.08 + k * 0.075
        m.obox((0.0, y, 0.03), (1, 0, 0), (0, 0.7, 0.7), (w / 2 - 0.06, 0.025, 0.004), 'metal')
    for x, y in ((-w / 2 + 0.03, 0.03), (w / 2 - 0.03, 0.03), (-w / 2 + 0.03, h - 0.03), (w / 2 - 0.03, h - 0.03)):
        m.box(x - 0.012, x + 0.012, y - 0.012, y + 0.012, 0.05, 0.058, 'dark')
    for k in range(5):
        x = -w / 2 + 0.2 + k * 0.3 + 0.08 * hashf(k, 2.0)
        m.box(x, x + 0.05 + 0.04 * hashf(k, 3.0), -0.12 - 0.14 * hashf(k, 4.0), 0.0, 0.0, 0.003, 'wall-dark')
    return m


def timetable():
    """The timetable's screen hanging from the ceiling on two rods (foot at the ceiling): a double-faced box, on each face
    rows of departures in amber, one row's minutes flickering red, the line's number in a cyan square (1.4 x 1.25)."""
    m = Model('rd-metro-timetable')
    w, h, d = 1.4, 0.45, 0.12
    m.box(-0.5, 0.5, -0.03, 0.0, -0.06, 0.06, 'metal')
    for x in (-0.45, 0.45):
        m.tube((x, -0.03, 0.0), (x, -0.8, 0.0), 0.015, 'metal', seg=6)
    m.box(-w / 2, w / 2, -0.8 - h, -0.8, -d / 2, d / 2, 'dark', bevel=0.01)
    for s in (-1, 1):
        z = s * (d / 2 + 0.002)
        z0, z1 = (z - 0.002, z) if s < 0 else (z, z + 0.002)
        m.box(-w / 2 + 0.04, w / 2 - 0.04, -0.8 - h + 0.04, -0.84, z0 - s * 0.001, z1 - s * 0.001, 'office')
        for r in range(4):
            y = -0.88 - r * 0.085
            m.box(-w / 2 + 0.07, -w / 2 + 0.15, y - 0.05, y, z0, z1, 'neon-cyan')
            m.box(-w / 2 + 0.2, 0.25 - 0.2 * hashf(r, 1.0), y - 0.04, y - 0.01, z0, z1, 'neon-amber')
            m.box(0.45, 0.62, y - 0.04, y - 0.01, z0, z1, 'neon-red' if r == 2 else 'neon-amber')
    return m


def validator():
    """A ticket validator by the stairs' foot: a steel post on its plate, a yellow head with the card's slot, a green
    light and a small screen (0.3 x 1.25 x 0.25)."""
    m = Model('rd-metro-validator')
    m.box(-0.15, 0.15, 0.0, 0.015, -0.12, 0.12, 'metal')
    m.cyl(0.0, 0.0, 0.035, 0.015, 0.95, 'metal', seg=10)
    m.box(-0.12, 0.12, 0.95, 1.25, -0.09, 0.09, 'neon-amber', bevel=0.02)
    m.box(-0.08, 0.08, 1.12, 1.2, 0.09, 0.095, 'win-teal')
    m.box(-0.06, 0.06, 1.0, 1.02, 0.09, 0.1, 'dark')
    m.cyl(0.08, 0.092, 0.012, 1.06, 1.07, 'neon-green', seg=8)
    return m


def litter():
    """What someone left on a bench: a newspaper open on the timetable page, a paper cup with its lid, a crumpled ticket
    (0.8 x 0.4)."""
    m = Model('rd-metro-litter')
    m.obox((-0.15, 0.004, 0.0), (0.98, 0.0, 0.2), (0.0, 1.0, 0.0), (0.22, 0.003, 0.15), 'win-white')
    m.obox((0.12, 0.012, 0.02), (0.97, 0.15, -0.2), (-0.15, 0.99, 0.0), (0.2, 0.003, 0.15), 'win-white')
    for k in range(5):
        y = 0.017
        x = 0.0 + k * 0.05
        m.box(x, x + 0.03, y, y + 0.002, -0.08, 0.1, 'dark')
    m.box(-0.3, -0.12, 0.009, 0.011, -0.1, -0.02, 'dark')
    m.lathe(0.33, -0.05, [(0.03, 0.0), (0.042, 0.11), (0.044, 0.115), (0.0, 0.12)], 'fabric-amber', seg=12)
    m.lathe(0.33, -0.05, [(0.044, 0.0), (0.04, 0.012), (0.0, 0.014)], 'trim-light', seg=12, y0=0.115)
    m.box(0.25, 0.3, 0.0, 0.02, 0.08, 0.12, 'neon-violet', bevel=0.008)
    return m


def poster(variant, key):
    """A concert poster pasted on the back wall, a corner torn off, the district's stickers round it (0.7 x 1.0 and a
    1.3 x 1.4 spread of stickers)."""
    m = Model(key)
    a, b, c = (('neon-pink', 'neon-violet', 'win-white') if variant == 0 else ('neon-amber', 'neon-red', 'dark'))
    w, h = 0.7, 1.0
    m.box(-w / 2, w / 2, 0.0, h, 0.0, 0.003, b)
    m.box(-w / 2 + 0.04, w / 2 - 0.04, h - 0.28, h - 0.04, 0.003, 0.004, a)
    m.box(-w / 2 + 0.06, w / 2 - 0.12, h - 0.38, h - 0.32, 0.003, 0.004, c)
    m.box(-0.2, 0.2, 0.25, 0.55, 0.003, 0.004, c)
    m.box(-w / 2 + 0.06, w / 2 - 0.06, 0.08, 0.14, 0.003, 0.004, a)
    # The torn corner: the wall's tiles show again.
    m.box(w / 2 - 0.14, w / 2 + 0.001, 0.0, 0.12, 0.0035, 0.0045, 'trim-light')
    roles = ['neon-green', 'neon-cyan', 'win-white', 'neon-amber', 'neon-pink', 'fabric-teal', 'dark']
    for k in range(11):
        x = -0.65 + 1.3 * hashf(k, variant, 5.0)
        y = -0.2 + 1.4 * hashf(k, variant, 6.0)
        if -w / 2 - 0.05 < x < w / 2 + 0.05 and -0.05 < y < h + 0.05:
            continue
        s = 0.05 + 0.06 * hashf(k, 7.0)
        m.box(x - s, x + s, y - s * 0.7, y + s * 0.7, 0.0, 0.002, roles[k % len(roles)])
    return m


def camera():
    """A security camera on the back wall under the ceiling: a wall plate, a bracket out, the white housing tilted down at
    the platform with its sun hood, the lens and a red light (0.2 x 0.25 x 0.5)."""
    m = Model('rd-metro-camera')
    m.box(-0.07, 0.07, -0.08, 0.08, 0.0, 0.02, 'dark')
    m.tube((0.0, 0.0, 0.02), (0.0, 0.0, 0.2), 0.02, 'dark', seg=8)
    m.obox((0.0, -0.06, 0.32), (1, 0, 0), (0, 0.94, -0.34), (0.06, 0.06, 0.15), 'trim-light', bevel=0.01)
    m.obox((0.0, -0.0, 0.33), (1, 0, 0), (0, 0.94, -0.34), (0.075, 0.006, 0.18), 'trim-light')
    m.obox((0.0, -0.11, 0.465), (1, 0, 0), (0, 0.94, -0.34), (0.035, 0.035, 0.008), 'glass-dark')
    m.box(0.03, 0.045, -0.05, -0.035, 0.45, 0.46, 'neon-red')
    return m


MODELS = [vent, timetable, validator, litter, lambda: poster(0, "rd-metro-poster-a"), lambda: poster(1, "rd-metro-poster-b"), camera]
