"""Brama Krakowska and its forecourt after the scene's card (`docs/lokacje/brama-krakowska.md`, ADR-0102 point 5,
ADR-0098): the Hebi scanner in the passage's vault, the dumpster under the annex with its lid propped on a bottle, what
lies behind it round Tetsu's stash, the side of the zapiekanki booth with its gas, the doorway Hideo sleeps in, the
drain grate old Sabu fishes through, the transformer of the gate's neon.

Sizes from the simulation (`packages/sim/src/content/brama-detail.ts`, `GATE_PASSAGES`): the passage is 3.6 m wide, its
vault springs about 3.1 m over the floor under the scanner and its crown is 4.35 m up; the dumpster is the solid's
2.2 x 1.3 x 1.2 m. Each model's foot is on y = 0 where it stands (the floor, a wall's foot), its front to +z; variations
from `hashf`, so the same script gives the same file. Comic realism (`docs/zasady-lokacji.md` §9): real parts, the
shapes of the things photographed in Lublin's gates and yards.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-brama-props.glb'

# The passage under the scanner (the model's frame: x across, +x the south jamb; z along the passage to the east).
HALF = 1.8
SPRING = 3.1
CROWN = 4.35
# The landmark draws the scanner's lit arch across the vault at z 0 (`layer2077.ts`): the emitter posts stand west of
# it, the camera further west under the crown, the control box east of it.
POST = -0.4
CAMERA = -0.75


def _box(m, xa, xb, y0, y1, z0, z1, role, bevel=0.0):
    """A box between two x in either order (a part on the north jamb mirrors the south one's)."""
    m.box(min(xa, xb), max(xa, xb), y0, y1, z0, z1, role, bevel)


def _vault(s):
    """The vault's height over the floor `s` metres off the axis (the lining's half ellipse, `passage-plan`)."""
    k = max(0.0, 1.0 - (s / HALF) ** 2)
    return SPRING + (CROWN - SPRING) * math.sqrt(k)


def scanner():
    """The Hebi checkpoint in the vault (ADR-0048): an emitter post bolted to each jamb with its lit window and LED
    ladder, the camera dome on a bracket under the crown with its red eye, the control box on the north jamb with its
    screen and the gang's snake sticker, the cable in a conduit along the springing to the east mouth, towards the post
    on Bramowa (3.6 x 4.35 x 6)."""
    m = Model('rd-bk-scanner')
    for s in (-1, 1):
        x = s * (HALF - 0.07)
        inner = x - s * 0.06
        # The post: a steel channel on three brackets, its window facing across the passage.
        for y in (0.35, 1.3, 2.25):
            m.box(x - 0.05, x + 0.05, y, y + 0.06, POST - 0.12, POST + 0.12, 'metal')
        _box(m, x, inner, 0.25, 2.35, POST - 0.09, POST + 0.09, 'trim', bevel=0.012)
        _box(m, inner - s * 0.006, inner, 0.45, 2.15, POST - 0.05, POST + 0.05, 'glass-dark')
        for k in range(9):
            y = 0.55 + k * 0.19
            _box(m, inner - s * 0.01, inner - s * 0.006, y, y + 0.06, POST - 0.03, POST + 0.03, 'neon-cyan' if k % 3 else 'neon-red')
        _box(m, x + s * 0.01, inner - s * 0.01, 2.35, 2.45, POST - 0.11, POST + 0.11, 'dark', bevel=0.01)
    # The camera under the crown: a plate on the vault, the arm, the housing and its dome, the red eye looking west.
    top = CROWN - 0.02
    cz = CAMERA
    m.box(-0.14, 0.14, top - 0.04, top, cz - 0.14, cz + 0.14, 'metal')
    m.cyl(0.0, cz, 0.03, top - 0.42, top - 0.04, 'metal', seg=8)
    m.box(-0.12, 0.12, top - 0.58, top - 0.42, cz - 0.16, cz + 0.16, 'trim', bevel=0.02)
    m.lathe(0.0, cz - 0.05, [(0.1, 0.0), (0.095, -0.05), (0.06, -0.1), (0.0, -0.115)], 'glass-dark', seg=14, y0=top - 0.58)
    m.box(-0.02, 0.02, top - 0.66, top - 0.62, cz - 0.13, cz - 0.09, 'neon-red')
    # Its cable down the vault to the north post's top.
    pts = [(0.0, top - 0.05, cz + 0.12)]
    for k in range(1, 6):
        s = -HALF * k / 5.6
        pts.append((s, _vault(abs(s)) - 0.05, cz + 0.12))
    pts.append((-(HALF - 0.1), 2.45, POST))
    for a, b in zip(pts, pts[1:]):
        m.tube(a, b, 0.012, 'cable', seg=6)
    # The control box on the north jamb: steel, a screen with the snake's eye, a key switch, a fault lamp.
    bx = -(HALF - 0.11)
    m.box(-HALF + 0.01, bx, 1.25, 1.8, 0.45, 0.85, 'trim-light', bevel=0.015)
    m.box(bx, bx + 0.006, 1.48, 1.72, 0.52, 0.78, 'dark')
    m.box(bx + 0.006, bx + 0.009, 1.52, 1.68, 0.55, 0.75, 'neon-red')
    m.box(bx, bx + 0.012, 1.32, 1.38, 0.56, 0.6, 'neon-amber')
    m.cyl(-HALF + 0.12, 0.72, 0.015, 1.31, 1.4, 'metal', seg=8)
    m.quad([(bx + 0.003, 1.29, 0.8), (bx + 0.003, 1.29, 0.66), (bx + 0.003, 1.43, 0.66), (bx + 0.003, 1.43, 0.8)], 'fabric-magenta')
    # The conduit from the box along the north jamb to the east mouth (the post), with its saddles.
    m.tube((-HALF + 0.05, 1.8, 0.65), (-HALF + 0.05, 2.75, 0.65), 0.022, 'pipe', seg=6)
    m.tube((-HALF + 0.05, 2.75, 0.65), (-HALF + 0.05, 2.75, 6.0), 0.022, 'pipe', seg=6)
    for k in range(11):
        z = 0.9 + k * 0.5
        m.box(-HALF + 0.01, -HALF + 0.08, 2.72, 2.78, z - 0.02, z + 0.02, 'metal')
    m.tube((-HALF + 0.05, 2.45, POST), (-HALF + 0.05, 2.75, 0.62), 0.012, 'cable', seg=6)
    return m


def dumpster():
    """The steel dumpster under the annex (2.2 m wide, 1.2 deep, 1.3 high: the solid's), front to +z: the body on four
    castors with its fork sleeves and front ribs, the rim, two plastic lids, the right one propped open on a bottle a
    moment ago (§5), black bags showing under it, the city's stencilled number, rust, a Hebi tag (2.2 x 1.55 x 1.2)."""
    m = Model('rd-bk-dumpster')
    w, d = 1.1, 0.6
    for x in (-0.85, 0.85):
        for z in (-0.4, 0.4):
            m.box(x - 0.05, x + 0.05, 0.1, 0.18, z - 0.05, z + 0.05, 'metal')
            m.tube((x - 0.03, 0.06, z), (x + 0.03, 0.06, z), 0.06, 'tyre', seg=10)
    m.box(-w, w, 0.18, 1.2, -d, d, 'dumpster', bevel=0.03)
    m.box(-w - 0.03, w + 0.03, 1.2, 1.25, -d - 0.03, d + 0.03, 'trim', bevel=0.01)
    for x in (-0.75, -0.25, 0.25, 0.75):
        m.box(x - 0.03, x + 0.03, 0.25, 1.15, d, d + 0.03, 'dumpster')
    # The fork sleeves on both sides and the handles over them.
    for s in (-1, 1):
        _box(m, s * (w - 0.02), s * (w + 0.06), 0.5, 0.68, -0.45, 0.45, 'trim')
        _box(m, s * w, s * (w + 0.04), 0.95, 1.0, -0.2, 0.2, 'metal')
    # The city's number stencilled on the front, rust round the castors and under the rim, a pink tag.
    m.box(-0.62, -0.12, 0.62, 0.8, d + 0.031, d + 0.033, 'paint')
    for k in range(5):
        x = -0.58 + k * 0.1
        m.box(x, x + 0.06, 0.65, 0.77, d + 0.033, d + 0.035, 'dark')
    for k in range(6):
        x = -1.0 + 2.0 * hashf(k, 3.0)
        y = 0.22 + 0.85 * hashf(k, 4.0)
        r = 0.05 + 0.07 * hashf(k, 5.0)
        m.box(x - r, x + r, y - r * 0.6, y + r * 0.6, d + 0.031, d + 0.034, 'rust')
    m.quad([(0.3, 0.35, d + 0.036), (0.95, 0.4, d + 0.036), (0.92, 0.6, d + 0.036), (0.33, 0.52, d + 0.036)], 'fabric-magenta')
    # The left lid shut, the right one up on the bottle wedged under its front edge (14 degrees).
    m.box(-w + 0.02, -0.01, 1.25, 1.3, -d - 0.02, d + 0.04, 'plant', bevel=0.01)
    hinge = (-d - 0.02, 1.28)
    a = math.radians(14)
    length = 2 * d + 0.06
    c = (0.55, hinge[1] + math.sin(a) * length / 2, hinge[0] + math.cos(a) * length / 2)
    m.obox(c, (1, 0, 0), (0, math.cos(a), -math.sin(a)), (0.54, 0.025, length / 2), 'plant', bevel=0.01)
    m.lathe(0.62, 0.5, [(0.035, 0.0), (0.036, 0.19), (0.016, 0.25), (0.013, 0.31), (0.0, 0.31)], 'glass-dark', seg=10, y0=1.22)
    m.lathe(0.62, 0.5, [(0.0365, 0.0), (0.0365, 0.06)], 'fabric-amber', seg=10, y0=1.31)
    for k, (x, z, r) in enumerate(((0.3, 0.1, 0.3), (0.75, -0.2, 0.28), (0.5, 0.35, 0.22))):
        m.lathe(x, z, [(0.0, 0.0), (r, r * 0.4), (r * 0.8, r * 0.8), (0.0, r * 0.95)], 'dark', seg=10, y0=1.0 + 0.02 * k)
    return m


def behind():
    """What lies behind the dumpster round the Hebi courier's stash (the bag itself is the game's loot, on the carton):
    two black bin bags, one torn and spilling wrappers and a cup, the flattened carton, a crushed can, butts, a
    zapiekanka's paper tray with its ketchup (§14's cluster at the stash). The dumpster's back is at z 0, the annex's
    front at -z slanting away towards -x: 0.6 m off at x 0, 1.1 m at x -1.1 (1.3 x 0.6 x 0.8)."""
    m = Model('rd-bk-behind')
    for x, z, r, h in ((-0.2, -0.3, 0.27, 0.55), (0.25, -0.22, 0.18, 0.42)):
        m.lathe(x, z, [(0.0, 0.0), (r, h * 0.15), (r * 1.05, h * 0.55), (r * 0.6, h * 0.9), (0.06, h), (0.0, h + 0.06)], 'dark', seg=12)
        m.lathe(x, z, [(0.05, h), (0.03, h + 0.1), (0.0, h + 0.12)], 'dark', seg=6)
    # The flattened carton the bag lies on.
    m.box(-0.95, -0.25, 0.0, 0.012, -0.7, -0.2, 'fabric-amber')
    m.box(-0.62, -0.58, 0.012, 0.014, -0.68, -0.22, 'dark')
    # The torn bag's spill: wrappers and a cup.
    for k in range(6):
        x = -0.05 + 0.3 * hashf(k, 1.0)
        z = -0.05 - 0.12 * hashf(k, 2.0)
        m.box(x - 0.05, x + 0.05, 0.0, 0.01, z - 0.04, z + 0.04, 'paint' if k % 2 else 'fabric-amber')
    m.lathe(0.05, -0.08, [(0.03, 0.0), (0.04, 0.1), (0.0, 0.1)], 'paint', seg=10)
    # The can, butts, the tray with ketchup.
    m.tube((0.42, 0.03, -0.1), (0.5, 0.04, -0.16), 0.03, 'neon-red', seg=10)
    for k in range(5):
        x = -0.9 + 0.8 * hashf(k, 6.0)
        z = -0.08 - 0.1 * hashf(k, 7.0)
        m.tube((x, 0.006, z), (x + 0.03, 0.006, z + 0.01), 0.0055, 'win-white', seg=6)
    m.box(-0.5, -0.28, 0.0, 0.02, -0.16, -0.06, 'paint')
    m.box(-0.47, -0.34, 0.02, 0.022, -0.14, -0.09, 'neon-red')
    return m


def booth_side():
    """The zapiekanki booth's side by the tenement's wall: the gas bottle chained to a hook with its regulator and hose
    into the booth, a crate of baguettes for the next ones, a stack of paper trays, the bin with napkins and cups over
    its rim (its sound: the hot plate and the gas, `simmer`) (1.2 x 1.2 x 0.9)."""
    m = Model('rd-bk-booth')
    # The gas bottle: body, collar, valve, regulator, hose up into the booth's side.
    m.lathe(-0.3, -0.2, [(0.0, 0.0), (0.15, 0.0), (0.155, 0.05), (0.155, 0.5), (0.12, 0.58), (0.045, 0.62), (0.0, 0.62)], 'neon-red', seg=14)
    m.lathe(-0.3, -0.2, [(0.06, 0.0), (0.06, 0.08), (0.0, 0.08)], 'metal', seg=10, y0=0.62)
    m.box(-0.34, -0.22, 0.7, 0.76, -0.24, -0.16, 'metal')
    m.tube((-0.22, 0.73, -0.2), (0.05, 0.9, -0.3), 0.012, 'dark', seg=6)
    m.tube((0.05, 0.9, -0.3), (0.1, 1.05, -0.42), 0.012, 'dark', seg=6)
    m.tube((-0.3, 0.45, -0.37), (-0.3, 0.8, -0.45), 0.006, 'metal', seg=4)
    # The crate of baguettes.
    m.box(0.05, 0.6, 0.0, 0.3, -0.05, 0.35, 'fabric-amber', bevel=0.01)
    m.box(0.08, 0.57, 0.27, 0.3, -0.02, 0.32, 'dark')
    for k in range(5):
        z = 0.0 + k * 0.065
        m.tube((0.1, 0.33, z), (0.55, 0.36, z + 0.02), 0.03, 'win-warm', seg=8)
    # The trays, stacked on the crate's corner, and the bin with its spill.
    for k in range(6):
        m.box(0.38, 0.58, 0.31 + k * 0.012, 0.32 + k * 0.012, 0.1, 0.3, 'paint')
    m.lathe(-0.15, 0.35, [(0.17, 0.0), (0.2, 0.62), (0.21, 0.62), (0.21, 0.66), (0.0, 0.66)], 'trim', seg=14)
    for k in range(4):
        a = k * 1.7
        x, z = -0.15 + 0.1 * math.cos(a), 0.35 + 0.1 * math.sin(a)
        m.lathe(x, z, [(0.03, 0.0), (0.04, 0.1), (0.0, 0.1)], 'paint' if k % 2 else 'fabric-amber', seg=8, y0=0.66)
    m.box(-0.05, 0.05, 0.0, 0.01, 0.6, 0.7, 'paint')
    return m


def doorway():
    """Where Hideo sleeps in the doorway on Bramowa (the wall at z 0, the street at +z): a cardboard mat, an army
    blanket kicked back, a rolled jacket for a pillow, the enamel mug, a plastic bag of his things, a can of the cheap
    one he drinks at SAKE (1.9 x 0.3 x 0.9)."""
    m = Model('rd-bk-doorway')
    m.box(-0.95, 0.95, 0.0, 0.012, 0.05, 0.85, 'fabric-amber')
    for k in range(3):
        x = -0.6 + k * 0.55
        m.box(x - 0.01, x + 0.01, 0.012, 0.014, 0.08, 0.82, 'dark')
    # The blanket in folds over the mat's east half.
    for k in range(5):
        x = 0.0 + k * 0.17
        h = 0.06 + 0.06 * hashf(k, 2.0)
        m.tube((x, h, 0.15), (x + 0.05, h * 0.8, 0.78), 0.07 + 0.02 * hashf(k, 3.0), 'plant', seg=10)
    m.box(-0.05, 0.9, 0.012, 0.05, 0.12, 0.82, 'plant', bevel=0.02)
    m.tube((-0.85, 0.1, 0.2), (-0.85, 0.1, 0.7), 0.1, 'trim', seg=10)
    m.lathe(-0.55, 0.88, [(0.04, 0.0), (0.045, 0.09), (0.0, 0.09)], 'paint', seg=12)
    m.tube((-0.5, 0.06, 0.88), (-0.49, 0.06, 0.88), 0.03, 'paint', seg=8)
    m.lathe(-0.7, 0.95, [(0.0, 0.0), (0.16, 0.05), (0.14, 0.2), (0.05, 0.28), (0.0, 0.3)], 'trim-light', seg=10)
    m.tube((-0.25, 0.03, 0.95), (-0.15, 0.03, 1.0), 0.03, 'neon-amber', seg=10)
    return m


def grate():
    """The cast iron gully grate in Bramowa's gutter old Sabu fishes the Czechówka through (enc_kanal_fisherman): its frame
    sunk flush with the cobbles, the bars across, the dark of the culvert under them, a wet sheen round it
    (0.8 x 0.02 x 0.5)."""
    m = Model('rd-bk-grate')
    m.lathe(0.0, 0.0, [(0.55, 0.0), (0.0, 0.0015)], 'glass-blue', seg=16)
    m.box(-0.4, 0.4, 0.0, 0.012, -0.25, 0.25, 'metal')
    m.box(-0.34, 0.34, 0.012, 0.013, -0.19, 0.19, 'dark')
    for k in range(9):
        x = -0.32 + k * 0.08
        m.box(x - 0.018, x + 0.018, 0.012, 0.02, -0.19, 0.19, 'trim')
    m.box(-0.34, 0.34, 0.012, 0.02, -0.015, 0.015, 'trim')
    return m


def neon_box():
    """The transformer of the gate's neon lines on the annex's wall (the wall at z 0): a grey steel box on brackets with
    its warning sticker and vents, the thick cables up the brick to the cornice in their clips, buzzing (`hum`)
    (0.5 x 5 x 0.25)."""
    m = Model('rd-bk-neon-box')
    m.box(-0.25, 0.25, 2.3, 2.95, 0.02, 0.24, 'trim-light', bevel=0.015)
    for y in (2.4, 2.85):
        m.box(-0.2, 0.2, y - 0.02, y + 0.02, 0.0, 0.04, 'metal')
    m.box(-0.07, 0.07, 2.62, 2.75, 0.24, 0.243, 'neon-amber')
    for k in range(4):
        y = 2.4 + k * 0.05
        m.box(-0.18, -0.02, y, y + 0.02, 0.24, 0.245, 'dark')
    for x in (-0.12, 0.12):
        m.tube((x, 2.95, 0.12), (x, 3.05, 0.06), 0.018, 'cable', seg=6)
        m.tube((x, 3.05, 0.06), (x * 1.6, 7.2, 0.05), 0.018, 'cable', seg=6)
    for y in (3.6, 4.4, 5.2, 6.0, 6.8):
        m.box(-0.25, 0.25, y, y + 0.03, 0.0, 0.08, 'metal')
    return m


MODELS = [scanner, dumpster, behind, booth_side, doorway, grate, neon_box]
