"""Trasa Podziemna, the cellars under the Rynek (`docs/pomieszczenia/trasa-podziemna.md`, ADR-0098), after its card.

The corridors' ribs become brick arches, Mei's stage a worn wooden platform with her speaker; the route's boards,
its rope barrier, a homeless man's bedding and an old museum lamp are drawn only. Each model's foot on y = 0,
centred on x and z, its front to +z (`packages/sim/src/content/kanal-underground.ts`).
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-stare-props.glb'


def arch(span, key):
    """A brick arch across a corridor under its flat vault: voussoirs on a segmental curve rising 0.28 m, the spandrels
    filled to the ceiling's band; 0.3 m deep, its springing at y = 0, the ceiling at 0.45."""
    m = Model(key)
    half, rise, depth, top = span / 2, 0.28, 0.3, 0.45
    r = (half * half + rise * rise) / (2 * rise)
    cy = rise - r
    n = 11
    a0 = math.asin(half / r)
    for k in range(n):
        t0, t1 = -a0 + 2 * a0 * k / n, -a0 + 2 * a0 * (k + 1) / n
        tm = (t0 + t1) / 2
        x0, y0 = r * math.sin(t0), cy + r * math.cos(t0)
        x1, y1 = r * math.sin(t1), cy + r * math.cos(t1)
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        along = (math.cos(tm), -math.sin(tm), 0.0)
        out = (math.sin(tm), math.cos(tm), 0.0)
        length = math.hypot(x1 - x0, y1 - y0)
        role = 'brick' if k % 2 == 0 else 'rust'
        m.obox((mx + out[0] * 0.09, my + out[1] * 0.09, 0.0), along, out, (length / 2 - 0.006, 0.09, depth / 2), role)
        # The spandrel over this voussoir: brick up to the ceiling's band, set back a hand from the arch's face.
        back = my + out[1] * 0.17
        if back < top - 0.07:
            m.box(min(x0, x1), max(x0, x1), back, top - 0.05, -depth / 2 + 0.03, depth / 2 - 0.03, 'rust' if k % 2 == 0 else 'brick')
    m.box(-half, half, top - 0.05, top, -depth / 2, depth / 2, 'rust')
    return m


def stage():
    """Mei's old stage: a platform of boards on a frame (3.5 x 0.25 x 2.1), a worn carpet, the microphone on its stand, the open
    guitar case with coins in it, a crate to sit on."""
    m = Model('rd-trasa-stage')
    w, h, d = 3.5, 0.25, 2.1
    m.box(-w / 2, w / 2, 0.0, h - 0.04, -d / 2, d / 2, 'dark')
    n = 14
    for k in range(n):
        x0 = -w / 2 + k * w / n
        m.box(x0 + 0.005, x0 + w / n - 0.005, h - 0.04, h - 0.005 - 0.01 * hashf(k, 2), -d / 2, d / 2, 'rust' if k % 3 else 'fabric-amber')
    m.box(-w / 2 - 0.01, w / 2 + 0.01, 0.0, h - 0.04, d / 2, d / 2 + 0.02, 'trim')
    m.box(-1.0, 0.6, h, h + 0.01, -0.7, 0.6, 'fabric-magenta')
    m.lathe(-0.2, 0.3, [(0.15, 0.0), (0.15, 0.02), (0.0, 0.02)], 'metal', seg=12, y0=h)
    m.cyl(-0.2, 0.3, 0.012, h + 0.02, h + 1.45, 'metal', seg=8)
    m.tube((-0.2, h + 1.45, 0.3), (-0.2, h + 1.55, 0.5), 0.01, 'metal')
    m.lathe(-0.2, 0.52, [(0.0, 0.0), (0.025, 0.02), (0.022, 0.1), (0.0, 0.11)], 'dark', seg=8, y0=h + 1.5)
    m.box(0.9, 1.6, h, h + 0.1, 0.4, 0.75, 'dark', bevel=0.02)
    m.box(0.93, 1.57, h + 0.06, h + 0.09, 0.43, 0.72, 'fabric-magenta')
    m.box(0.9, 1.6, h + 0.1, h + 0.13, 0.75, 0.82, 'dark')
    for k in range(9):
        m.cyl(1.0 + 0.06 * (k % 5), 0.5 + 0.05 * (k // 5), 0.012, h + 0.09, h + 0.095, 'fabric-amber', seg=8)
    m.box(-1.6, -1.2, h, h + 0.3, 0.3, 0.7, 'fabric-amber', bevel=0.02)
    m.box(-1.57, -1.23, h + 0.28, h + 0.3, 0.33, 0.67, 'dark')
    return m


def speaker():
    """The PA speaker by the stage (0.6 x 1.1 x 0.8): a black cabinet with rounded edges, its grille, the woofer and the horn
    seen through it, a handle, a cable down to the floor."""
    m = Model('rd-trasa-speaker')
    w, h, d = 0.6, 1.1, 0.8
    m.box(-w / 2, w / 2, 0.0, h, -d / 2, d / 2 - 0.03, 'dark', bevel=0.03)
    m.box(-w / 2 + 0.03, w / 2 - 0.03, 0.05, h - 0.05, d / 2 - 0.03, d / 2 - 0.02, 'ac-grille')
    for y, r in ((0.35, 0.2), (0.85, 0.09)):
        m.tube((0, y, d / 2 - 0.02), (0, y, d / 2 - 0.015), r, 'trim', seg=16)
        m.tube((0, y, d / 2 - 0.015), (0, y, d / 2 - 0.01), r * 0.35, 'metal', seg=10)
    m.box(-0.1, 0.1, h, h + 0.03, -0.05, 0.05, 'metal')
    m.tube((-w / 2, 0.1, 0.0), (-w / 2 - 0.4, 0.01, 0.3), 0.01, 'cable', seg=6)
    return m


def board():
    """A board of the closed route on its stand (0.8 x 1.7): two posts on feet, the panel with the route's map and lines of text
    faded, gang stickers over it."""
    m = Model('rd-trasa-board')
    for x in (-0.36, 0.36):
        m.box(x - 0.02, x + 0.02, 0.0, 1.7, -0.02, 0.02, 'metal')
        m.box(x - 0.08, x + 0.08, 0.0, 0.03, -0.15, 0.15, 'metal')
    m.box(-0.4, 0.4, 0.75, 1.65, 0.02, 0.04, 'trim')
    m.box(-0.37, 0.37, 0.78, 1.62, 0.04, 0.042, 'paint')
    m.box(-0.33, 0.05, 1.2, 1.56, 0.042, 0.044, 'fabric-amber')
    for k in range(6):
        y = 0.85 + k * 0.055
        m.box(-0.33, 0.3 - 0.2 * hashf(k, 5), y, y + 0.012, 0.042, 0.045, 'dark')
    for k, (x, y, role) in enumerate(((0.12, 1.35, 'neon-pink'), (0.2, 1.1, 'neon-green'), (-0.25, 0.9, 'neon-amber'))):
        m.box(x - 0.06, x + 0.06, y - 0.05, y + 0.05, 0.044, 0.047, role)
    return m


def rope():
    """The museum's rope barrier along a wall: three brass posts on round feet, a red rope sagging between them (2.4 m)."""
    m = Model('rd-trasa-rope')
    xs = (-1.2, 0.0, 1.2)
    for x in xs:
        m.lathe(x, 0, [(0.14, 0.0), (0.14, 0.02), (0.03, 0.04), (0.0, 0.04)], 'fabric-amber', seg=12)
        m.cyl(x, 0, 0.022, 0.04, 0.9, 'fabric-amber', seg=8)
        m.lathe(x, 0, [(0.0, 0.0), (0.035, 0.03), (0.0, 0.07)], 'fabric-amber', seg=8, y0=0.9)
    for a, b in zip(xs, xs[1:]):
        pts = [(a + (b - a) * t / 6, 0.85 - 0.18 * (1 - (2 * t / 6 - 1) ** 2), 0.0) for t in range(7)]
        for p, q in zip(pts, pts[1:]):
            m.tube(p, q, 0.015, 'neon-red', seg=6)
    return m


def bedding():
    """Where somebody sleeps in the corridor: flattened boxes, a grey blanket thrown back, a rolled jacket for a pillow, bottles
    and cans beside it (1.6 x 0.9)."""
    m = Model('rd-trasa-bedding')
    m.box(-0.85, 0.85, 0.0, 0.015, -0.5, 0.5, 'fabric-amber')
    m.box(-0.7, 0.9, 0.0, 0.025, -0.35, 0.45, 'fabric-amber')
    m.box(-0.4, 0.75, 0.025, 0.09, -0.4, 0.35, 'trim-light', bevel=0.03)
    m.box(-0.7, 0.75, 0.025, 0.06, 0.05, 0.35, 'trim-light', bevel=0.02)
    m.tube((-0.75, 0.08, -0.3), (-0.75, 0.08, 0.3), 0.08, 'fabric-teal', seg=10)
    for k, (x, z) in enumerate(((0.95, 0.3), (1.0, 0.1), (0.9, -0.2))):
        if k == 1:
            m.tube((x - 0.1, 0.035, z), (x + 0.1, 0.035, z + 0.05), 0.035, 'plant', seg=8)
        else:
            m.lathe(x, z, [(0.035, 0), (0.035, 0.12), (0.0, 0.12)], 'neon-red' if k else 'metal', seg=8)
    return m


def lamp():
    """An old museum lamp on the wall: a cast bracket, a frosted glass shade, the cable taped down to an LED's plug."""
    m = Model('rd-trasa-lamp')
    m.box(-0.07, 0.07, -0.12, 0.12, 0.0, 0.03, 'dark', bevel=0.01)
    m.tube((0, 0.05, 0.02), (0, 0.12, 0.22), 0.012, 'dark')
    m.lathe(0, 0.22, [(0.05, 0.0), (0.1, 0.04), (0.09, 0.14), (0.04, 0.16), (0.0, 0.16)], 'win-warm', seg=12, y0=-0.04)
    m.tube((0, -0.12, 0.015), (0, -0.9, 0.015), 0.006, 'cable', seg=6)
    for y in (-0.3, -0.6):
        m.box(-0.02, 0.02, y - 0.02, y + 0.02, 0.01, 0.025, 'trim-light')
    return m


MODELS = [lambda: arch(2.4, 'rd-trasa-arch-24'), lambda: arch(2.1, 'rd-trasa-arch-21'), stage, speaker, board, rope, bedding, lamp]
