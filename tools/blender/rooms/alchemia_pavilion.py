"""The roof of Alchemia's triangular pavilion, where Ren Odagiri sleeps rough in act II (`docs/lokacje/alchemia-pawilon-dach.md`,
ADR-0102, ADR-0098): his camp (a mattress on two pallets, an ammunition crate for a table with what he keeps on it, the
mast with a dish and the pole the tarp is tied to, the bucket under its low corner), the roof's services (the kitchen's
exhaust fan over the back-of-house box, the neon's sealed transformer box at the sign's post), and what marks the way up
(the green bulkhead lamp over the ladder's foot, the Hebi snake sprayed on the box, a carabiner on the ladder's head).

Sizes from the simulation (`packages/sim/src/content/alchemia/pavilion-roof-dress.ts`): the attic 1.0 m high and 0.25 thick,
the sign's board from 1.0 to 2.2 m over the roof, the tarp tied to the mast at 2.0 m and to the pole at 1.75 m. Each model's
foot is on y = 0 where it stands (the roof, the ground, a wall's spot), its front to +z (for what stands against the attic,
away from it).
"""
import math

from mathutils import Vector
from shapes import Model, _b, hashf

FILE = 'room-detail-alchemia-props.glb'


def _dish(m, centre, axis, radius, depth, role, seg=16, rings=3):
    """A dish of revolution round `axis` (any direction): its rim `depth` forward of its middle, two-sided (a thin shell)."""
    a = Vector(axis).normalized()
    up = Vector((0.0, 1.0, 0.0)) if abs(a.y) < 0.9 else Vector((1.0, 0.0, 0.0))
    u = a.cross(up).normalized()
    w = a.cross(u)
    c = Vector(centre)
    faces = []
    for back in (0.0, 0.012):
        rows = []
        for i in range(rings + 1):
            t = i / rings
            ring = []
            for k in range(seg):
                ang = 2 * math.pi * k / seg
                p = c + a * (depth * t * t - back) + (u * math.cos(ang) + w * math.sin(ang)) * (radius * max(t, 0.02))
                ring.append(m.bm.verts.new(_b(p.x, p.y, p.z)))
            rows.append(ring)
        for i in range(rings):
            r0, r1 = rows[i], rows[i + 1]
            for k in range(seg):
                quad = [r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]]
                faces.append(m.bm.faces.new(quad if back else list(reversed(quad))))
    m._finish(faces, role)


def _pallet(m, cx):
    """A EUR pallet (1.2 x 0.8 x 0.144) along x round (cx, 0): five deck boards on three cross boards over nine blocks on
    three bottom boards, the timber grey with weather."""
    for k, (z, w) in enumerate(((-0.3275, 0.145), (-0.17, 0.1), (0.0, 0.145), (0.17, 0.1), (0.3275, 0.145))):
        m.box(cx - 0.6, cx + 0.6, 0.122, 0.144, z - w / 2, z + w / 2, 'trim-light' if k % 2 else 'wall-dark', bevel=0.003)
    for x in (-0.5275, 0.0, 0.5275):
        m.box(cx + x - 0.0725, cx + x + 0.0725, 0.1, 0.122, -0.4, 0.4, 'trim-light')
        for z in (-0.3275, 0.0, 0.3275):
            m.box(cx + x - 0.0725, cx + x + 0.0725, 0.022, 0.1, z - 0.05, z + 0.05, 'wall-dark')
    for z in (-0.3275, 0.0, 0.3275):
        m.box(cx - 0.6, cx + 0.6, 0.0, 0.022, z - 0.0725, z + 0.0725, 'trim-light')


def bed():
    """Ren's bed along the sign's board: two pallets end to end, a single foam mattress (0.8 x 1.95) with a water stain on
    it, an olive sleeping bag unzipped and thrown back (he got up a moment ago, §5), a rolled jacket for a pillow at the
    west end, a phone charging cable trailing off it (2.4 x 0.42 x 0.8)."""
    m = Model('rd-ren-bed')
    _pallet(m, -0.6)
    _pallet(m, 0.6)
    y = 0.144
    m.box(-1.0, 0.95, y, y + 0.13, -0.4, 0.4, 'trim-light', bevel=0.04)
    m.box(-0.2, 0.25, y + 0.13, y + 0.132, -0.3, -0.05, 'rust')
    top = y + 0.13
    # The sleeping bag: its foot half flat on the mattress, its top thrown back in folds towards the wall.
    m.box(0.05, 0.92, top, top + 0.06, -0.36, 0.34, 'plant', bevel=0.025)
    m.box(-0.75, 0.1, top, top + 0.035, 0.05, 0.38, 'plant', bevel=0.015)
    for k in range(3):
        x = -0.6 + k * 0.28
        m.tube((x, top + 0.05, 0.08), (x + 0.22, top + 0.07, 0.36), 0.045, 'plant', seg=8)
    m.box(-0.75, 0.92, top + 0.035, top + 0.04, 0.33, 0.345, 'dark')
    # The jacket rolled up for a pillow, its sleeve hanging off the mattress.
    m.tube((-0.9, top + 0.07, -0.3), (-0.9, top + 0.07, 0.3), 0.07, 'dark', seg=10)
    m.tube((-0.95, top + 0.05, 0.3), (-1.05, y - 0.02, 0.36), 0.035, 'dark', seg=8)
    # A charging cable off the pillow down the pallet's end to the roof.
    for a, b in (((-0.85, top + 0.01, -0.36), (-1.05, top - 0.04, -0.42)), ((-1.05, top - 0.04, -0.42), (-1.2, 0.01, -0.45))):
        m.tube(a, b, 0.004, 'cable', seg=4)
    return m


def table():
    """The ammunition crate Ren uses for a table, lying on the roof: an olive wooden crate with its battens, rope handles,
    steel latches and a stencilled lot number, and on its lid what he keeps by him (§14's cluster): a camping LED lantern
    lit warm (the camp's light, §13), a steel thermos, two cans of an energy drink (one open, sweating), a tin of cigarette
    ends, a chip reader blinking green on a cable down to a power bank on the roof (0.7 x 0.65 x 0.4)."""
    m = Model('rd-ren-table')
    h = 0.42
    m.box(-0.35, 0.35, 0.0, h, -0.2, 0.2, 'plant', bevel=0.008)
    for x in (-0.33, 0.33):
        m.box(x - 0.025, x + 0.025, 0.0, h + 0.004, -0.205, 0.205, 'dark')
    m.box(-0.35, 0.35, h - 0.06, h + 0.004, -0.205, -0.195, 'dark')
    m.box(-0.35, 0.35, h - 0.06, h + 0.004, 0.195, 0.205, 'dark')
    for x in (-0.36, 0.36):
        m.tube((x, 0.22, -0.08), (x + math.copysign(0.03, x), 0.2, 0.0), 0.01, 'fabric-amber', seg=6)
        m.tube((x + math.copysign(0.03, x), 0.2, 0.0), (x, 0.22, 0.08), 0.01, 'fabric-amber', seg=6)
    for x in (-0.18, 0.18):
        m.box(x - 0.03, x + 0.03, h - 0.09, h - 0.02, 0.2, 0.215, 'metal')
    m.box(-0.12, 0.12, 0.12, 0.2, 0.205, 0.207, 'trim-light')
    m.box(-0.08, 0.04, 0.24, 0.27, 0.205, 0.207, 'trim-light')
    # The lantern at the west end: its base, the warm diffuser, the cap and its wire handle.
    lx, lz = -0.2, 0.04
    m.cyl(lx, lz, 0.055, h, h + 0.03, 'dark', seg=14)
    m.lathe(lx, lz, [(0.048, 0.0), (0.05, 0.06), (0.048, 0.12)], 'win-warm', seg=14, y0=h + 0.03)
    m.lathe(lx, lz, [(0.055, 0.0), (0.045, 0.025), (0.0, 0.03)], 'dark', seg=14, y0=h + 0.15)
    m.tube((lx - 0.04, h + 0.18, lz), (lx, h + 0.24, lz), 0.004, 'metal', seg=4)
    m.tube((lx, h + 0.24, lz), (lx + 0.04, h + 0.18, lz), 0.004, 'metal', seg=4)
    # The thermos with its cup for a lid, at the east end.
    m.lathe(0.24, -0.07, [(0.04, 0.0), (0.042, 0.02), (0.042, 0.25), (0.03, 0.27)], 'metal', seg=14, y0=h)
    m.lathe(0.24, -0.07, [(0.045, 0.0), (0.045, 0.05), (0.0, 0.05)], 'dark', seg=14, y0=h + 0.27)
    # Two cans: one standing open with drops on it, one crushed on its side.
    m.lathe(0.07, 0.1, [(0.033, 0.0), (0.033, 0.115), (0.027, 0.125), (0.0, 0.125)], 'fabric-magenta', seg=14, y0=h)
    m.box(0.05, 0.09, h + 0.04, h + 0.08, 0.133, 0.134, 'neon-green')
    for k in range(5):
        a = 2 * math.pi * hashf(k, 1.0)
        m.box(0.07 + 0.034 * math.cos(a) - 0.003, 0.07 + 0.034 * math.cos(a) + 0.003, h + 0.02 + 0.08 * hashf(k, 2.0), h + 0.026 + 0.08 * hashf(k, 2.0), 0.1 + 0.034 * math.sin(a) - 0.003, 0.1 + 0.034 * math.sin(a) + 0.003, 'win-white')
    m.tube((0.16, h + 0.03, 0.12), (0.24, h + 0.025, 0.16), 0.028, 'fabric-magenta', seg=10)
    # The tin of cigarette ends.
    m.lathe(0.02, -0.11, [(0.045, 0.0), (0.045, 0.045), (0.04, 0.045), (0.0, 0.04)], 'metal', seg=14, y0=h)
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.4
        x, z = 0.02 + 0.022 * math.cos(a), -0.11 + 0.022 * math.sin(a)
        m.tube((x, h + 0.035, z), (x + 0.012 * math.cos(a), h + 0.06, z + 0.012 * math.sin(a)), 0.004, 'trim-light' if k % 2 else 'rust', seg=4)
    # The chip reader with its green light and a chip in its foil in the slot, the cable over the crate's edge to the power bank.
    m.box(-0.1, -0.01, h, h + 0.025, -0.16, -0.1, 'dark', bevel=0.004)
    m.box(-0.025, -0.015, h + 0.025, h + 0.03, -0.12, -0.11, 'neon-green')
    m.box(-0.09, -0.05, h + 0.02, h + 0.05, -0.161, -0.158, 'glass-blue')
    pts = [(-0.1, h + 0.012, -0.13), (-0.25, h + 0.004, -0.15), (-0.34, h - 0.005, -0.2), (-0.37, h - 0.2, -0.24), (-0.38, 0.01, -0.3), (-0.3, 0.008, -0.38)]
    for a, b in zip(pts, pts[1:]):
        m.tube(a, b, 0.004, 'cable', seg=4)
    m.box(-0.3, -0.16, 0.0, 0.025, -0.45, -0.38, 'trim', bevel=0.005)
    m.box(-0.29, -0.27, 0.025, 0.027, -0.43, -0.42, 'neon-blue')
    return m


def mast():
    """The mast by the attic the tarp's west corner is tied to: a galvanised pipe clamped to the attic's inner face by two
    wall brackets, a small offset satellite dish near its top looking south over the camp, its coax down the pipe and off
    to the pavilion's roof light well, a tarp's rope knotted round it at 2 m (0.7 x 2.1 x 0.6). The attic is behind it at
    z -0.07; `DISH_TURN` turns the dish from the model's +z towards its +x, so that at the mast's yaw (2.29 rad, the
    attic's inward normal) it faces the world's south."""
    m = Model('rd-ren-mast')
    m.tube((0.0, 0.0, 0.0), (0.0, 2.08, 0.0), 0.024, 'metal', seg=10)
    m.lathe(0.0, 0.0, [(0.03, 0.0), (0.0, 0.004)], 'dark', seg=10, y0=2.08)
    for y in (0.35, 0.85):
        m.box(-0.05, 0.05, y - 0.03, y + 0.03, -0.07, -0.02, 'metal')
        m.tube((0.0, y, -0.03), (0.0, y, 0.03), 0.032, 'metal', seg=10)
        for x in (-0.035, 0.035):
            m.tube((x, y + 0.02, -0.07), (x, y + 0.02, -0.06), 0.006, 'dark', seg=4)
    turn = DISH_TURN
    ax = (math.sin(turn) * math.cos(0.5), math.sin(0.5), math.cos(turn) * math.cos(0.5))
    arm = Vector((math.sin(turn), 0.0, math.cos(turn)))
    c = Vector((0.0, 1.62, 0.0)) + arm * 0.14
    m.tube((0.0, 1.62, 0.0), tuple(c), 0.012, 'metal', seg=6)
    _dish(m, tuple(c), ax, 0.3, 0.07, 'trim-light', seg=18)
    lnb = c + Vector(ax) * 0.38 + Vector((0.0, -0.12, 0.0))
    m.tube(tuple(c + Vector((0.0, -0.22, 0.0))), tuple(lnb), 0.008, 'metal', seg=6)
    m.tube(tuple(lnb), tuple(lnb + Vector(ax) * -0.06), 0.022, 'dark', seg=10)
    for a, b in (((0.03, 1.55, 0.02), (0.03, 0.05, 0.02)), ((0.03, 0.05, 0.02), (0.2, 0.0, 0.25)), ((0.2, 0.0, 0.25), (0.55, 0.0, 0.6))):
        m.tube(a, b, 0.004, 'cable', seg=4)
    for k in range(3):
        y = 1.97 + 0.02 * k
        m.tube((-0.03, y, -0.01), (0.03, y + 0.01, 0.02), 0.009, 'fabric-amber', seg=6)
    return m


# The dish's turn from the model's +z towards its +x (see `mast`): the world's south at the mast's yaw of 2.291 rad.
DISH_TURN = math.atan2(math.sin(2.291), -math.cos(2.291))


def pole():
    """The pole the tarp's east corner is tied to: a length of rusty scaffold tube stood in a cinder block and lashed to the
    attic's inner face (behind its block at z -0.1) with two ratchet straps round it, the tarp's rope knotted at its top (0.4 x 1.8 x 0.4)."""
    m = Model('rd-ren-pole')
    m.box(-0.195, 0.195, 0.0, 0.19, -0.095, 0.095, 'trim-light', bevel=0.01)
    m.box(-0.06, 0.06, 0.188, 0.19, -0.06, 0.06, 'dark')
    m.tube((0.0, 0.0, 0.0), (0.0, 1.8, 0.0), 0.024, 'rust', seg=10)
    for y in (0.55, 0.9):
        m.box(-0.035, 0.035, y - 0.025, y + 0.025, -0.36, 0.03, 'neon-amber')
        m.box(-0.04, 0.04, y - 0.03, y + 0.03, 0.02, 0.06, 'metal')
    for k in range(3):
        y = 1.72 + 0.02 * k
        m.tube((-0.03, y, -0.02), (0.03, y + 0.01, 0.02), 0.009, 'fabric-amber', seg=6)
    return m


def bucket():
    """The bucket under the tarp's low corner, the water of the night's rain dripping into it (§5): a green 10 l plastic
    bucket with its steel handle, half full, drops falling from the corner 1.75 m over it, a ring of wet round it."""
    m = Model('rd-ren-bucket')
    m.lathe(0.0, 0.0, [(0.115, 0.0), (0.14, 0.25), (0.15, 0.26), (0.145, 0.26), (0.108, 0.015), (0.0, 0.015)], 'dumpster', seg=16)
    m.lathe(0.0, 0.0, [(0.13, 0.0), (0.0, 0.0)], 'glass-blue', seg=16, y0=0.16)
    m.tube((-0.145, 0.24, 0.0), (0.0, 0.36, 0.0), 0.004, 'metal', seg=4)
    m.tube((0.0, 0.36, 0.0), (0.145, 0.24, 0.0), 0.004, 'metal', seg=4)
    for k, y in enumerate((0.45, 0.8, 1.2, 1.6)):
        r = 0.006 + 0.002 * (k % 2)
        m.lathe(0.0, 0.0, [(r * 0.6, 0.0), (r, 0.01), (0.0, 0.025)], 'win-white', seg=6, y0=y)
    m.lathe(0.0, 0.0, [(0.32, 0.0), (0.0, 0.002)], 'glass-blue', seg=18)
    return m


def extractor():
    """The restaurant kitchen's exhaust fan over the back-of-house box (`docs/lokacje/alchemia-pawilon-dach.md`): an
    upblast fan on its curb, the aluminium windband open at the top over the fan's blades, the motor's dome, a grease
    stain round the curb on the membrane, the vapour of the kitchen rising out of it (0.9 x 1.6 x 0.9)."""
    m = Model('rd-pav-extractor')
    m.lathe(0.0, 0.0, [(0.62, 0.0), (0.0, 0.002)], 'rust', seg=18)
    m.box(-0.42, 0.42, 0.0, 0.32, -0.42, 0.42, 'trim', bevel=0.012)
    m.box(-0.45, 0.45, 0.32, 0.36, -0.45, 0.45, 'ac', bevel=0.006)
    m.lathe(0.0, 0.0, [(0.36, 0.0), (0.4, 0.05), (0.4, 0.08), (0.3, 0.16), (0.3, 0.42), (0.33, 0.48), (0.33, 0.5)], 'ac', seg=20, y0=0.36, cap=False)
    m.lathe(0.0, 0.0, [(0.29, 0.0), (0.0, 0.0)], 'ac-grille', seg=20, y0=0.7)
    for k in range(6):
        a = k * math.pi / 3 + 0.3
        m.obox((0.15 * math.cos(a), 0.72, 0.15 * math.sin(a)), (math.cos(a), 0.0, math.sin(a)), (-0.33 * math.sin(a), 0.94, 0.33 * math.cos(a)), (0.13, 0.008, 0.05), 'dark')
    m.cyl(0.0, 0.0, 0.06, 0.66, 0.76, 'dark', seg=12)
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        m.tube((0.31 * math.cos(a), 0.78, 0.31 * math.sin(a)), (0.06 * math.cos(a), 0.74, 0.06 * math.sin(a)), 0.01, 'metal', seg=4)
    m.box(0.3, 0.42, 0.12, 0.24, 0.42, 0.425, 'neon-amber')
    m.tube((-0.42, 0.18, 0.1), (-0.6, 0.02, 0.1), 0.012, 'cable', seg=6)
    # The vapour: wisps leaning with the wind off the windband, thinning upwards.
    for k, (dx, dz) in enumerate(((-0.1, 0.05), (0.08, -0.06), (0.0, 0.12))):
        y = 0.88
        x, z = dx, dz
        for i in range(6):
            nx, nz, ny = x + 0.03 + 0.015 * hashf(k, i), z + 0.01 * (hashf(i, k) - 0.5), y + 0.12
            m.tube((x, y, z), (nx, ny, nz), 0.018 * (1 - i / 7), 'win-white', seg=5)
            x, z, y = nx, nz, ny
    return m


def neon_box():
    """The neon's transformer behind the sign's west post: a grey steel box on two feet with its door shut and sealed with a
    wire and a lead seal, a high-voltage sticker, its supply up out of a gooseneck through the membrane, the conduit up the
    post into the board with the joint wrapped in black tape (0.45 x 1.05 x 0.45; the post at x -0.25, z -0.28)."""
    m = Model('rd-pav-neon-box')
    for x in (-0.15, 0.15):
        m.box(x - 0.02, x + 0.02, 0.0, 0.08, -0.1, 0.1, 'dark')
    m.box(-0.2, 0.2, 0.08, 0.5, -0.12, 0.12, 'trim-light', bevel=0.01)
    m.box(-0.185, 0.185, 0.1, 0.48, 0.12, 0.123, 'trim-light')
    m.box(0.15, 0.17, 0.26, 0.32, 0.123, 0.14, 'dark')
    m.box(-0.08, 0.04, 0.36, 0.44, 0.123, 0.125, 'neon-amber')
    m.box(-0.06, 0.02, 0.38, 0.42, 0.125, 0.126, 'dark')
    m.tube((0.17, 0.3, 0.14), (0.21, 0.24, 0.16), 0.002, 'metal', seg=4)
    m.cyl(0.21, 0.16, 0.012, 0.21, 0.235, 'trim', seg=8)
    m.tube((0.0, 0.0, -0.1), (0.0, 0.2, -0.1), 0.02, 'pipe', seg=8)
    m.tube((0.0, 0.2, -0.1), (0.0, 0.26, -0.13), 0.02, 'pipe', seg=8)
    # The conduit from the box's top to the post and up it into the board's underside (1.0 m over the roof).
    m.tube((-0.12, 0.5, -0.06), (-0.12, 0.62, -0.2), 0.014, 'pipe', seg=8)
    m.tube((-0.12, 0.62, -0.2), (-0.12, 1.0, -0.2), 0.014, 'pipe', seg=8)
    for y in (0.7, 0.88):
        m.box(-0.2, -0.105, y - 0.012, y + 0.012, -0.25, -0.185, 'dark')
    m.tube((-0.12, 0.9, -0.2), (-0.12, 0.99, -0.2), 0.021, 'dark', seg=8)
    m.box(-0.16, -0.06, 0.93, 0.96, -0.215, -0.195, 'tyre')
    return m


def bulkhead():
    """The bulkhead lamp at the back-of-house box's north-west corner, over the ladder's foot and the service door (§13:
    the way up in the green of the ways): a cast body with its green lens behind a wire cage, its conduit up the wall to a
    junction box (0.24 x 0.6 x 0.12; its back on the wall at z 0)."""
    m = Model('rd-pav-bulkhead')
    m.box(-0.12, 0.12, 0.0, 0.16, 0.0, 0.06, 'dark', bevel=0.02)
    m.box(-0.095, 0.095, 0.025, 0.135, 0.06, 0.085, 'neon-green', bevel=0.01)
    for x in (-0.06, 0.0, 0.06):
        m.tube((x, 0.02, 0.09), (x, 0.14, 0.09), 0.004, 'metal', seg=4)
    m.tube((-0.1, 0.08, 0.09), (0.1, 0.08, 0.09), 0.004, 'metal', seg=4)
    m.tube((0.0, 0.16, 0.02), (0.0, 0.48, 0.02), 0.01, 'pipe', seg=6)
    m.box(-0.06, 0.06, 0.48, 0.6, 0.0, 0.05, 'trim', bevel=0.006)
    return m


def hebi():
    """The Hebi's snake sprayed on the back-of-house box by the ladder (the gang's mark over Ren's way up): a green body in an
    S, outlined black, its head with fangs and a red eye, a tag under it (1.3 x 0.7; on the wall at z 0)."""
    m = Model('rd-pav-hebi')
    pts = []
    n = 16
    for k in range(n + 1):
        t = k / n
        pts.append((-0.6 + 1.1 * t, 0.42 + 0.17 * math.sin(t * 2.2 * math.pi), 0.0))
    for k, (a, b) in enumerate(zip(pts, pts[1:])):
        r = 0.035 + 0.035 * math.sin(math.pi * min(1.0, (k + 1) / n * 1.2))
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy)
        nx, ny = -dy / ln, dx / ln
        for role, rr, z in (('dark', r + 0.018, 0.004), ('plant', r, 0.008)):
            m.quad([(a[0] + nx * rr, a[1] + ny * rr, z), (a[0] - nx * rr, a[1] - ny * rr, z), (b[0] - nx * rr, b[1] - ny * rr, z), (b[0] + nx * rr, b[1] + ny * rr, z)], role)
    hx, hy = pts[-1][0], pts[-1][1]
    m.quad([(hx - 0.02, hy - 0.08, 0.006), (hx + 0.16, hy - 0.05, 0.006), (hx + 0.18, hy + 0.04, 0.006), (hx - 0.02, hy + 0.09, 0.006)], 'dark')
    m.quad([(hx, hy - 0.06, 0.01), (hx + 0.14, hy - 0.035, 0.01), (hx + 0.155, hy + 0.03, 0.01), (hx, hy + 0.07, 0.01)], 'plant')
    m.quad([(hx + 0.08, hy + 0.01, 0.012), (hx + 0.11, hy + 0.01, 0.012), (hx + 0.11, hy + 0.035, 0.012), (hx + 0.08, hy + 0.035, 0.012)], 'neon-red')
    for dx in (0.1, 0.14):
        m.quad([(hx + dx, hy - 0.05, 0.012), (hx + dx, hy - 0.11, 0.012), (hx + dx + 0.006, hy - 0.11, 0.012), (hx + dx + 0.012, hy - 0.05, 0.012)], 'win-white')
    m.quad([(hx + 0.17, hy - 0.004, 0.012), (hx + 0.26, hy - 0.03, 0.012), (hx + 0.26, hy - 0.018, 0.012), (hx + 0.17, hy + 0.006, 0.012)], 'neon-red')
    # The tag under it: strokes of a writer's name and a drip.
    for k in range(5):
        x = -0.45 + k * 0.17
        h = 0.08 + 0.06 * hashf(k, 3.0)
        m.quad([(x, 0.08, 0.006), (x + 0.025, 0.08, 0.006), (x + 0.09, 0.08 + h, 0.006), (x + 0.065, 0.08 + h, 0.006)], 'dark')
    m.quad([(0.2, 0.0, 0.006), (0.212, 0.0, 0.006), (0.212, 0.1, 0.006), (0.2, 0.1, 0.006)], 'plant')
    return m


def carabiner():
    """A steel carabiner clipped to the ladder's rail at its head with a short red sling tied off (Ren's, to hang his bag
    while he climbs), on the rail at x 0 (0.1 x 0.3 x 0.05)."""
    m = Model('rd-pav-carabiner')
    pts = [(0.0, 0.0), (0.03, 0.01), (0.04, 0.05), (0.035, 0.1), (0.0, 0.11), (-0.02, 0.09), (-0.02, 0.02), (0.0, 0.0)]
    for a, b in zip(pts, pts[1:]):
        m.tube((a[0], 0.2 + a[1], 0.03), (b[0], 0.2 + b[1], 0.03), 0.005, 'metal', seg=6)
    m.tube((0.0, 0.2, 0.03), (-0.01, 0.05, 0.04), 0.008, 'neon-red', seg=6)
    m.tube((-0.01, 0.05, 0.04), (0.02, 0.0, 0.045), 0.008, 'neon-red', seg=6)
    m.tube((-0.03, 0.31, 0.0), (0.03, 0.31, 0.06), 0.008, 'neon-red', seg=6)
    return m


MODELS = [bed, table, mast, pole, bucket, extractor, neon_box, bulkhead, hebi, carabiner]
