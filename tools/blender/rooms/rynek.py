"""The Rynek of the Old Town after the scene's card (`docs/lokacje/rynek.md`, ADR-0102 point 5, ADR-0098): Tetsu's
folding table of gadgets in front of DENKI, the boxes and cables under DENKI's window, the sake barrels and the crate of
empties at SAKE's door, the song board, the flyers and the butts at KARAOKE's.

Sizes from the simulation (`packages/sim/src/content/district-kanal.ts`): Tetsu's table is the solid's 1.4 x 0.9 x 0.7 m
(its middle at the origin, its long side along x, its front, where the customers stand, to +z). The other models stand
at a front's foot (the wall at z 0, the street at +z). Variations from `hashf`, so the same script gives the same file.
Comic realism (`docs/zasady-lokacji.md` §9): a real trestle table of a street electronics seller, real sake taru with
their straw, a real chalk A-board.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-rynek-props.glb'

TOP = 0.9


def table():
    """Tetsu's folding table (1.4 x 0.9 x 0.7): its steel trestles, the board under a green cloth, the gadgets in rows
    (phones with their screens lit, a drone's arms, a soldering station with its lamp, an old radio, cables), the price
    cards, and under it the power strip on a car battery and a box of spares."""
    m = Model('rd-ry-table')
    for s in (-1, 1):
        x = s * 0.58
        for z in (-0.28, 0.28):
            m.tube((x, 0.0, z), (x, TOP - 0.04, z * 0.6), 0.016, 'metal', seg=8)
        m.tube((x, 0.35, -0.2), (x, 0.35, 0.2), 0.012, 'metal', seg=6)
    m.box(-0.7, 0.7, TOP - 0.04, TOP, -0.35, 0.35, 'door', bevel=0.005)
    m.box(-0.7, 0.7, TOP, TOP + 0.004, -0.35, 0.35, 'plant')
    m.box(-0.7, 0.7, TOP - 0.18, TOP, 0.348, 0.352, 'plant')
    # Phones in two rows, face up, their screens lit.
    for k in range(8):
        x = -0.6 + (k % 4) * 0.13
        z = 0.12 + (k // 4) * 0.16
        m.box(x, x + 0.07, TOP + 0.004, TOP + 0.014, z, z + 0.14, 'dark', bevel=0.003)
        m.box(x + 0.005, x + 0.065, TOP + 0.014, TOP + 0.016, z + 0.01, z + 0.13, 'neon-cyan' if k % 3 else 'glass-blue')
    # A drone's body and its four arms, a propeller on two of them.
    m.box(-0.05, 0.1, TOP + 0.004, TOP + 0.05, -0.05, 0.08, 'trim', bevel=0.01)
    for a in (0.7, 2.4, 3.9, 5.5):
        m.tube((0.025, TOP + 0.03, 0.015), (0.025 + 0.16 * math.cos(a), TOP + 0.03, 0.015 + 0.16 * math.sin(a)), 0.008, 'dark', seg=6)
    for a in (0.7, 3.9):
        cx, cz = 0.025 + 0.16 * math.cos(a), 0.015 + 0.16 * math.sin(a)
        m.box(cx - 0.06, cx + 0.06, TOP + 0.04, TOP + 0.045, cz - 0.008, cz + 0.008, 'neon-red')
    # The soldering station, its iron in the stand, the lamp on its arm over the table's east end.
    m.box(0.3, 0.48, TOP + 0.004, TOP + 0.09, -0.25, -0.1, 'dark', bevel=0.01)
    m.box(0.33, 0.39, TOP + 0.06, TOP + 0.08, -0.101, -0.099, 'neon-red')
    m.tube((0.52, TOP + 0.004, -0.18), (0.55, TOP + 0.12, -0.1), 0.006, 'metal', seg=6)
    m.tube((0.62, TOP, -0.3), (0.62, TOP + 0.45, -0.28), 0.01, 'metal', seg=6)
    m.tube((0.62, TOP + 0.45, -0.28), (0.45, TOP + 0.55, -0.05), 0.01, 'metal', seg=6)
    m.lathe(0.45, -0.05, [(0.0, 0.0), (0.07, 0.0), (0.05, 0.06), (0.0, 0.07)], 'trim-light', seg=12, y0=TOP + 0.48)
    m.lathe(0.45, -0.05, [(0.0, 0.0), (0.06, 0.0), (0.0, 0.005)], 'win-warm', seg=12, y0=TOP + 0.475)
    # The old radio with its aerial and the cables coiled by it.
    m.box(-0.62, -0.32, TOP + 0.004, TOP + 0.17, -0.3, -0.18, 'rust', bevel=0.01)
    m.cyl(-0.54, -0.179, 0.04, TOP + 0.05, TOP + 0.13, 'dark', seg=12)
    m.tube((-0.34, TOP + 0.17, -0.25), (-0.2, TOP + 0.5, -0.3), 0.003, 'metal', seg=5)
    for k in range(9):
        a0, a1 = 2 * math.pi * k / 9, 2 * math.pi * (k + 1) / 9
        m.tube((-0.2 + 0.08 * math.cos(a0), TOP + 0.012, -0.15 + 0.08 * math.sin(a0)), (-0.2 + 0.08 * math.cos(a1), TOP + 0.012, -0.15 + 0.08 * math.sin(a1)), 0.008, 'cable', seg=5)
    # The price cards on the front edge.
    for k in range(4):
        x = -0.55 + k * 0.32
        m.obox((x, TOP + 0.04, 0.33), (1, 0, 0), (0, 0.9, -0.43), (0.045, 0.035, 0.002), 'win-white')
    # Under it: the car battery, the power strip on it with its leads up the leg, a box of spares.
    m.box(-0.2, 0.12, 0.0, 0.2, -0.2, 0.0, 'dark', bevel=0.01)
    m.box(-0.18, 0.1, 0.2, 0.24, -0.12, -0.06, 'trim-light')
    m.tube((0.1, 0.22, -0.09), (0.58, 0.6, -0.17), 0.006, 'cable', seg=5)
    m.box(0.25, 0.6, 0.0, 0.25, -0.3, 0.05, 'trim', bevel=0.01)
    return m


def denki():
    """Under DENKI's window (the wall at z 0): boxes of electronics stacked, one open with its parts, a cracked screen
    leaning on the wall, a coil of cable and battery packs (1.6 x 1.1 x 0.7)."""
    m = Model('rd-ry-denki')
    m.box(-0.75, -0.2, 0.0, 0.4, 0.05, 0.55, 'trim', bevel=0.01)
    m.box(-0.7, -0.25, 0.4, 0.7, 0.1, 0.5, 'trim-light', bevel=0.01)
    m.box(-0.1, 0.4, 0.0, 0.3, 0.1, 0.6, 'trim', bevel=0.01)
    m.box(-0.06, 0.36, 0.25, 0.3, 0.14, 0.56, 'dark')
    for k in range(5):
        x = -0.02 + k * 0.07
        m.box(x, x + 0.05, 0.25, 0.33 + 0.03 * hashf(k, 1.0), 0.2 + 0.05 * (k % 2), 0.32 + 0.05 * (k % 2), 'glass-blue' if k % 2 else 'neon-green')
    m.obox((0.6, 0.45, 0.08), (1, 0, 0), (0, 0.98, 0.2), (0.25, 0.4, 0.02), 'dark')
    m.obox((0.6, 0.45, 0.1), (1, 0, 0), (0, 0.98, 0.2), (0.22, 0.36, 0.002), 'glass-blue')
    m.tube((0.45, 0.55, 0.105), (0.72, 0.3, 0.12), 0.003, 'win-white', seg=4)
    for k in range(10):
        a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
        m.tube((0.2 + 0.14 * math.cos(a0), 0.012, 0.75 + 0.14 * math.sin(a0) * 0.4), (0.2 + 0.14 * math.cos(a1), 0.012, 0.75 + 0.14 * math.sin(a1) * 0.4), 0.012, 'cable', seg=5)
    for k in range(3):
        m.box(-0.15 + k * 0.1, -0.07 + k * 0.1, 0.0, 0.08, 0.65, 0.78, 'neon-amber' if k == 1 else 'dark', bevel=0.005)
    return m


def sake():
    """At SAKE's door (the wall at z 0): two sake barrels in their straw, one on its side as a seat, the other with
    cups on its lid, a crate of empty bottles, a lantern's bracket with a red paper lantern (1.4 x 1.9 x 0.9)."""
    m = Model('rd-ry-sake')
    prof = [(0.0, 0.0), (0.22, 0.0), (0.25, 0.08), (0.26, 0.3), (0.25, 0.52), (0.22, 0.6), (0.0, 0.6)]
    m.lathe(-0.45, 0.35, prof, 'fabric-amber', seg=16, y0=0.0)
    for y in (0.08, 0.3, 0.52):
        m.lathe(-0.45, 0.35, [(0.0, 0.0), (0.262, 0.0), (0.262, 0.025), (0.0, 0.025)], 'dark', seg=16, y0=y)
    m.lathe(-0.45, 0.35, [(0.0, 0.0), (0.2, 0.0), (0.2, 0.005), (0.0, 0.006)], 'door', seg=16, y0=0.6)
    for k in range(3):
        a = k * 2.1
        m.lathe(-0.45 + 0.1 * math.cos(a), 0.35 + 0.1 * math.sin(a), [(0.0, 0.0), (0.025, 0.0), (0.03, 0.035), (0.0, 0.035)], 'trim-light', seg=8, y0=0.606)
    m.tube((0.05, 0.25, 0.55), (0.65, 0.25, 0.55), 0.25, 'fabric-amber', seg=16)
    for x in (0.12, 0.35, 0.58):
        m.tube((x, 0.25, 0.55), (x + 0.025, 0.25, 0.55), 0.255, 'dark', seg=16)
    m.box(0.15, 0.6, 0.0, 0.25, 0.05, 0.3, 'rust', bevel=0.01)
    for k in range(6):
        x = 0.2 + (k % 3) * 0.15
        z = 0.1 + (k // 3) * 0.12
        m.lathe(x, z, [(0.0, 0.0), (0.03, 0.0), (0.032, 0.2), (0.012, 0.26), (0.0, 0.26)], 'glass-dark' if k % 2 else 'glass-blue', seg=8, y0=0.05)
    m.tube((-0.2, 1.85, 0.0), (-0.2, 1.85, 0.4), 0.012, 'metal', seg=6)
    m.lathe(-0.2, 0.4, [(0.0, 0.0), (0.1, 0.03), (0.14, 0.17), (0.1, 0.32), (0.0, 0.35)], 'neon-red', seg=14, y0=1.45)
    return m


def karaoke():
    """At KARAOKE's door (the wall at z 0): the chalk A-board with tonight's songs and prices, flyers stuck on the wall
    one over another, butts in the joint, a crushed can (1.3 x 1.5 x 0.8)."""
    m = Model('rd-ry-karaoke')
    bx, bz = 0.35, 0.55
    for s in (-1, 1):
        m.obox((bx, 0.45, bz + s * 0.12), (1, 0, 0), (0, 0.97, -s * 0.24), (0.3, 0.46, 0.012), 'door')
        m.obox((bx, 0.48, bz + s * 0.133), (1, 0, 0), (0, 0.97, -s * 0.24), (0.26, 0.4, 0.002), 'dark')
    for k in range(6):
        w = 0.12 + 0.18 * hashf(k, 3.0)
        m.obox((bx - 0.2 + w / 2, 0.75 - k * 0.1, bz - 0.135), (1, 0, 0), (0, 0.97, 0.24), (w / 2, 0.012, 0.001), 'neon-pink' if k == 0 else 'win-white')
    for k in range(7):
        x = -0.6 + 0.12 * k + 0.05 * hashf(k, 4.0)
        y = 1.0 + 0.35 * hashf(k, 5.0)
        role = ('neon-pink', 'neon-cyan', 'win-white', 'fabric-amber')[k % 4]
        m.box(x, x + 0.2, y, y + 0.28, 0.0, 0.003 + 0.001 * k, role)
    for k in range(10):
        a = hashf(k, 6.0) * math.pi
        x = -0.6 + 1.1 * hashf(k, 7.0)
        z = 0.03 + 0.5 * hashf(k, 8.0) ** 2
        m.tube((x, 0.006, z), (x + 0.032 * math.cos(a), 0.006, z + 0.032 * math.sin(a)), 0.0045, 'win-white' if k % 3 else 'fabric-amber', seg=5)
    m.tube((-0.3, 0.025, 0.4), (-0.2, 0.025, 0.46), 0.03, 'neon-red', seg=10)
    return m


MODELS = [table, denki, sake, karaoke]
