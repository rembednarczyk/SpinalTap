"""Plac Litewski's scene (`docs/lokacje/plac-litewski.md`, ADR-0102): the wreck Seki was pulled out of at the mouth of
Kapucyńska and what the night left round it, the things by the van on the square's east edge and under Shiro's lamp.

Environmental storytelling ("what happened here", Smith and Worch, GDC 2010) after the ink (`recall_crash_night`,
`recall_last_call`) and Mori's words (glass, a piece of a seat belt, someone else's cable): the car that came out of
Kapucyńska, hit the pastoral lamp with the drone and ended on its roof; the rescuers cut the belts and left the driver's
door open; someone took the radio out of the dash since; the street lit candles.

The wreck is the game's own car (`veh-dirty`, `vehicle-props.glb`, CC-BY 4.0 by 3D Error 404, credited there) turned on
its roof, the roof crushed down over the driver's side, the driver's door open on its hinge, the glass on that side gone,
the windscreen crazed, the front's lights smashed and the rear's still lit (the battery lives). The bent pastoral repeats
the engine's lamp (`packages/engine/src/renderer/mapcity/prop-lamps.ts`, `lampPastoral`) at its sizes, bent at the
bumper's height over the car. Each model's foot is on y = 0 where it stands, its front to +z.
"""
import math

from game_models import triangles
from shapes import Model, hashf

FILE = 'room-detail-krakowskie-props.glb'

# The wreck: the car's sill line, where the roof's crush starts (m over the ground, upright).
BELT = 0.86
# The driver's door (upright, the car's left, -x) and its hinge at the A pillar.
DOOR = {'x': -0.55, 'z0': -0.42, 'z1': 0.72, 'y0': 0.18, 'y1': 0.9}
HINGE = (-0.84, 0.72)
DOOR_OPEN = math.radians(65)
# The nose down onto the paving (rad).
PITCH = math.radians(3.0)


def _box_tris(x0, x1, y0, y1, z0, z1, role):
    """An axis-aligned box as twelve triangles wound outwards (the frame of `game_models.triangles`)."""
    c = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    out = []
    for a, b, cc, d in quads:
        out.append(((c[a], c[b], c[cc]), role))
        out.append(((c[a], c[cc], c[d]), role))
    return out


def _tube_tris(p0, p1, r, role, seg=8):
    """A closed cylinder between two points (upright frame) as triangles wound outwards."""
    d = [p1[i] - p0[i] for i in range(3)]
    n = math.sqrt(sum(v * v for v in d))
    d = [v / n for v in d]
    up = (0.0, 1.0, 0.0) if abs(d[1]) < 0.9 else (1.0, 0.0, 0.0)
    u = (d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0])
    un = math.sqrt(sum(v * v for v in u))
    u = [v / un for v in u]
    w = (d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0])
    ring = lambda c, k: tuple(c[i] + r * (math.cos(2 * math.pi * k / seg) * u[i] + math.sin(2 * math.pi * k / seg) * w[i]) for i in range(3))
    out = []
    for k in range(seg):
        a0, a1, b0, b1 = ring(p0, k), ring(p0, k + 1), ring(p1, k), ring(p1, k + 1)
        out += [((a0, a1, b1), role), ((a0, b1, b0), role), ((tuple(p0), a1, a0), role), ((tuple(p1), b0, b1), role)]
    # Wound by the outward test: each triangle turned so its normal leaves the axis.
    fixed = []
    for (a, b, c), ro in out:
        m = tuple((a[i] + b[i] + c[i]) / 3 for i in range(3))
        t = sum((m[i] - p0[i]) * d[i] for i in range(3))
        foot = tuple(p0[i] + d[i] * t for i in range(3))
        cap = t < 1e-6 or t > n - 1e-6
        o = tuple(d[i] * (-1 if t < 1e-6 else 1) for i in range(3)) if cap else tuple(m[i] - foot[i] for i in range(3))
        cr = _cross([b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)])
        fixed.append(((a, b, c) if sum(cr[i] * o[i] for i in range(3)) > 0 else (a, c, b), ro))
    return fixed


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _underbody():
    """What the car shows of its underside on its roof, upright: the exhaust with its silencer, the rear axle and the
    tank, the front subframe and the sump, the gearbox's tunnel."""
    out = _tube_tris((0.32, 0.2, 1.6), (0.32, 0.19, -1.9), 0.035, 'metal')
    out += _tube_tris((0.32, 0.19, -1.2), (0.32, 0.19, -1.75), 0.11, 'rust', seg=10)
    out += _tube_tris((-0.72, 0.3, -1.42), (0.72, 0.3, -1.42), 0.05, 'dark')
    out += _box_tris(-0.55, 0.2, 0.17, 0.27, -1.05, -0.6, 'dark')
    out += _box_tris(-0.65, 0.65, 0.2, 0.26, 1.15, 1.75, 'rust') + _box_tris(-0.25, 0.25, 0.16, 0.2, 1.3, 1.65, 'dark')
    out += _box_tris(-0.13, 0.13, 0.19, 0.27, -0.9, 1.15, 'dark')
    return out


def _seat(x, z, w, role='trim'):
    """A car seat at (x, z), upright: its cushion and its backrest leaning back, a headrest."""
    return (_box_tris(x - w / 2, x + w / 2, 0.3, 0.48, z - 0.25, z + 0.22, role)
            + _box_tris(x - w / 2, x + w / 2, 0.48, 1.0, z - 0.36, z - 0.22, role)
            + _box_tris(x - 0.12, x + 0.12, 1.02, 1.16, z - 0.38, z - 0.26, role))


def _interior():
    """What the open door and the broken glass show of the inside, upright: floor, seats, dash, headlining."""
    out = _box_tris(-0.74, 0.74, 0.27, 0.3, -1.05, 0.72, 'dark')
    out += _box_tris(-0.7, 0.7, 1.18, 1.2, -0.95, 0.25, 'trim-light')
    out += _seat(-0.38, -0.1, 0.48) + _seat(0.38, -0.1, 0.48)
    out += _box_tris(-0.7, 0.7, 0.3, 0.5, -1.15, -0.65, 'trim') + _box_tris(-0.7, 0.7, 0.5, 0.95, -1.25, -1.1, 'trim')
    # The dash, its radio's slot a black hole in the middle.
    out += _box_tris(-0.74, -0.1, 0.58, 0.86, 0.42, 0.74, 'dark') + _box_tris(0.1, 0.74, 0.58, 0.86, 0.42, 0.74, 'dark')
    out += _box_tris(-0.1, 0.1, 0.58, 0.64, 0.46, 0.74, 'dark') + _box_tris(-0.1, 0.1, 0.8, 0.86, 0.46, 0.74, 'dark')
    return out


def _door(p):
    """A point of the driver's door swung open on its hinge."""
    x, y, z = p
    dx, dz = x - HINGE[0], z - HINGE[1]
    c, s = math.cos(DOOR_OPEN), math.sin(DOOR_OPEN)
    return (HINGE[0] + dx * c + dz * s, y, HINGE[1] - dx * s + dz * c)


def _crush(p):
    """The roof pushed down, more at the front and over the driver's side, and shoved over to the other."""
    x, y, z = p
    if y <= BELT:
        return p
    t = min(1.0, max(0.0, (z + 0.9) / 1.2))
    k = 0.72 + (0.5 - 0.72) * t
    k *= 1 - 0.25 * min(1.0, max(0.0, -x / 0.8))
    rise = y - BELT
    return (x + 0.1 * rise / 0.46, BELT + rise * k, z)


def _flip(p):
    """On its roof (turned round its length), the nose a little down."""
    x, y, z = -p[0], -p[1], p[2]
    c, s = math.cos(PITCH), math.sin(PITCH)
    return (x, y * c - z * s, y * s + z * c)


def _in_door(tri):
    """The whole triangle within the door's panel (one that reaches past it stays with the body)."""
    return all(p[0] < DOOR['x'] and DOOR['z0'] - 0.02 < p[2] < DOOR['z1'] + 0.02 and DOOR['y0'] - 0.03 < p[1] < DOOR['y1'] + 0.02 for p in tri)


def _role(role, c, tri):
    """The night's damage by part: the driver's side glass gone, the windscreen crazed, the nose's lights out, the
    underside's grime on what faces down."""
    n = _cross([tri[1][i] - tri[0][i] for i in range(3)], [tri[2][i] - tri[0][i] for i in range(3)])
    ln = math.sqrt(sum(v * v for v in n)) or 1.0
    if role in ('paint', 'metal', 'trim') and c[1] < 0.45 and n[1] / ln < -0.7:
        return 'rust' if hashf(c[0], c[2]) < 0.5 else 'dark'
    if role == 'glass-dark' and c[0] < -0.3:
        return None
    if role == 'glass-dark' and c[2] > 0.2:
        return 'glass-blue'
    if role in ('neon-amber', 'headlight') and c[2] > 0:
        return 'trim'
    return role


def _wreck_tris():
    """The car's and its inside's triangles on its roof, the foot on y = 0: (triangles, the map of a point there)."""
    out = []
    for tri, role in triangles('vehicle-props.glb', 'veh-dirty') + _interior() + _underbody():
        c = tuple(sum(p[i] for p in tri) / 3 for i in range(3))
        r = _role(role, c, tri)
        if r is None:
            continue
        pts = [_door(p) for p in tri] if _in_door(tri) else list(tri)
        out.append(([_flip(_crush(p)) for p in pts], r))
    low = min(p[1] for t, _ in out for p in t)

    def place(p):
        q = _flip(_crush(p))
        return (q[0], q[1] - low, q[2])
    return [([(p[0], p[1] - low, p[2]) for p in t], r) for t, r in out], place


def wreck():
    """The car on its roof (1.9 x 1.2 x 4.5, the driver's door open to +x): the game's old saloon crushed and turned
    over, the cut belts hanging from the B pillar and the buckle to the roof, the airbag hanging off the wheel, the
    radio's cables out of the dash, glass on the roof's lining."""
    m = Model('rd-lit-wreck')
    tris, place = _wreck_tris()
    for t, role in tris:
        m.tri(*t, role)
    # The belts the rescuers cut: from the B pillar's top and from the buckle, hanging to the roof (now the floor).
    for top, length, sway in (((-0.78, 1.04, -0.4), 0.55, 0.06), ((-0.14, 0.46, -0.26), 0.42, -0.04), ((-0.66, 0.36, -0.42), 0.3, 0.03)):
        a = place(top)
        mid = (a[0] + sway, a[1] - length * 0.5, a[2] + 0.03)
        end = (a[0] + sway * 1.6, max(0.03, a[1] - length), a[2] + 0.05)
        for p, q in ((a, mid), (mid, end)):
            centre = tuple((p[i] + q[i]) / 2 for i in range(3))
            along = tuple(q[i] - p[i] for i in range(3))
            half = math.sqrt(sum(v * v for v in along)) / 2
            m.obox(centre, (0, 0, 1), along, (0.024, half, 0.003), 'trim')
    # The airbag, spent, hanging off the wheel's hub (driver's wheel at x -0.38 upright).
    hub = place((-0.38, 0.74, 0.36))
    m.lathe(hub[0], hub[2], [(0.03, 0.0), (0.15, 0.05), (0.19, 0.16), (0.13, 0.27), (0.05, 0.3)], 'wall', seg=9, y0=max(0.04, hub[1] - 0.3))
    # The wheel itself, a ring round the hub.
    for k in range(10):
        a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
        p0 = place((-0.38 + 0.17 * math.cos(a0), 0.74 + 0.17 * math.sin(a0) * 0.8, 0.4 - 0.1 * math.sin(a0)))
        p1 = place((-0.38 + 0.17 * math.cos(a1), 0.74 + 0.17 * math.sin(a1) * 0.8, 0.4 - 0.1 * math.sin(a1)))
        m.tube(p0, p1, 0.016, 'dark', seg=5)
    # The radio's slot emptied: its cables hanging out, one tipped with a red connector.
    slot = place((0.0, 0.72, 0.72))
    for k in range(4):
        dx = -0.06 + 0.04 * k
        end = (slot[0] + dx + 0.05 * hashf(k, 1.0), max(0.06, slot[1] - 0.18 - 0.12 * hashf(k, 2.0)), slot[2] + 0.04 + 0.05 * hashf(k, 3.0))
        m.tube((slot[0] + dx * 0.4, slot[1], slot[2]), end, 0.006, 'cable', seg=5)
        if k == 2:
            m.box(end[0] - 0.012, end[0] + 0.012, end[1] - 0.03, end[1], end[2] - 0.012, end[2] + 0.012, 'neon-red')
    # Glass on the roof's lining, inside (the lining's face up now).
    for k in range(14):
        x = -0.6 + 1.2 * hashf(k, 4.0)
        z = -0.9 + 1.1 * hashf(k, 5.0)
        bx, by, bz = place((x, 1.17, z))
        s = 0.02 + 0.03 * hashf(k, 7.0)
        a = 2 * math.pi * hashf(k, 8.0)
        m.tri((bx, by, bz), (bx + s * math.cos(a + 2.1), by, bz + s * math.sin(a + 2.1)), (bx + s * math.cos(a), by, bz + s * math.sin(a)), 'glass-blue')
    return m


def _post_point(base, d, bend, lean, v):
    """A point `v` metres up the bent post's axis: straight to `bend`, then leaning by `lean` towards `d`."""
    if v <= bend:
        return (base[0], v, base[2])
    s = v - bend
    return (base[0] + d[0] * s * math.sin(lean), bend + s * math.cos(lean), base[2] + d[1] * s * math.sin(lean))


def bent_lamp():
    """The pastoral lamp the car and the drone hit (its foot on the OSM lamp's spot): the cast foot and collar whole, the
    steel shaft kinked at the bumper's height and leaning 30 degrees over the wreck to the north-west, the crook at its
    top, the lantern hanging off one hook askew, two panes out and two still lit (3.8 m)."""
    m = Model('rd-lit-bent-lamp')
    d = (-0.8, 0.6)
    bend, lean, top = 0.82, math.radians(30), 3.75
    m.lathe(0.0, 0.0, [(0.24, 0.0), (0.24, 0.05), (0.2, 0.55), (0.16, 0.55), (0.16, 0.67), (0.1, 0.67), (0.0, 0.67)], 'dark', seg=8)
    m.lathe(0.0, 0.0, [(0.12, 0.0), (0.12, 0.07), (0.0, 0.07)], 'trim', seg=8, y0=0.5)
    # The shaft: straight to the kink, a crumpled knee, then leaning.
    pts = [_post_point((0, 0, 0), d, bend, lean, v) for v in (0.67, bend - 0.05, bend + 0.1)]
    pts += [_post_point((0, 0, 0), d, bend, lean, v) for v in (1.6, 2.6, top)]
    knee = pts[2]
    pts[2] = (knee[0] - 0.03, knee[1], knee[2] + 0.04)
    for p, q in zip(pts, pts[1:]):
        m.tube(p, q, 0.075 if p[1] < 1.0 else 0.065, 'dark', seg=8)
    m.tube(pts[1], pts[2], 0.085, 'trim', seg=8)
    ring_at = _post_point((0, 0, 0), d, bend, lean, top - 0.7)
    m.tube((ring_at[0], ring_at[1] - 0.035, ring_at[2]), (ring_at[0] + 0.035 * d[0], ring_at[1] + 0.035, ring_at[2] + 0.035 * d[1]), 0.11, 'trim', seg=8)
    # The crook, after the engine's (up, over and down to the hook), in the lean's plane.
    axis = (d[0] * math.sin(lean), math.cos(lean), d[1] * math.sin(lean))
    arm = (d[0] * math.cos(lean), -math.sin(lean), d[1] * math.cos(lean))
    head = _post_point((0, 0, 0), d, bend, lean, top)
    crook = [(0.0, -0.05), (0.04, 0.3), (0.2, 0.57), (0.46, 0.7), (0.74, 0.67), (0.95, 0.53), (1.05, 0.37)]
    cp = [tuple(head[i] + arm[i] * u + axis[i] * w for i in range(3)) for u, w in crook]
    for p, q in zip(cp, cp[1:]):
        m.tube(p, q, 0.035, 'dark', seg=6)
    hook = cp[-1]
    # The lantern hanging off one hook, turned and tipped: its frame, two panes lit, two broken out.
    w, h = 0.3, 0.42
    tip = math.radians(18)
    cy = hook[1] - 0.12 - 0.13 - h / 2
    m.tube(hook, (hook[0] + 0.03, hook[1] - 0.12, hook[2]), 0.015, 'dark', seg=4)
    ax = (math.cos(tip), math.sin(tip), 0.0)
    ay = (-math.sin(tip), math.cos(tip), 0.0)
    centre = (hook[0] + 0.03 + (h / 2 + 0.13) * math.sin(tip), cy, hook[2])
    m.obox((centre[0], centre[1] + h / 2 + 0.08, centre[2]), ax, ay, (w * 0.66, 0.05, w * 0.66), 'dark')
    m.obox((centre[0], centre[1] - h / 2 - 0.03, centre[2]), ax, ay, (w * 0.45, 0.03, w * 0.45), 'dark')
    for k, (sx, sz) in enumerate(((1, 1), (1, -1), (-1, 1), (-1, -1))):
        p = (centre[0] + ax[0] * sx * w / 2, centre[1] + ax[1] * sx * w / 2, centre[2] + sz * w / 2)
        m.obox(p, ax, ay, (0.015, h / 2 + 0.01, 0.015), 'dark')
    # Lit panes on the side towards the car (-x) and its front, the other two out (the frame shows through).
    m.obox((centre[0] - ax[0] * w / 2, centre[1] - ax[1] * w / 2, centre[2]), ax, ay, (0.004, h / 2, w / 2 - 0.015), 'win-warm')
    m.obox((centre[0], centre[1], centre[2] + w / 2), ax, ay, (w / 2 - 0.015, h / 2, 0.004), 'win-warm')
    m.obox((centre[0], centre[1] - 0.05, centre[2]), ax, ay, (0.05, 0.08, 0.05), 'win-warm')
    # A shard still in the broken frame.
    m.tri((centre[0] + 0.15, centre[1] - 0.2, centre[2] - 0.14), (centre[0] + 0.15, centre[1] - 0.05, centre[2] - 0.14), (centre[0] + 0.15, centre[1] - 0.2, centre[2] - 0.02), 'glass-blue')
    return m


def drone():
    """The drone that hit the pole with the car: a police quad's body on its side by the lamp's foot, two arms snapped
    off and lying apart, a rotor's blades bent, the camera dome cracked, its red light still on (1.6 x 0.3 x 1.2)."""
    m = Model('rd-lit-drone')
    tilt = math.radians(28)
    ax, ay = (1.0, 0.0, 0.0), (0.0, math.cos(tilt), math.sin(tilt))
    m.obox((0.0, 0.13, 0.0), ax, ay, (0.22, 0.07, 0.3), 'dark', bevel=0.02)
    m.obox((0.0, 0.2, 0.03), ax, ay, (0.16, 0.025, 0.22), 'trim-light', bevel=0.01)
    m.lathe(0.0, 0.29, [(0.07, 0.0), (0.065, 0.03), (0.035, 0.07), (0.0, 0.08)], 'glass-blue', seg=10, y0=0.02)
    m.box(0.12, 0.16, 0.2, 0.23, 0.18, 0.22, 'neon-red')
    # Two arms still on, their motors and bent blades.
    for sx, sz in ((1, 1), (-1, -1)):
        tip = (sx * 0.5, 0.08 + 0.12 * (sz > 0), sz * 0.45)
        m.tube((sx * 0.15, 0.14, sz * 0.18), tip, 0.025, 'trim', seg=6)
        m.cyl(tip[0], tip[2], 0.045, tip[1] - 0.03, tip[1] + 0.04, 'metal', seg=10)
        for b in range(2):
            a = math.radians(30 + 180 * b + 25 * sx)
            m.obox((tip[0] + 0.14 * math.cos(a), tip[1] + 0.05 + 0.03 * b, tip[2] + 0.14 * math.sin(a)), (math.cos(a), 0.15 * b, math.sin(a)), (0, 1, 0), (0.14, 0.004, 0.025), 'dark')
    # The two snapped off, lying apart on the paving, the wires out of their stumps.
    for k, (x, z, yaw) in enumerate(((0.75, -0.35, 0.6), (-0.6, 0.5, 2.3))):
        c, s = math.cos(yaw), math.sin(yaw)
        a, b = (x - 0.2 * c, 0.025, z - 0.2 * s), (x + 0.2 * c, 0.025, z + 0.2 * s)
        m.tube(a, b, 0.024, 'trim', seg=6)
        m.cyl(b[0], b[2], 0.045, 0.0, 0.07, 'metal', seg=10)
        m.tube(a, (a[0] - 0.07 * c, 0.01, a[2] - 0.07 * s + 0.03), 0.004, 'neon-red' if k else 'cable', seg=4)
    return m


def _shard(m, x, z, s, a, role):
    m.tri((x, 0.004, z), (x + s * math.cos(a + 2.2), 0.004, z + s * math.sin(a + 2.2)), (x + s * 0.8 * math.cos(a), 0.004, z + s * 0.8 * math.sin(a)), role)


def glass():
    """What lies on the paving round the wreck's open side: the driver's window in cubes and shards fanned out, a
    piece of the belt the rescuers cut, a torn strip of the tape, a rescuer's glove (3 x 0.02 x 2.4)."""
    m = Model('rd-lit-glass')
    for k in range(90):
        r = 1.3 * math.sqrt(hashf(k, 11.0))
        a = math.pi * (hashf(k, 12.0) - 0.5) * 1.1
        x, z = 0.2 + r * math.cos(a) * 1.1, r * math.sin(a)
        _shard(m, x, z, 0.03 + 0.04 * hashf(k, 13.0), 6.3 * hashf(k, 14.0), 'glass-blue' if k % 3 else 'trim-light')
    # The belt's piece, its cut end frayed.
    m.obox((0.9, 0.004, 0.55), (0.94, 0.0, 0.34), (0, 1, 0), (0.24, 0.003, 0.024), 'trim')
    m.box(0.68, 0.72, 0.0, 0.012, 0.44, 0.5, 'metal')
    # A strip of the tape torn off in the wind.
    for k in range(5):
        x0, z0 = -0.2 + 0.3 * k, -0.9 + 0.06 * math.sin(k * 1.3)
        m.obox((x0, 0.003, z0), (1.0, 0.0, 0.12 * math.sin(k)), (0, 1, 0), (0.15, 0.002, 0.04), 'fabric-magenta' if k % 2 else 'wall')
    # A latex glove, blue, dropped by a rescuer.
    m.obox((1.35, 0.012, -0.4), (0.8, 0.0, 0.6), (0, 1, 0), (0.08, 0.01, 0.045), 'neon-blue')
    for k in range(4):
        a = 0.6 + 0.25 * (k - 1.5)
        m.tube((1.41, 0.01, -0.36), (1.41 + 0.09 * math.cos(a), 0.01, -0.36 + 0.09 * math.sin(a)), 0.009, 'neon-blue', seg=4)
    return m


def spill():
    """What leaks out of the wreck where its bonnet meets the paving: a pool of oil, black and glossy, and the coolant's
    green running off it towards the drain, drops from the engine's bay falling into it (2.0 x 0.01 x 1.6)."""
    m = Model('rd-lit-spill')
    for k, (x, z, r) in enumerate(((0.0, 0.0, 0.5), (0.35, 0.18, 0.32), (-0.38, -0.08, 0.36), (0.15, -0.36, 0.28), (-0.12, 0.38, 0.25))):
        m.lathe(x, z, [(r, 0.0), (0.0, 0.001)], 'glass-dark', seg=22, y0=0.002 + 0.0006 * k)
    for k, (x, z, r) in enumerate(((0.62, 0.42, 0.16), (0.78, 0.6, 0.12), (0.9, 0.78, 0.08))):
        m.lathe(x, z, [(r, 0.0), (0.0, 0.001)], 'dumpster', seg=14, y0=0.004 + 0.0006 * k)
    for x, z in ((0.05, 0.1), (-0.2, -0.05), (0.2, -0.15)):
        m.lathe(x, z, [(0.03, 0.0), (0.0, 0.002)], 'trim-light', seg=8, y0=0.006)
    return m


def skid():
    """Four metres of the night's tracks on the granite: the two tyres' black marks, sliding sideways in an arc, the
    outer one doubled where the car began to roll, a scrape of the roof in light scratches (4.2 x 0.01 x 1.9)."""
    m = Model('rd-lit-skid')
    steps = 12
    for track, (x0, w) in enumerate(((-0.78, 0.2), (0.78, 0.22))):
        for k in range(steps):
            z0, z1 = -2.1 + 4.2 * k / steps, -2.1 + 4.2 * (k + 1) / steps
            bend0, bend1 = 0.12 * math.sin(z0 * 0.7), 0.12 * math.sin(z1 * 0.7)
            fade = 0.75 + 0.25 * hashf(track, k, 21.0)
            m.quad([(x0 + bend0 - w * fade / 2, 0.006, z0), (x0 + bend1 - w * fade / 2, 0.006, z1), (x0 + bend1 + w * fade / 2, 0.006, z1), (x0 + bend0 + w * fade / 2, 0.006, z0)], 'dark')
    for k in range(9):
        x = -0.5 + 1.0 * hashf(k, 22.0)
        z = 0.6 + 1.4 * hashf(k, 23.0)
        m.quad([(x, 0.007, z), (x + 0.012, 0.007, z + 0.6), (x + 0.03, 0.007, z + 0.6), (x + 0.018, 0.007, z)], 'trim-light')
    return m


def tape():
    """The police's tape from a striped warning post on its rubber foot to the bent lamp's shaft 3.4 m ahead (local
    (0, 1.0, 3.4), where the scene turns it), sagging, a loose end fluttering down off the post (0.4 x 1.1 x 3.5)."""
    m = Model('rd-lit-tape')
    m.lathe(0.0, 0.0, [(0.2, 0.0), (0.18, 0.06), (0.04, 0.08), (0.0, 0.08)], 'dark', seg=12)
    for k in range(5):
        m.cyl(0.0, 0.0, 0.035, 0.08 + 0.2 * k, 0.28 + 0.2 * k, 'fabric-magenta' if k % 2 else 'wall', seg=10)
    m.lathe(0.0, 0.0, [(0.04, 0.0), (0.0, 0.04)], 'neon-amber', seg=8, y0=1.08)
    end = (0.0, 1.0, 3.4)
    start = (0.0, 0.98, 0.0)
    n = 12
    for k in range(n):
        t0, t1 = k / n, (k + 1) / n
        p0 = tuple(start[i] + (end[i] - start[i]) * t0 for i in range(3))
        p1 = tuple(start[i] + (end[i] - start[i]) * t1 for i in range(3))
        sag0, sag1 = 0.22 * 4 * t0 * (1 - t0), 0.22 * 4 * t1 * (1 - t1)
        a, b = (p0[0], p0[1] - sag0, p0[2]), (p1[0], p1[1] - sag1, p1[2])
        centre = tuple((a[i] + b[i]) / 2 for i in range(3))
        along = tuple(b[i] - a[i] for i in range(3))
        half = math.sqrt(sum(v * v for v in along)) / 2
        m.obox(centre, along, (0, 1, 0), (half, 0.035, 0.002), 'fabric-magenta' if k % 2 else 'wall')
    for k in range(4):
        y = 0.95 - 0.2 * k
        m.obox((0.05 + 0.04 * math.sin(k * 1.7), y - 0.1, -0.06 - 0.03 * k), (0.2, 1.0, 0.1), (0, 0, 1), (0.002, 0.1, 0.035), 'wall' if k % 2 else 'fabric-magenta')
    return m


def candles():
    """What the street left by the bent lamp's foot: five grave candles in red and clear glass, three lit, a bunch of
    carnations in foil, a card leaning on a candle with a few words in pen, a burnt-out one on its side (0.7 x 0.4 x 0.5)."""
    m = Model('rd-lit-candles')
    spots = ((-0.18, 0.05, 'neon-red', True), (0.0, -0.08, 'glass-blue', True), (0.17, 0.06, 'neon-red', True), (-0.05, 0.14, 'glass-blue', False), (0.28, -0.1, 'neon-red', False))
    for k, (x, z, glass_role, lit) in enumerate(spots):
        h = 0.14 + 0.05 * hashf(k, 31.0)
        m.lathe(x, z, [(0.035, 0.0), (0.045, h * 0.7), (0.04, h), (0.0, h)], glass_role, seg=10)
        m.lathe(x, z, [(0.034, 0.0), (0.03, 0.03), (0.0, 0.04)], 'trim-light' if not lit else 'metal', seg=8, y0=h)
        if lit:
            m.lathe(x, z, [(0.012, 0.0), (0.016, 0.02), (0.0, 0.05)], 'neon-amber', seg=6, y0=h * 0.55)
    m.tube((-0.32, 0.03, -0.12), (-0.18, 0.03, -0.18), 0.03, 'glass-blue', seg=8)
    # The carnations: stems in foil, the flowers' heads.
    m.lathe(0.05, 0.2, [(0.02, 0.0), (0.07, 0.18), (0.0, 0.18)], 'trim-light', seg=8)
    for k in range(5):
        a = 2 * math.pi * k / 5
        x, z = 0.05 + 0.05 * math.cos(a), 0.2 + 0.05 * math.sin(a)
        m.tube((0.05, 0.12, 0.2), (x, 0.24, z), 0.004, 'plant', seg=4)
        m.lathe(x, z, [(0.02, 0.0), (0.028, 0.02), (0.0, 0.03)], 'fabric-magenta', seg=7, y0=0.23)
    # The card, leaning on the clear candle, its few lines.
    m.obox((0.02, 0.07, -0.16), (1, 0, 0), (0, 0.94, 0.34), (0.06, 0.075, 0.002), 'wall')
    for k in range(3):
        m.obox((0.01, 0.1 - 0.025 * k, -0.163 + 0.009 * k), (1, 0, 0), (0, 0.94, 0.34), (0.04 - 0.008 * k, 0.003, 0.0015), 'dark')
    return m


def van_camp():
    """The cluster by the van's flank where its crew stands about: coffee cups, butts round a can turned ashtray, a
    noodle carton with its chopsticks, crushed cans, a lighter, a phone's cracked screen still lit (0.9 x 0.15 x 0.7)."""
    m = Model('rd-lit-van-camp')
    for k, (x, z, lying) in enumerate(((-0.3, 0.1, False), (-0.18, 0.22, True), (0.32, -0.2, False))):
        if lying:
            m.tube((x, 0.045, z), (x + 0.11, 0.045, z + 0.04), 0.043, 'trim-light', seg=12)
        else:
            m.lathe(x, z, [(0.032, 0.0), (0.045, 0.12), (0.0, 0.12)], 'trim-light', seg=12)
            m.lathe(x, z, [(0.047, 0.0), (0.0, 0.012)], 'dark', seg=12, y0=0.12)
    m.lathe(0.05, -0.05, [(0.033, 0.0), (0.033, 0.11), (0.0, 0.11)], 'metal', seg=12)
    for k in range(14):
        a = 2 * math.pi * hashf(k, 41.0)
        r = 0.06 + 0.2 * hashf(k, 42.0)
        x, z = 0.05 + r * math.cos(a), -0.05 + r * math.sin(a)
        m.tube((x, 0.006, z), (x + 0.03 * math.cos(a * 3), 0.006, z + 0.03 * math.sin(a * 3)), 0.0045, 'win-white' if k % 4 else 'fabric-amber', seg=4)
    # The noodle carton, open, its chopsticks across.
    m.lathe(-0.05, 0.25, [(0.045, 0.0), (0.065, 0.09), (0.0, 0.09)], 'win-white', seg=4)
    m.tube((-0.12, 0.095, 0.22), (0.05, 0.095, 0.29), 0.004, 'fabric-amber', seg=4)
    m.tube((-0.12, 0.095, 0.24), (0.05, 0.095, 0.31), 0.004, 'fabric-amber', seg=4)
    for x, z, a in ((0.25, 0.15, 0.4), (0.38, 0.05, 2.0)):
        m.tube((x, 0.025, z), (x + 0.06 * math.cos(a), 0.025, z + 0.06 * math.sin(a)), 0.025, 'neon-cyan' if a < 1 else 'metal', seg=8)
    m.box(-0.4, -0.37, 0.0, 0.012, -0.18, -0.12, 'neon-red')
    m.obox((0.2, 0.006, -0.3), (0.9, 0.0, 0.4), (0, 1, 0), (0.04, 0.005, 0.075), 'dark')
    m.obox((0.2, 0.0115, -0.3), (0.9, 0.0, 0.4), (0, 1, 0), (0.034, 0.0005, 0.065), 'office')
    return m


def tarp():
    """A blue tarp off the van's load, folded over twice on the paving and weighted down with an old tyre, a corner
    flapped back, a strap trailing (1.5 x 0.24 x 1.1)."""
    m = Model('rd-lit-tarp')
    for k, (x0, x1, z0, z1) in enumerate(((-0.7, 0.55, -0.5, 0.5), (-0.62, 0.5, -0.44, 0.42), (-0.55, 0.42, -0.36, 0.3))):
        y = 0.004 + 0.012 * k
        m.box(x0, x1, y, y + 0.01, z0, z1, 'glass-blue')
        # The fold's rounded edge along its open side.
        m.tube((x1, y + 0.005, z0), (x1, y + 0.005, z1), 0.008, 'glass-blue', seg=6)
    m.obox((0.68, 0.05, 0.38), (0.94, 0.33, 0.0), (0, 0, 1), (0.16, 0.14, 0.004), 'glass-blue')
    m.tube((-0.7, 0.012, 0.45), (-1.0, 0.004, 0.62), 0.012, 'trim', seg=5)
    m.lathe(-0.1, -0.05, [(0.31, 0.0), (0.33, 0.04), (0.33, 0.17), (0.31, 0.2), (0.19, 0.2), (0.19, 0.0)], 'tyre', seg=16, y0=0.04, cap=False)
    m.lathe(-0.1, -0.05, [(0.31, 0.0), (0.19, 0.0)], 'tyre', seg=16, y0=0.24, cap=False)
    return m


def poems():
    """Under Shiro's lamp: sheets of his poems held down with a stone, one crumpled, a plastic cup of tea gone cold
    (0.5 x 0.12 x 0.4)."""
    m = Model('rd-lit-poems')
    for k in range(4):
        x, z = -0.1 + 0.08 * k, -0.05 + 0.05 * math.sin(k * 2.0)
        a = 0.3 * (k - 1.5)
        m.obox((x, 0.002 + 0.002 * k, z), (math.cos(a), 0.0, math.sin(a)), (0, 1, 0), (0.105, 0.001, 0.148), 'wall')
        for r in range(5):
            m.obox((x - 0.01 * math.sin(a) * r, 0.0035 + 0.002 * k, z - 0.1 + 0.035 * r), (math.cos(a), 0.0, math.sin(a)), (0, 1, 0), (0.07 - 0.01 * (r % 2), 0.0005, 0.003), 'dark')
    m.lathe(0.0, -0.02, [(0.05, 0.0), (0.06, 0.03), (0.04, 0.06), (0.0, 0.065)], 'trim', seg=7, y0=0.008)
    m.lathe(0.2, 0.15, [(0.03, 0.0), (0.04, 0.03), (0.0, 0.05)], 'wall', seg=7)
    m.lathe(-0.22, 0.12, [(0.03, 0.0), (0.042, 0.1), (0.0, 0.1)], 'glass-blue', seg=12)
    m.lathe(-0.22, 0.12, [(0.038, 0.0), (0.0, 0.001)], 'fabric-amber', seg=12, y0=0.08)
    return m


MODELS = [wreck, bent_lamp, drone, glass, spill, skid, tape, candles, van_camp, tarp, poems]
