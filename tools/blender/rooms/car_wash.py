"""MYJNIA 24H and the yard behind it (`docs/lokacje/myjnia-podworko.md`, ADR-0102 point 5, ADR-0098): the wash's
gantry with its brushes, spray arch and dryer, the machine room's yard wall, the chemistry by the bay, the bay's wet
floor, the payment post, the tube lights under the canopy and what the Hebi courier left round his feet.

Sizes from the simulation (`packages/sim/src/content/district-car-wash.ts`): the gantry's legs are its two solids
(1.2 x 3.4 x 0.3 m, 5.8 m apart), the car under it 4.2 x 1.5 x 2 m, the canopy's underside 4.27 m over the pad, the
machine room 6 x 4.6 x 9 m. Each model's foot is on y = 0 where it stands (the floor, a wall's foot, the canopy's
underside for what hangs), its front to +z; variations from `hashf`, so the same script gives the same file.
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-props.glb'

# The gantry's legs stand this far either side of its middle, across the bay (the solids' centres).
LEG_Z = 2.9


def _brush(m, cx, cz, y0, y1, r, seed):
    """An upright wash brush: its shaft, the bristle strips in bands of two colours, worn unevenly (`seed`)."""
    m.cyl(cx, cz, 0.05, y0 - 0.1, y1 + 0.35, 'metal', seg=8)
    bands = 7
    h = (y1 - y0) / bands
    for k in range(bands):
        rk = r * (0.86 + 0.14 * hashf(seed, k))
        prof = [(rk * 0.7, 0.0), (rk, h * 0.2), (rk * 0.96, h * 0.8), (rk * 0.7, h)]
        m.lathe(cx, cz, prof, 'fabric-teal' if k % 2 else 'fabric-magenta', seg=16, y0=y0 + k * h)
    m.box(cx - 0.16, cx + 0.16, y1 + 0.35, y1 + 0.6, cz - 0.16, cz + 0.16, 'trim', bevel=0.02)


def gantry():
    """The roll-over wash gantry over the car, stopped mid-programme (comic realism: a real portal of a self-service wash).
    Two side frames on bogies on floor rails, the beam with its motor housing and a red STOP light, two upright brushes
    and the roof brush on its swing arms, the spray arch with its nozzles, the dryer's hood, hoses down to the motors,
    hazard stripes on the frames (5.3 x 3.9 x 6.1; the middle of the bay at the origin, x along the bay)."""
    m = Model('rd-cw-gantry')
    # Rails along the bay under the legs, the gantry parked over the car's back.
    for s in (-1, 1):
        z = s * LEG_Z
        m.box(-4.0, 1.3, 0.0, 0.06, z - 0.04, z + 0.04, 'metal')
        for k in range(8):
            x = -3.8 + k * 0.7
            m.box(x - 0.05, x + 0.05, 0.0, 0.02, z - 0.12, z + 0.12, 'dark')
    for s in (-1, 1):
        z = s * LEG_Z
        # The bogie on its rail: housing and two wheels.
        m.box(-0.6, 0.6, 0.06, 0.34, z - 0.15, z + 0.15, 'trim', bevel=0.02)
        for x in (-0.38, 0.38):
            m.tube((x, 0.16, z - 0.16), (x, 0.16, z + 0.16), 0.11, 'tyre', seg=12)
        # The side frame: two posts, the cladding between, its inner face's hazard stripes and a side dryer nozzle.
        for x in (-0.54, 0.54):
            m.box(x - 0.06, x + 0.06, 0.34, 3.3, z - 0.13, z + 0.13, 'metal', bevel=0.01)
        m.box(-0.48, 0.48, 0.4, 3.2, z - 0.05, z + 0.05, 'trim-light')
        inner = z - s * 0.055
        for k in range(6):
            x = -0.48 + k * 0.16
            m.box(x, x + 0.08, 0.45, 0.75, inner - 0.003, inner + 0.003, 'fabric-amber' if k % 2 == 0 else 'dark')
        m.box(-0.9, -0.62, 0.5, 1.5, z - s * 0.12, z - s * 0.02, 'trim', bevel=0.02)
        m.box(-0.88, -0.64, 0.55, 1.45, z - s * 0.125, z - s * 0.12, 'dark')
    # The beam over the bay, its motor housing and the STOP / GO light facing the way in (-x).
    m.box(-0.6, 0.6, 3.3, 3.7, -LEG_Z - 0.15, LEG_Z + 0.15, 'metal', bevel=0.02)
    m.box(-0.45, 0.45, 3.7, 3.9, -1.2, 1.2, 'trim', bevel=0.03)
    m.box(-0.7, -0.6, 3.05, 3.55, -0.35, 0.35, 'dark')
    m.box(-0.72, -0.7, 3.12, 3.28, -0.25, -0.05, 'neon-red')
    m.box(-0.72, -0.7, 3.32, 3.48, -0.25, -0.05, 'trim')
    m.box(-0.72, -0.7, 3.15, 3.45, 0.05, 0.3, 'neon-amber')
    # The upright brushes on their carriages, the roof brush on its swing arms over the car's roof.
    for s in (-1, 1):
        _brush(m, 0.35, s * 1.65, 0.2, 2.3, 0.42, s)
        m.box(0.2, 0.5, 2.95, 3.3, s * 1.65 - 0.2, s * 1.65 + 0.2, 'trim')
    for k in range(10):
        z0 = -1.25 + k * 0.25
        r = 0.4 * (0.88 + 0.12 * hashf(k, 7.0))
        m.tube((-0.55, 2.05, z0), (-0.55, 2.05, z0 + 0.25), r, 'fabric-magenta' if k % 2 else 'fabric-teal', seg=14)
    for s in (-1, 1):
        m.tube((-0.55, 2.05, s * 1.25), (-0.55, 2.05, s * 1.4), 0.05, 'metal', seg=8)
        m.box(-0.62, -0.48, 2.05, 3.3, s * 1.42 - 0.04, s * 1.42 + 0.04, 'metal')
    # The spray arch behind the brushes: a U of pipe with nozzles pointing in.
    for s in (-1, 1):
        m.tube((0.8, 0.3, s * 2.55), (0.8, 2.9, s * 2.55), 0.035, 'pipe', seg=8)
        for k in range(6):
            y = 0.5 + k * 0.42
            m.tube((0.8, y, s * 2.55), (0.8, y - 0.03, s * 2.42), 0.014, 'metal', seg=6)
    m.tube((0.8, 2.9, -2.55), (0.8, 2.9, 2.55), 0.035, 'pipe', seg=8)
    for k in range(9):
        z = -2.0 + k * 0.5
        m.tube((0.8, 2.9, z), (0.78, 2.78, z), 0.014, 'metal', seg=6)
    # The dryer's hood over the way out, its slot, and the hoses down from the beam to the motors.
    m.box(-1.15, -0.62, 2.7, 3.3, -1.3, 1.3, 'trim-light', bevel=0.03)
    m.box(-1.05, -0.72, 2.68, 2.7, -1.15, 1.15, 'dark')
    for s in (-1, 1):
        m.tube((0.0, 3.3, s * 0.9), (0.3, 3.0, s * 1.45), 0.025, 'cable', seg=6)
        m.tube((0.3, 3.0, s * 1.45), (0.35, 2.92, s * 1.6), 0.025, 'cable', seg=6)
    return m


def machine_wall():
    """The machine room's wall to the yard (6 m, the wall at z 0, the yard at +z): the steel service door with its sign
    and kick plate, the louvred intake with the fan behind it, the high-pressure pump unit in its cage on a plinth, the
    water main with its valve going into the wall, the fuse box with conduits, the boiler's flue up past the roof with its
    rain cap (6 x 5.4 x 0.8)."""
    m = Model('rd-cw-machine')
    # The door (0.95 x 2.1) in its frame, a dent, the sign, the kick plate.
    m.box(0.12, 1.22, 0.0, 2.2, 0.0, 0.05, 'metal')
    m.box(0.18, 1.16, 0.02, 2.12, 0.05, 0.08, 'trim', bevel=0.01)
    m.box(1.0, 1.06, 0.95, 1.15, 0.08, 0.12, 'metal')
    m.box(0.3, 1.04, 0.05, 0.3, 0.08, 0.085, 'metal')
    m.box(0.45, 0.9, 1.6, 1.82, 0.08, 0.085, 'fabric-amber')
    m.box(0.5, 0.85, 1.66, 1.76, 0.085, 0.087, 'dark')
    # The louvred intake high on the wall, the fan's blades behind the slats.
    m.box(-1.3, -0.1, 2.5, 3.3, 0.0, 0.08, 'metal')
    m.box(-1.24, -0.16, 2.56, 3.24, 0.02, 0.05, 'dark')
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        m.obox((-0.7, 2.9, 0.035), (math.cos(a), math.sin(a), 0), (-math.sin(a), math.cos(a), 0), (0.14, 0.04, 0.005), 'trim-light')
    for k in range(7):
        y = 2.6 + k * 0.095
        m.obox((-0.7, y, 0.07), (1, 0, 0), (0, 0.7, 0.7), (0.56, 0.04, 0.006), 'metal')
    # The pump unit in its cage on a concrete plinth: motor, pump head, pipes into the wall.
    m.box(-2.45, -1.2, 0.0, 0.15, 0.0, 0.7, 'wall-dark', bevel=0.02)
    m.tube((-2.2, 0.45, 0.35), (-1.65, 0.45, 0.35), 0.2, 'fabric-teal', seg=14)
    for k in range(5):
        x = -2.15 + k * 0.1
        m.tube((x, 0.45, 0.13), (x, 0.45, 0.57), 0.012, 'trim', seg=6)
    m.box(-1.65, -1.35, 0.2, 0.7, 0.2, 0.5, 'neon-red', bevel=0.02)
    m.tube((-1.5, 0.7, 0.35), (-1.5, 1.1, 0.35), 0.05, 'pipe', seg=8)
    m.tube((-1.5, 1.1, 0.35), (-1.5, 1.1, 0.0), 0.05, 'pipe', seg=8)
    m.tube((-2.3, 0.45, 0.35), (-2.3, 0.9, 0.0), 0.03, 'cable', seg=6)
    for x0, x1, z0, z1 in ((-2.5, -2.46, 0.0, 0.74), (-1.19, -1.15, 0.0, 0.74)):
        for k in range(5):
            y = 0.15 + k * 0.3
            m.box(x0, x1, y, y + 0.02, z0, z1, 'metal')
    for k in range(6):
        x = -2.46 + k * 0.255
        m.box(x, x + 0.02, 0.15, 1.35, 0.72, 0.74, 'metal')
    m.box(-2.5, -1.15, 1.35, 1.38, 0.0, 0.74, 'metal')
    # The water main with its red valve wheel, the fuse box and its conduits up the wall.
    m.tube((-0.9, 0.0, 0.1), (-0.9, 0.9, 0.1), 0.045, 'pipe', seg=8)
    m.tube((-0.9, 0.9, 0.1), (-0.9, 0.9, 0.0), 0.045, 'pipe', seg=8)
    m.lathe(-0.9, 0.2, [(0.12, 0.0), (0.12, 0.02), (0.0, 0.02)], 'neon-red', seg=12, y0=0.7)
    m.box(1.5, 2.1, 1.2, 1.9, 0.0, 0.18, 'trim-light', bevel=0.015)
    m.box(1.55, 1.75, 1.7, 1.78, 0.18, 0.185, 'fabric-amber')
    for x in (1.65, 1.8, 1.95):
        m.tube((x, 1.9, 0.08), (x, 4.6, 0.08), 0.02, 'pipe', seg=6)
    # The flue from the boiler up the wall and over the roof, its brackets and the rain cap.
    m.tube((2.6, 0.6, 0.18), (2.6, 5.3, 0.18), 0.1, 'metal', seg=12)
    m.lathe(2.6, 0.18, [(0.0, 0.0), (0.24, 0.08), (0.0, 0.16)], 'metal', seg=12, y0=5.35)
    for y in (1.5, 2.6, 3.7):
        m.box(2.5, 2.7, y, y + 0.05, 0.0, 0.18, 'dark')
    return m


def chemistry():
    """By the machine room's wall in the bay (the wall at z 0): the hose reel on its bracket with the pressure hose coiled
    and the lance hung beside it, three canisters of wash chemistry on a drip tray, two buckets with sponges, a squeegee
    leaned on the wall, a spill under the tray (1.3 x 1.7 x 0.6)."""
    m = Model('rd-cw-chem')
    m.box(-0.25, 0.25, 1.1, 1.7, 0.0, 0.06, 'metal')
    m.tube((0.0, 1.4, 0.06), (0.0, 1.4, 0.36), 0.03, 'metal', seg=8)
    for z in (0.12, 0.3):
        m.lathe(0.0, z, [(0.0, -0.3), (0.3, -0.3), (0.3, 0.3), (0.0, 0.3)], 'trim', seg=16, y0=1.4, cap=False)
    for k in range(6):
        m.tube((0.0, 1.4 - 0.2, 0.14 + 0.025 * k), (0.0, 1.4 - 0.2, 0.165 + 0.025 * k), 0.24, 'neon-amber' if k == 2 else 'dark', seg=16)
    m.tube((0.2, 1.25, 0.3), (0.5, 0.05, 0.35), 0.016, 'dark', seg=6)
    m.tube((0.5, 0.05, 0.35), (0.6, 0.02, 0.5), 0.016, 'dark', seg=6)
    m.tube((-0.45, 1.6, 0.05), (-0.48, 0.55, 0.12), 0.018, 'metal', seg=6)
    m.box(-0.53, -0.43, 0.42, 0.58, 0.08, 0.16, 'dark')
    # The drip tray and its canisters: blue foam, green wax, red rim cleaner, a hand pump on one.
    m.box(-0.6, 0.6, 0.0, 0.06, 0.1, 0.55, 'trim', bevel=0.01)
    for k, (x, role) in enumerate(((-0.4, 'glass-blue'), (0.0, 'plant'), (0.38, 'neon-red'))):
        m.box(x - 0.15, x + 0.15, 0.06, 0.48, 0.18, 0.47, role, bevel=0.025)
        m.cyl(x + 0.08, 0.26, 0.03, 0.48, 0.53, 'dark', seg=8)
        m.box(x - 0.1, x + 0.1, 0.2, 0.32, 0.47, 0.472, 'paint')
    m.tube((0.0, 0.53, 0.32), (0.0, 0.75, 0.32), 0.012, 'metal', seg=6)
    m.box(-0.06, 0.06, 0.75, 0.78, 0.3, 0.34, 'dark')
    # Buckets with sponges, a squeegee on the wall, the spill on the floor.
    for k, x in enumerate((0.85, 1.05)):
        z = 0.32 + 0.12 * k
        m.lathe(x, z, [(0.13, 0.0), (0.16, 0.3), (0.15, 0.3), (0.11, 0.02), (0.0, 0.02)], 'neon-amber' if k else 'glass-blue', seg=14, cap=False)
        m.box(x - 0.07, x + 0.06, 0.22, 0.32, z - 0.05, z + 0.05, 'fabric-amber', bevel=0.02)
    m.tube((-0.75, 0.0, 0.3), (-0.72, 1.25, 0.04), 0.014, 'metal', seg=6)
    m.box(-0.95, -0.55, 0.0, 0.05, 0.27, 0.33, 'dark')
    m.lathe(0.15, 0.7, [(0.35, 0.0), (0.0, 0.002)], 'glass-blue', seg=16)
    m.lathe(0.35, 0.78, [(0.15, 0.0), (0.0, 0.003)], 'neon-violet', seg=12)
    return m


def bay_floor():
    """The bay's wet concrete (the drain at the origin, the bay along +x, across z): the trench drain's grate across the
    bay where the hot water steams, foam slumped off the car round its wheels, a puddle with an oil sheen, tyre tracks
    darker with wet (§15: water where it has a source) (7 x 0.01 x 5.4)."""
    m = Model('rd-cw-bay')
    m.box(-0.2, 0.2, 0.0, 0.004, -2.6, 2.6, 'metal')
    m.box(-0.16, 0.16, 0.004, 0.005, -2.55, 2.55, 'dark')
    for k in range(26):
        z = -2.5 + k * 0.2
        m.box(-0.16, 0.16, 0.004, 0.01, z - 0.015, z + 0.015, 'metal')
    for s in (-1, 1):
        m.box(-1.0, 6.2, 0.0, 0.002, s * 0.75 - 0.12, s * 0.75 + 0.12, 'glass-dark')
    for k in range(14):
        x = 0.8 + 5.0 * hashf(k, 1.0)
        z = (1.0 if k % 2 else -1.0) * (0.8 + 0.5 * hashf(k, 2.0))
        r = 0.1 + 0.22 * hashf(k, 3.0)
        m.lathe(x, z, [(r, 0.0), (r * 0.8, r * 0.25), (0.0, r * 0.35)], 'paint', seg=10, y0=0.003)
    for k, (x, z, r) in enumerate(((-0.7, 0.4, 0.5), (-0.4, -0.3, 0.38), (-0.95, -0.5, 0.3), (0.5, 1.6, 0.45))):
        m.lathe(x, z, [(r, 0.0), (0.0, 0.0006)], 'glass-blue', seg=20, y0=0.004 + 0.0006 * k)
    for k, role in enumerate(('neon-violet', 'win-teal', 'neon-amber')):
        x, z = -0.65 + 0.06 * k, 0.35 - 0.05 * k
        m.quad([(x - 0.18, 0.0075 + 0.0004 * k, z - 0.03), (x + 0.2, 0.0075 + 0.0004 * k, z - 0.03),
                (x + 0.16, 0.0075 + 0.0004 * k, z + 0.03), (x - 0.14, 0.0075 + 0.0004 * k, z + 0.03)], role)
    return m


def pay_post():
    """The payment post at the bay's way in (driver's side), facing the car: a steel post on a kerb block, the terminal
    under its hood with the screen lit, six programme buttons in their colours, the coin slot with a hand-written NO CHANGE
    strip, the card and implant reader glowing cyan, a receipt slot, stickers (0.6 x 1.9 x 0.5)."""
    m = Model('rd-cw-pay')
    m.box(-0.3, 0.3, 0.0, 0.15, -0.25, 0.25, 'wall-dark', bevel=0.02)
    m.box(-0.08, 0.08, 0.15, 1.0, -0.08, 0.08, 'metal')
    m.box(-0.26, 0.26, 1.0, 1.75, -0.18, 0.18, 'trim', bevel=0.02)
    m.box(-0.29, 0.29, 1.75, 1.82, -0.2, 0.26, 'neon-red')
    m.box(-0.3, 0.3, 1.82, 1.9, -0.2, 0.3, 'trim-light', bevel=0.01)
    m.box(-0.18, 0.18, 1.45, 1.68, 0.18, 0.185, 'dark')
    m.box(-0.16, 0.16, 1.47, 1.66, 0.185, 0.187, 'win-teal')
    for k, role in enumerate(('neon-blue', 'neon-green', 'neon-amber', 'neon-red', 'neon-violet', 'neon-pink')):
        x = -0.15 + (k % 3) * 0.15
        y = 1.33 - (k // 3) * 0.1
        m.tube((x, y, 0.18), (x, y, 0.2), 0.03, role, seg=10)
    m.box(-0.2, -0.05, 1.08, 1.12, 0.18, 0.19, 'dark')
    m.box(-0.22, -0.02, 1.13, 1.17, 0.18, 0.185, 'paint')
    m.box(0.04, 0.2, 1.06, 1.18, 0.18, 0.2, 'trim-light')
    m.box(0.07, 0.17, 1.1, 1.14, 0.2, 0.203, 'neon-cyan')
    m.box(-0.08, 0.08, 1.02, 1.04, 0.18, 0.19, 'dark')
    m.quad([(-0.24, 0.6, 0.081), (-0.1, 0.62, 0.081), (-0.1, 0.72, 0.081), (-0.24, 0.7, 0.081)], 'fabric-magenta')
    return m


def canopy_lights():
    """Two weatherproof tube fittings under the canopy (foot at its underside, hanging down), lit cold white, the cable
    between them clipped to the roof (0.25 x 0.12 x 5)."""
    m = Model('rd-cw-tubes')
    for x in (-1.5, 1.5):
        m.box(x - 0.08, x + 0.08, -0.1, 0.0, -1.6, 1.6, 'trim', bevel=0.01)
        m.box(x - 0.06, x + 0.06, -0.12, -0.1, -1.5, 1.5, 'win-white')
    m.tube((-1.5, -0.02, 1.6), (1.5, -0.02, 1.6), 0.012, 'cable', seg=6)
    return m


def courier():
    """Where the Hebi courier waits under the red lamp (§5, something left a moment ago; §14's clutter cluster): butts
    ground out round his spot, two cans of energy drink (one crushed), the paper cup of coffee with its lid still on, the
    foil of a sandwich, and at his foot the messenger bag with the parcel that belongs to Kaito's clients, its strap
    loose (1.1 x 0.35 x 0.9)."""
    m = Model('rd-cw-courier')
    for k in range(9):
        a = k * 2.3
        r = 0.2 + 0.3 * hashf(k, 1.0)
        x, z = r * math.cos(a), r * math.sin(a) * 0.8
        b = a * 1.9
        m.tube((x, 0.006, z), (x + 0.03 * math.cos(b), 0.006, z + 0.03 * math.sin(b)), 0.0055, 'win-white' if k % 3 else 'fabric-amber', seg=6)
    m.tube((0.32, 0.0, -0.3), (0.32, 0.12, -0.3), 0.033, 'neon-green', seg=12)
    m.lathe(0.32, -0.3, [(0.033, 0.0), (0.026, 0.008), (0.0, 0.008)], 'metal', seg=12, y0=0.12)
    m.tube((0.45, 0.025, -0.15), (0.55, 0.03, -0.1), 0.028, 'neon-green', seg=10)
    m.lathe(-0.3, 0.25, [(0.03, 0.0), (0.044, 0.13), (0.046, 0.13), (0.046, 0.145), (0.0, 0.15)], 'paint', seg=14)
    m.lathe(-0.3, 0.25, [(0.045, 0.0), (0.045, 0.02)], 'fabric-amber', seg=14, y0=0.05)
    m.box(0.05, 0.18, 0.0, 0.006, 0.3, 0.38, 'metal')
    m.box(0.1, 0.22, 0.006, 0.012, 0.33, 0.4, 'metal')
    # The messenger bag on its side, flap open, the parcel's corner and its tape showing.
    m.box(-0.55, -0.15, 0.0, 0.3, -0.25, -0.1, 'dark', bevel=0.03)
    m.obox((-0.35, 0.3, -0.06), (1, 0, 0), (0, 0.5, 0.86), (0.2, 0.01, 0.1), 'dark')
    m.box(-0.5, -0.22, 0.22, 0.34, -0.22, -0.12, 'fabric-amber', bevel=0.01)
    m.box(-0.5, -0.22, 0.3, 0.305, -0.18, -0.16, 'neon-red')
    m.tube((-0.15, 0.25, -0.18), (0.1, 0.01, 0.0), 0.012, 'dark', seg=6)
    m.tube((0.1, 0.01, 0.0), (0.25, 0.01, 0.15), 0.012, 'dark', seg=6)
    return m


MODELS = [gantry, machine_wall, chemistry, bay_floor, pay_post, canopy_lights, courier]
