"""The basement under W-3's hall and its culvert (`docs/pomieszczenia/w3-basement.md`, ADR-0098), after its card.

The room's sizes are the simulation's (`packages/sim/src/content/tessen-w3/layout.ts`): the basement 4.1 m high
(floor -4.5, ceiling -0.4 under the hall), stair A 8 m long and stair B 6 m, both rising 4.5 m, the culvert's crawl
2 m wide and 1.5 m high. Each model's foot is on y = 0 where it stands (the floor, the crawl's floor, a stair's foot,
a wall's spot, the ceiling for what hangs), its front to +z.
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-doki-props.glb'

# The pipes' axis under the ceiling, over the floor (the ceiling at 4.1).
PIPE_Y = 3.8


def pipes():
    """Two pipes along the south wall under the ceiling (along x, 30.6 m): a rising main and a cable duct's pipe, strap
    brackets to the ceiling every 1.5 m, flanges every 6 m, rust running from the joints."""
    m = Model('rd-w3b-pipes')
    n = 30.6
    m.tube((-n / 2, 0.0, 0.0), (n / 2, 0.0, 0.0), 0.08, 'pipe', seg=12)
    m.tube((-n / 2, 0.06, 0.22), (n / 2, 0.06, 0.22), 0.045, 'metal', seg=8)
    k = 0
    x = -n / 2 + 0.4
    while x < n / 2:
        m.box(x - 0.025, x + 0.025, 0.08, 0.3, -0.02, 0.02, 'dark')
        m.box(x - 0.025, x + 0.025, 0.1, 0.3, 0.2, 0.24, 'dark')
        if k % 4 == 0:
            m.tube((x + 0.5, 0.0, 0.0), (x + 0.56, 0.0, 0.0), 0.12, 'pipe', seg=12)
            m.box(x + 0.48, x + 0.6, -0.22 - 0.2 * hashf(x, 1.0), -0.08, 0.07, 0.075, 'rust')
        k += 1
        x += 2.0
    return m


def pump():
    """The pumping set in the south-west corner (its back to the west wall): a motor and the pump's volute on a concrete
    plinth, the coupling's guard, the suction down into the sump's grate, the filter's housing with its bolted lid, the
    discharge rising with a gate valve and a gauge to the main under the ceiling (1.6 x 3.8 x 0.9)."""
    m = Model('rd-w3b-pump')
    m.box(-0.65, 0.55, 0.0, 0.15, -0.35, 0.35, 'wall-dark', bevel=0.02)
    m.box(-0.62, 0.5, 0.15, 0.2, -0.25, 0.25, 'metal')
    # The motor, lying along x, its cooling fins and its terminal box.
    m.tube((-0.6, 0.38, 0.0), (-0.08, 0.38, 0.0), 0.17, 'fabric-teal', seg=12)
    for k in range(3):
        x = -0.52 + k * 0.14
        m.tube((x, 0.38, 0.0), (x + 0.03, 0.38, 0.0), 0.185, 'fabric-teal', seg=12)
    m.box(-0.4, -0.22, 0.52, 0.62, -0.08, 0.08, 'fabric-teal', bevel=0.01)
    m.tube((-0.31, 0.62, 0.0), (-0.31, 0.75, 0.0), 0.015, 'cable', seg=6)
    m.box(-0.08, 0.1, 0.24, 0.52, -0.14, 0.14, 'neon-amber', bevel=0.01)
    # The volute, its suction pipe down into the sump, the sump's grate.
    m.tube((0.28, 0.38, -0.12), (0.28, 0.38, 0.12), 0.22, 'fabric-teal', seg=12)
    m.tube((0.28, 0.38, 0.12), (0.28, 0.38, 0.32), 0.07, 'pipe', seg=10)
    m.tube((0.28, 0.38, 0.32), (0.28, -0.05, 0.32), 0.07, 'pipe', seg=10)
    m.box(0.08, 0.48, 0.0, 0.012, 0.22, 0.42, 'dark')
    for k in range(6):
        x = 0.1 + k * 0.07
        m.box(x, x + 0.015, 0.012, 0.02, 0.22, 0.42, 'metal')
    # The discharge to the filter's housing.
    m.tube((0.28, 0.6, 0.0), (0.28, 0.9, 0.0), 0.06, 'pipe', seg=10)
    m.tube((0.28, 0.9, 0.0), (0.7, 0.9, 0.0), 0.06, 'pipe', seg=10)
    m.tube((0.7, 0.9, 0.0), (0.7, 0.78, -0.1), 0.06, 'pipe', seg=10)
    m.cyl(0.7, -0.1, 0.17, 0.0, 0.72, 'metal', seg=12)
    m.lathe(0.7, -0.1, [(0.2, 0.0), (0.2, 0.04), (0.12, 0.08), (0.0, 0.09)], 'metal', seg=12, y0=0.72)
    for k in range(0, 8, 2):
        a = 2 * math.pi * k / 8
        m.cyl(0.7 + 0.18 * math.cos(a), -0.1 + 0.18 * math.sin(a), 0.012, 0.76, 0.79, 'dark', seg=6)
    # The rising main from the housing up to the pipes, a gate valve's wheel and a gauge on it.
    m.tube((0.7, 0.5, -0.1), (0.7, 0.5, -0.4), 0.08, 'pipe', seg=12)
    m.tube((0.7, 0.5, -0.4), (0.7, PIPE_Y, -0.4), 0.08, 'pipe', seg=12)
    m.tube((0.7, PIPE_Y, -0.4), (0.7, PIPE_Y, -0.3), 0.08, 'pipe', seg=12)
    m.box(0.6, 0.8, 1.2, 1.36, -0.5, -0.3, 'metal', bevel=0.01)
    m.tube((0.7, 1.36, -0.4), (0.7, 1.55, -0.4), 0.015, 'metal', seg=6)
    for k in range(8):
        a0, a1 = 2 * math.pi * k / 8, 2 * math.pi * (k + 1) / 8
        p0 = (0.7 + 0.12 * math.cos(a0), 1.55, -0.4 + 0.12 * math.sin(a0))
        p1 = (0.7 + 0.12 * math.cos(a1), 1.55, -0.4 + 0.12 * math.sin(a1))
        m.tube(p0, p1, 0.012, 'neon-red', seg=6)
    m.tube((0.58, 1.55, -0.4), (0.82, 1.55, -0.4), 0.01, 'neon-red', seg=6)
    m.tube((0.7, 1.7, -0.32), (0.7, 1.7, -0.22), 0.012, 'metal', seg=6)
    m.tube((0.7, 1.7, -0.22), (0.7, 1.7, -0.19), 0.055, 'metal', seg=12)
    m.tube((0.7, 1.7, -0.19), (0.7, 1.7, -0.185), 0.048, 'win-white', seg=12)
    # The filter's service tag on a wire.
    m.box(0.85, 0.95, 0.45, 0.58, 0.07, 0.072, 'win-white')
    return m


def panel():
    """The electrical box on the east wall: a grey steel cabinet with its door's handle and a warning sign, conduits up to
    the ceiling, the emergency lamp over it lit red (0.6 x 3.1 x 0.25, its foot 1 m over the floor)."""
    m = Model('rd-w3b-panel')
    m.box(-0.3, 0.3, 0.0, 0.8, 0.0, 0.22, 'trim', bevel=0.012)
    m.box(-0.28, 0.28, 0.02, 0.78, 0.22, 0.23, 'trim-light')
    m.box(0.2, 0.23, 0.3, 0.46, 0.23, 0.26, 'dark')
    m.box(-0.1, 0.1, 0.55, 0.7, 0.23, 0.232, 'neon-amber')
    m.box(-0.06, 0.06, 0.6, 0.66, 0.232, 0.234, 'dark')
    for x in (-0.18, 0.0, 0.18):
        m.tube((x, 0.8, 0.08), (x, 3.1, 0.08), 0.022, 'metal', seg=6)
    # The emergency lamp: a bulkhead over the cabinet, its lens red.
    m.box(-0.16, 0.16, 1.0, 1.12, 0.0, 0.08, 'dark', bevel=0.01)
    m.box(-0.13, 0.13, 1.02, 1.1, 0.08, 0.1, 'neon-red', bevel=0.008)
    return m


def bulb():
    """A bulb in a wire cage hanging from the ceiling (foot at the ceiling, down to -0.5): a ceiling rose, the flex, a
    bakelite holder, the bulb lit warm, the cage's bars and rings."""
    m = Model('rd-w3b-bulb')
    m.lathe(0, 0, [(0.05, -0.03), (0.05, 0.0), (0.0, 0.0)], 'dark', seg=10)
    m.tube((0, -0.03, 0), (0, -0.28, 0), 0.006, 'cable', seg=6)
    m.lathe(0, 0, [(0.025, -0.36), (0.028, -0.28), (0.0, -0.28)], 'dark', seg=10)
    m.lathe(0, 0, [(0.0, -0.49), (0.03, -0.48), (0.035, -0.44), (0.03, -0.4), (0.018, -0.37), (0.018, -0.36)], 'win-warm', seg=12)
    for y in (-0.36, -0.42, -0.5):
        for k in range(10):
            a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
            m.tube((0.055 * math.cos(a0), y, 0.055 * math.sin(a0)), (0.055 * math.cos(a1), y, 0.055 * math.sin(a1)), 0.003, 'metal', seg=4)
    for k in range(6):
        a = 2 * math.pi * k / 6
        m.tube((0.055 * math.cos(a), -0.36, 0.055 * math.sin(a)), (0.055 * math.cos(a), -0.5, 0.055 * math.sin(a)), 0.003, 'metal', seg=4)
    return m


def handrail(length, rise, key):
    """A stair's handrail of steel pipe along x, 0.9 m over the flight's line from its foot (x 0) to its top (x `length`,
    `rise` higher): the rail, its posts on the steps every 1.2 m, the rail's ends bent down."""
    m = Model(key)
    h = 0.9
    line = lambda x: x / length * rise
    m.tube((0.1, line(0.1) + h, 0.0), (length - 0.1, line(length - 0.1) + h, 0.0), 0.024, 'metal', seg=8)
    for x in (0.1, length - 0.1):
        m.tube((x, line(x) + h, 0.0), (x, line(x) + 0.1, 0.0), 0.024, 'metal', seg=8)
    n = max(2, int(length / 1.2))
    for k in range(n + 1):
        x = 0.3 + (length - 0.6) * k / n
        m.tube((x, line(x) - 0.12, 0.0), (x, line(x) + h, 0.0), 0.02, 'metal', seg=6)
        m.box(x - 0.05, x + 0.05, line(x) - 0.02, line(x), -0.05, 0.05, 'dark')
    return m


def brick(width, height, key):
    """Brick of the old tannery where the plaster has fallen off a wall: courses of bricks (0.25 x 0.065) with their
    mortar, the patch's edge ragged, a ring of the plaster's edge round it (`width` x `height`, its foot on its lowest
    course)."""
    m = Model(key)
    bw, bh, j = 0.25, 0.065, 0.012
    rows = int(height / (bh + j))
    for r in range(rows):
        y = r * (bh + j)
        # The patch is widest in its middle: a ragged ellipse.
        t = (r + 0.5) / rows * 2 - 1
        half = width / 2 * math.sqrt(max(0.0, 1 - t * t)) * (0.8 + 0.2 * hashf(r, 3.0))
        if half < bw:
            continue
        m.box(-half - 0.01, half + 0.01, y - j / 2, y + bh + j / 2, -0.01, 0.006, 'trim')
        x = -half + (bw / 2 if r % 2 else 0.0)
        while x + bw <= half:
            role = 'brick' if hashf(r, x) > 0.15 else 'rust'
            m.box(x + j / 2, x + bw - j / 2, y, y + bh, 0.006, 0.02, role)
            x += bw
    return m


def grate():
    """The culvert's grate swung open against the mouth's north wing wall: a frame of square tube, bars every 12 cm, two
    rails, the hinges at -x (the headwall's), the hasp at +x with its padlock hanging open (2 x 1.5)."""
    m = Model('rd-w3b-grate')
    w, h = 2.0, 1.45
    for y in (0.03, h - 0.03):
        m.box(-w / 2, w / 2, y - 0.03, y + 0.03, -0.03, 0.03, 'rust')
    for x in (-w / 2 + 0.03, w / 2 - 0.03):
        m.box(x - 0.03, x + 0.03, 0.0, h, -0.03, 0.03, 'rust')
    for y in (0.5, 0.95):
        m.box(-w / 2, w / 2, y - 0.02, y + 0.02, -0.02, 0.02, 'rust')
    k = 1
    while -w / 2 + k * 0.12 < w / 2 - 0.05:
        x = -w / 2 + k * 0.12
        m.tube((x, 0.06, 0.0), (x, h - 0.06, 0.0), 0.012, 'metal', seg=6)
        k += 1
    for y in (0.25, h - 0.25):
        m.tube((-w / 2 - 0.02, y - 0.08, 0.0), (-w / 2 - 0.02, y + 0.08, 0.0), 0.025, 'dark', seg=8)
    # The hasp and the padlock, open, its shackle up.
    m.box(w / 2 - 0.06, w / 2 + 0.04, 0.7, 0.8, 0.03, 0.04, 'dark')
    m.box(w / 2 - 0.02, w / 2 + 0.04, 0.6, 0.67, 0.04, 0.065, 'fabric-amber', bevel=0.006)
    m.tube((w / 2 - 0.01, 0.67, 0.052), (w / 2 - 0.01, 0.72, 0.052), 0.006, 'metal', seg=6)
    m.tube((w / 2 + 0.03, 0.67, 0.052), (w / 2 + 0.03, 0.7, 0.052), 0.006, 'metal', seg=6)
    return m


def stash():
    """The smugglers' cache in the crawl by its south wall: a wooden crate with its lid pushed aside, a torch and a spare
    battery pack in it, their sign in chalk on the wall over it (an arrow into a circle and three strokes) (0.7 x 1.0)."""
    m = Model('rd-w3b-stash')
    m.box(-0.22, 0.22, 0.0, 0.3, 0.02, 0.34, 'fabric-amber', bevel=0.01)
    for y in (0.08, 0.2):
        m.box(-0.225, 0.225, y, y + 0.02, 0.015, 0.345, 'rust')
    m.box(-0.2, 0.2, 0.0, 0.02, 0.04, 0.32, 'dark')
    m.box(0.05, 0.47, 0.3, 0.32, 0.03, 0.33, 'fabric-amber', bevel=0.006)
    m.tube((-0.15, 0.31, 0.15), (0.0, 0.31, 0.22), 0.022, 'dark', seg=10)
    m.tube((0.0, 0.31, 0.22), (0.02, 0.31, 0.23), 0.028, 'win-white', seg=10)
    m.box(-0.18, -0.06, 0.28, 0.34, 0.05, 0.12, 'trim', bevel=0.006)
    m.box(-0.17, -0.07, 0.34, 0.343, 0.06, 0.07, 'neon-blue')
    # The chalk sign on the wall (z 0): an arrow pointing down at a circle, three strokes beside it.
    c = 'win-white'
    y0, x0 = 0.75, -0.1
    for k in range(12):
        a0, a1 = 2 * math.pi * k / 12, 2 * math.pi * (k + 1) / 12
        m.tube((x0 + 0.09 * math.cos(a0), y0 + 0.09 * math.sin(a0), 0.004), (x0 + 0.09 * math.cos(a1), y0 + 0.09 * math.sin(a1), 0.004), 0.006, c, seg=4)
    m.tube((x0, y0 + 0.3, 0.004), (x0, y0 + 0.02, 0.004), 0.006, c, seg=4)
    m.tube((x0, y0 + 0.02, 0.004), (x0 - 0.05, y0 + 0.08, 0.004), 0.006, c, seg=4)
    m.tube((x0, y0 + 0.02, 0.004), (x0 + 0.05, y0 + 0.08, 0.004), 0.006, c, seg=4)
    for k in range(3):
        x = 0.12 + k * 0.05
        m.tube((x, y0 - 0.08, 0.004), (x + 0.01, y0 + 0.08, 0.004), 0.006, c, seg=4)
    return m


def water():
    """The silt and the water in the culvert's crawl (along x, 36.8 x 2 m): water ankle deep in the middle, banks of silt
    along both walls, a can, a bottle and a bag caught in it."""
    m = Model('rd-w3b-water')
    n, w = 36.8, 2.0
    m.box(-n / 2, n / 2, 0.0, 0.07, -w / 2 + 0.25, w / 2 - 0.25, 'glass-dark')
    for s in (-1, 1):
        k = 0
        x = -n / 2
        while x < n / 2:
            l = 1.5 + 1.5 * hashf(x, s)
            d = 0.22 + 0.12 * hashf(x, s, 2.0)
            z0, z1 = (-w / 2, -w / 2 + d) if s < 0 else (w / 2 - d, w / 2)
            m.box(x, min(n / 2, x + l), 0.0, 0.08 + 0.04 * hashf(x, 5.0), z0, z1, 'rust', bevel=0.02)
            x += l
            k += 1
    for x, z, role in ((-12.0, -0.6, 'neon-red'), (3.0, 0.65, 'metal'), (14.0, -0.55, 'neon-green')):
        m.tube((x, 0.09, z), (x + 0.1, 0.09, z + 0.04), 0.033, role, seg=10)
    m.tube((-4.0, 0.09, 0.7), (-3.75, 0.09, 0.62), 0.035, 'glass-blue', seg=10)
    m.box(8.0, 8.35, 0.06, 0.1, -0.75, -0.5, 'dark', bevel=0.02)
    return m


MODELS = [pipes, pump, panel, bulb, lambda: handrail(8.0, 4.5, 'rd-w3b-handrail-a'), lambda: handrail(6.0, 4.5, 'rd-w3b-handrail-b'),
          lambda: brick(2.2, 1.4, 'rd-w3b-brick-wide'), lambda: brick(1.3, 1.8, 'rd-w3b-brick-tall'), grate, stash, water]
