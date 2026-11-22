"""Tessen's pass office in W-3's tower (`docs/pomieszczenia/tessen-office.md`, ADR-0098), after its card.

Each model stands in the frame of the simulation's solid it draws (`office()` of
`packages/sim/src/content/tessen-w3/tower-pipes.ts`): its foot on y = 0, centred on x and z, its front to +z.
"""
import math

from shapes import Model, hashf


def desk():
    """The guard's desk along the west wall (3 x 0.85 x 1.2): a grey top on two drawer pedestals, three monitors on a bar with the
    cameras' feeds, the terminal's keyboard, the card printer, two cups, a sandwich in foil."""
    m = Model('rd-tessen-desk')
    w, d, top = 3.0, 1.2, 0.75
    m.box(-w / 2, w / 2, top - 0.04, top, -d / 2, d / 2, 'trim-light', bevel=0.01)
    for x in (-w / 2 + 0.25, w / 2 - 0.25):
        m.box(x - 0.22, x + 0.22, 0.0, top - 0.04, -d / 2 + 0.05, d / 2 - 0.05, 'trim', bevel=0.01)
        for k in range(3):
            y = 0.08 + k * 0.21
            m.box(x - 0.2, x + 0.2, y, y + 0.18, d / 2 - 0.05, d / 2 - 0.04, 'trim-light')
            m.box(x - 0.06, x + 0.06, y + 0.12, y + 0.14, d / 2 - 0.04, d / 2 - 0.02, 'metal')
    m.box(-w / 2 + 0.47, w / 2 - 0.47, 0.1, top - 0.04, -d / 2 + 0.02, -d / 2 + 0.04, 'trim')
    m.tube((-0.9, top, -0.4), (-0.9, top + 0.55, -0.4), 0.02, 'metal')
    m.tube((0.9, top, -0.4), (0.9, top + 0.55, -0.4), 0.02, 'metal')
    m.tube((-1.2, top + 0.55, -0.4), (1.2, top + 0.55, -0.4), 0.02, 'metal')
    for x in (-0.75, 0.0, 0.75):
        m.box(x - 0.34, x + 0.34, top + 0.32, top + 0.74, -0.42, -0.37, 'dark', bevel=0.01)
        m.box(x - 0.31, x + 0.31, top + 0.35, top + 0.71, -0.37, -0.365, 'office')
        for k in range(2):
            y = top + 0.4 + k * 0.15
            m.box(x - 0.28, x - 0.02, y, y + 0.12, -0.365, -0.36, 'win-teal')
    m.box(-0.3, 0.25, top, top + 0.03, -0.05, 0.12, 'dark', bevel=0.005)
    m.box(-0.28, 0.23, top + 0.03, top + 0.035, -0.03, 0.1, 'trim')
    m.box(0.45, 0.85, top, top + 0.22, -0.3, 0.05, 'ac', bevel=0.02)
    m.box(0.5, 0.8, top + 0.12, top + 0.14, 0.05, 0.08, 'dark')
    m.box(0.55, 0.62, top + 0.17, top + 0.19, 0.05, 0.055, 'neon-green')
    for x, z in ((-1.1, 0.25), (-1.25, 0.1)):
        m.lathe(x, z, [(0.035, 0), (0.04, 0.1), (0.0, 0.1)], 'paint', seg=10, y0=top)
    m.box(1.0, 1.2, top, top + 0.05, 0.1, 0.28, 'win-white', bevel=0.02)
    for k in range(4):
        m.box(-0.9 + 0.12 * k, -0.82 + 0.12 * k, top, top + 0.004, 0.15 + 0.03 * k, 0.24 + 0.03 * k, 'paint')
    return m


def cabinet():
    """Along the north wall (2 x 1.8 x 0.6): three filing cabinets of four drawers, the access cards' locker with its keypad
    and a red diode beside them, a box of files on top."""
    m = Model('rd-tessen-cabinet')
    w, h, d = 2.0, 1.8, 0.6
    for k in range(3):
        x0 = -w / 2 + k * 0.47
        m.box(x0 + 0.01, x0 + 0.46, 0.0, 1.32, -d / 2, d / 2 - 0.02, 'trim-light', bevel=0.008)
        for j in range(4):
            y = 0.05 + j * 0.32
            m.box(x0 + 0.03, x0 + 0.44, y, y + 0.29, d / 2 - 0.021, d / 2 - 0.012, 'ac')
            m.box(x0 + 0.17, x0 + 0.3, y + 0.2, y + 0.23, d / 2 - 0.012, d / 2 + 0.01, 'metal')
            m.box(x0 + 0.19, x0 + 0.28, y + 0.24, y + 0.27, d / 2 - 0.012, d / 2 - 0.008, 'paint')
    xl = -w / 2 + 1.42
    m.box(xl, w / 2, 0.0, h, -d / 2, d / 2 - 0.02, 'trim', bevel=0.01)
    m.box(xl + 0.03, w / 2 - 0.03, 0.05, h - 0.05, d / 2 - 0.021, d / 2 - 0.012, 'metal')
    m.box(w / 2 - 0.16, w / 2 - 0.06, 1.0, 1.18, d / 2 - 0.012, d / 2 + 0.01, 'dark')
    m.box(w / 2 - 0.15, w / 2 - 0.07, 1.12, 1.16, d / 2 + 0.01, d / 2 + 0.012, 'win-teal')
    m.box(w / 2 - 0.12, w / 2 - 0.1, 1.03, 1.05, d / 2 + 0.01, d / 2 + 0.014, 'neon-red')
    m.box(-w / 2 + 0.1, -w / 2 + 0.6, 1.32, 1.6, -0.2, 0.2, 'fabric-amber', bevel=0.01)
    for k in range(5):
        x = -w / 2 + 0.16 + 0.08 * k
        m.box(x, x + 0.06, 1.6, 1.62 + 0.03 * hashf(k, 4), -0.15, 0.15, 'paint')
    return m


def bench():
    """By the door (2.2 x 0.45 x 0.6): a steel bench of three seats for the drivers waiting for their cards, a fern in a pot
    on its end, the bin full of coffee cups beside it."""
    m = Model('rd-tessen-bench')
    w, d = 2.2, 0.6
    m.box(-w / 2 + 0.05, w / 2 - 0.55, 0.0, 0.03, -0.2, 0.2, 'metal')
    for x in (-w / 2 + 0.15, w / 2 - 0.65):
        m.box(x - 0.03, x + 0.03, 0.0, 0.4, -0.05, 0.05, 'metal')
    m.box(-w / 2 + 0.05, w / 2 - 0.55, 0.4, 0.45, -d / 2 + 0.05, d / 2 - 0.05, 'ac', bevel=0.01)
    m.box(-w / 2 + 0.05, w / 2 - 0.55, 0.45, 0.85, -d / 2 + 0.05, -d / 2 + 0.09, 'ac', bevel=0.01)
    m.lathe(w / 2 - 0.25, -0.05, [(0.12, 0.0), (0.15, 0.3), (0.0, 0.3)], 'brick', seg=12)
    for k in range(9):
        a = 2 * math.pi * k / 9
        m.tube((w / 2 - 0.25, 0.3, -0.05), (w / 2 - 0.25 + 0.3 * math.cos(a), 0.55 + 0.1 * hashf(k), -0.05 + 0.3 * math.sin(a)), 0.012, 'plant', seg=5)
    m.lathe(w / 2 - 0.25, 0.22, [(0.14, 0.0), (0.16, 0.42), (0.0, 0.42)], 'metal', seg=12, cap=False)
    for k in range(5):
        x, z = w / 2 - 0.3 + 0.05 * (k % 3), 0.2 + 0.04 * (k // 3)
        m.lathe(x, z, [(0.03, 0), (0.04, 0.1), (0.0, 0.1)], 'paint', seg=8, y0=0.38 + 0.03 * k)
    return m


def board():
    """The cork board on the south wall: the duty roster written by hand, the photo of the plant's opening in a frame, notes on pins."""
    m = Model('rd-tessen-board')
    m.box(-0.6, 0.6, 0.0, 0.8, -0.02, 0.0, 'rust')
    m.box(-0.62, 0.62, -0.02, 0.82, -0.025, -0.02, 'trim')
    m.box(-0.55, -0.1, 0.1, 0.7, 0.0, 0.003, 'paint')
    for k in range(8):
        y = 0.16 + k * 0.065
        m.box(-0.52, -0.2 + 0.08 * hashf(k, 9), y, y + 0.01, 0.003, 0.005, 'dark')
    m.box(0.0, 0.5, 0.35, 0.72, 0.0, 0.01, 'dark')
    m.box(0.03, 0.47, 0.38, 0.69, 0.01, 0.012, 'shop-warm')
    for k, (x, y) in enumerate(((0.05, 0.12), (0.22, 0.2), (0.38, 0.1))):
        m.box(x, x + 0.12, y, y + 0.12, 0.0, 0.004, ('neon-amber', 'paint', 'fabric-teal')[k])
        m.box(x + 0.055, x + 0.065, y + 0.1, y + 0.11, 0.004, 0.012, 'neon-red')
    return m


def ceiling():
    """The suspended ceiling's two light fittings over the desk and the door: a white grid, its tubes behind prismatic covers."""
    m = Model('rd-tessen-lights')
    for z in (-1.8, 1.8):
        m.box(-0.62, 0.62, -0.06, 0.0, z - 0.32, z + 0.32, 'trim-light')
        m.box(-0.58, 0.58, -0.065, -0.06, z - 0.28, z + 0.28, 'win-white')
        for x in (-0.3, 0.0, 0.3):
            m.box(x - 0.006, x + 0.006, -0.07, -0.065, z - 0.28, z + 0.28, 'trim-light')
    return m


# The props file the room's models go to (one a district, each under its budget, ADR-0098).
FILE = 'room-detail-doki-props.glb'
MODELS = [desk, cabinet, bench, board, ceiling]
