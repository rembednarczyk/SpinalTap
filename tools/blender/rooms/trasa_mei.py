"""Trasa Podziemna's loch after its card (`docs/pomieszczenia/trasa-podziemna.md`, ADR-0102 point 5, ADR-0098): Mei's
old poster from the nights she sang here, its corners torn, the song list taped beside it, a dried rose and a candle
stub on the brick ledge under it; the drip from the south corridor's vault, its puddle and the lime streak.

Each model's foot is on y = 0 at the cellars' floor, its front to +z (the poster's wall at z 0). Variations from
`hashf`, so the same script gives the same file. Comic realism (`docs/zasady-lokacji.md` §9): a real printed gig
poster with its tape, a real candle stub.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-trasa-props.glb'


def poster():
    """Mei's poster on the loch's brick wall (0.6 x 0.85 m, 1.1..1.95 m up): its print in two inks with her figure at
    the microphone, the venue's line at its foot, a torn corner, four strips of tape; the song list typed on a sheet
    beside it; the brick ledge under them with a dried rose and a candle stub in its wax (1.1 x 1.95 x 0.25)."""
    m = Model('rd-trasa-poster')
    m.box(-0.3, 0.3, 1.1, 1.95, 0.0, 0.003, 'win-white')
    m.box(-0.27, 0.27, 1.25, 1.9, 0.003, 0.004, 'neon-pink')
    m.box(-0.06, 0.06, 1.35, 1.72, 0.004, 0.005, 'dark')
    m.lathe(0.0, 0.0045, [(0.0, 0.0), (0.06, 0.0), (0.0, 0.001)], 'dark', seg=10, y0=1.76)
    m.tube((0.05, 1.62, 0.005), (0.14, 1.66, 0.005), 0.006, 'metal', seg=5)
    m.box(-0.25, 0.25, 1.14, 1.2, 0.004, 0.005, 'dark')
    m.quad([(0.3, 1.95, 0.0035), (0.18, 1.95, 0.0035), (0.3, 1.82, 0.0035)], 'brick')
    for x, y in ((-0.3, 1.95), (0.3, 1.1), (-0.3, 1.1), (0.24, 1.92)):
        m.obox((x, y, 0.005), (0.7, 0.7, 0), (-0.7, 0.7, 0), (0.04, 0.012, 0.001), 'trim-light')
    m.box(0.36, 0.58, 1.3, 1.6, 0.0, 0.002, 'trim-light')
    for k in range(8):
        w = 0.08 + 0.1 * hashf(k, 2.0)
        m.box(0.38, 0.38 + w, 1.56 - k * 0.032, 1.565 - k * 0.032, 0.002, 0.003, 'dark')
    m.box(-0.5, 0.5, 0.9, 0.96, 0.0, 0.18, 'brick')
    m.tube((-0.2, 0.975, 0.1), (0.1, 0.97, 0.12), 0.005, 'plant', seg=5)
    m.lathe(0.12, 0.12, [(0.0, 0.0), (0.02, 0.006), (0.024, 0.02), (0.0, 0.03)], 'neon-red', seg=8, y0=0.96)
    m.lathe(0.3, 0.09, [(0.0, 0.0), (0.04, 0.0), (0.03, 0.01), (0.02, 0.05), (0.0, 0.055)], 'trim-light', seg=10, y0=0.96)
    return m


def drip():
    """Under the south corridor's vault where it leaks: the puddle on the flags, its rings, a lime streak down the
    wall from the vault's crack, a dented bucket someone stood under it and moved (1.0 x 2.6 x 1.1)."""
    m = Model('rd-trasa-drip')
    m.quad([(-0.4, 0.004, -0.3), (0.35, 0.004, -0.4), (0.45, 0.004, 0.35), (-0.3, 0.004, 0.45)], 'glass-blue')
    for k, r in enumerate((0.06, 0.12)):
        for j in range(10):
            a0, a1 = 2 * math.pi * j / 10, 2 * math.pi * (j + 1) / 10
            m.tube((0.05 + r * math.cos(a0), 0.006, r * math.sin(a0)), (0.05 + r * math.cos(a1), 0.006, r * math.sin(a1)), 0.003, 'trim-light', seg=4)
    m.box(0.48, 0.5, 0.2, 2.6, -0.1, 0.1, 'trim-light')
    m.lathe(-0.35, 0.55, [(0.0, 0.0), (0.12, 0.0), (0.15, 0.27), (0.14, 0.29), (0.0, 0.28)], 'metal', seg=12, y0=0.0)
    m.lathe(-0.35, 0.55, [(0.0, 0.0), (0.13, 0.0), (0.0, 0.002)], 'glass-blue', seg=10, y0=0.2)
    return m


MODELS = [poster, drip]
