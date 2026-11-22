"""The capsule room on Jezuicka (`docs/pomieszczenia/capsule.md`, ADR-0098): what the last tenant left and the room's own
fittings the bought model (igor.tesV's Futuristic Compact Room, `room-props.glb`) has not got.

The sizes come from the model, measured in Blender: the kitchen counter's top at 0.87 m with the sink's basin 0.2 m
deep in it, the mattress at 0.92 m, the chest's lid at 0.44 m. Each model's foot is on y = 0 where it stands (the
counter, the basin's bottom, the lid, the floor, a wall), centred on x and z, its front to +z.
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-stare-props.glb'


def door():
    """The sliding door, pushed open along the front wall's inside: a steel leaf with a pull and a kick plate, its top rail
    over the doorway, the card lock on the other jamb with its green light (leaf 1.14 x 2.25, the rail 2.3 m long)."""
    m = Model('rd-capsule-door')
    w, h = 1.14, 2.25
    m.box(-w / 2, w / 2, 0.02, h, 0.012, 0.052, 'trim-light', bevel=0.008)
    m.box(-w / 2 + 0.04, w / 2 - 0.04, 0.03, 0.26, 0.052, 0.056, 'metal')
    # The pull: a slot along the leaf's free edge (towards the doorway, -x) and a bar in it.
    m.box(-w / 2 + 0.05, -w / 2 + 0.09, 0.85, 1.25, 0.052, 0.055, 'dark')
    m.tube((-w / 2 + 0.07, 0.88, 0.07), (-w / 2 + 0.07, 1.22, 0.07), 0.012, 'metal')
    m.tube((-w / 2 + 0.07, 0.88, 0.07), (-w / 2 + 0.07, 0.88, 0.052), 0.01, 'metal')
    m.tube((-w / 2 + 0.07, 1.22, 0.07), (-w / 2 + 0.07, 1.22, 0.052), 0.01, 'metal')
    # A peephole and a sticker someone scratched at.
    m.cyl(0.0, 0.054, 0.014, 1.55, 1.57, 'dark', seg=8)
    m.box(0.12, 0.3, 1.32, 1.42, 0.052, 0.054, 'fabric-magenta')
    # The rail: from the doorway's far jamb to the side wall, its hangers on the leaf.
    m.box(-w / 2 - 1.17, w / 2 + 0.01, h + 0.03, h + 0.11, 0.0, 0.07, 'metal', bevel=0.01)
    for x in (-w / 2 + 0.15, w / 2 - 0.15):
        m.box(x - 0.03, x + 0.03, h - 0.02, h + 0.03, 0.02, 0.045, 'dark')
        m.cyl(x, 0.035, 0.022, h + 0.03, h + 0.06, 'dark', seg=8)
    # The card lock on the wall past the doorway: a reader with a slot, its light green (the room is let).
    x = -w / 2 - 1.24
    m.box(x - 0.045, x + 0.045, 1.0, 1.16, 0.0, 0.035, 'dark', bevel=0.008)
    m.box(x - 0.03, x + 0.03, 1.11, 1.13, 0.035, 0.037, 'neon-green')
    m.box(x - 0.03, x + 0.03, 1.03, 1.035, 0.03, 0.036, 'trim')
    return m


def hooks():
    """Coat hooks by the door on the side wall: a strip with four hooks, a canvas bag and a cap on two of them (0.6 x 0.45)."""
    m = Model('rd-capsule-hooks')
    m.box(-0.3, 0.3, 1.7, 1.78, 0.0, 0.02, 'trim', bevel=0.005)
    for k in range(4):
        x = -0.225 + k * 0.15
        m.tube((x, 1.74, 0.02), (x, 1.71, 0.08), 0.008, 'metal', seg=6)
        m.tube((x, 1.71, 0.08), (x, 1.75, 0.1), 0.008, 'metal', seg=6)
    # The bag hangs from the second hook by its handles, its bottom heavy with something.
    x = -0.075
    m.tube((x, 1.73, 0.085), (x - 0.11, 1.48, 0.06), 0.008, 'fabric-amber', seg=6)
    m.tube((x, 1.73, 0.085), (x + 0.11, 1.48, 0.06), 0.008, 'fabric-amber', seg=6)
    m.box(x - 0.17, x + 0.17, 1.08, 1.5, 0.025, 0.09, 'fabric-amber', bevel=0.02)
    m.box(x - 0.08, x + 0.08, 1.24, 1.36, 0.09, 0.093, 'dark')
    # The cap on the last hook: a crown and a peak.
    x = 0.225
    m.lathe(x, 0.12, [(0.09, 0.0), (0.088, 0.05), (0.06, 0.09), (0.0, 0.1)], 'fabric-teal', seg=12, y0=1.58)
    m.box(x - 0.06, x + 0.06, 1.58, 1.59, 0.2, 0.28, 'fabric-teal')
    return m


def trash():
    """The last tenant's rubbish by the door: a black bag tied at the neck, a flattened box and a can that missed (0.5 x 0.55)."""
    m = Model('rd-capsule-trash')
    m.lathe(0.0, 0.0, [(0.14, 0.0), (0.21, 0.08), (0.23, 0.22), (0.2, 0.36), (0.1, 0.44), (0.04, 0.46), (0.05, 0.5),
                       (0.06, 0.53), (0.0, 0.54)], 'dark', seg=14)
    # The knot's ears.
    m.tube((0.0, 0.5, 0.0), (0.09, 0.56, 0.03), 0.018, 'dark', seg=6)
    m.tube((0.0, 0.5, 0.0), (-0.08, 0.55, -0.04), 0.018, 'dark', seg=6)
    # A pizza box leant against the wall behind it and a can on its side.
    m.box(-0.25, 0.1, 0.0, 0.36, -0.24, -0.2, 'fabric-amber', bevel=0.005)
    m.box(-0.18, 0.02, 0.2, 0.3, -0.2, -0.198, 'neon-red')
    m.tube((0.17, 0.033, 0.12), (0.29, 0.033, 0.18), 0.033, 'metal', seg=10)
    return m


def sink():
    """The dishes left in the basin: a plate with a ring of sauce, a mug on it with a spoon in it, a fork (0.3 x 0.13)."""
    m = Model('rd-capsule-sink')
    m.lathe(-0.04, 0.0, [(0.06, 0.0), (0.1, 0.01), (0.12, 0.022), (0.0, 0.022)], 'trim-light', seg=16)
    m.lathe(-0.04, 0.0, [(0.065, 0.0), (0.05, 0.002), (0.0, 0.002)], 'brick', seg=12, y0=0.021)
    m.lathe(0.06, 0.02, [(0.035, 0.0), (0.042, 0.01), (0.044, 0.095), (0.04, 0.095), (0.038, 0.012), (0.0, 0.012)],
            'fabric-teal', seg=14, y0=0.022)
    m.tube((0.105, 0.05, 0.02), (0.105, 0.1, 0.02), 0.009, 'fabric-teal', seg=6)
    m.tube((0.05, 0.03, 0.02), (0.02, 0.15, 0.04), 0.004, 'metal', seg=6)
    m.tube((-0.14, 0.024, -0.06), (0.0, 0.028, -0.09), 0.004, 'metal', seg=6)
    return m


def food():
    """Food from the machine on the counter (along x, the wall at -z): a noodle cup with its lid half off and chopsticks,
    a sandwich's triangle box, a crushed crisp bag, an energy drink, napkins (0.9 x 0.45)."""
    m = Model('rd-capsule-food')
    # The noodle cup.
    m.lathe(-0.3, 0.0, [(0.045, 0.0), (0.06, 0.11), (0.062, 0.115), (0.0, 0.115)], 'trim-light', seg=14)
    m.lathe(-0.3, 0.0, [(0.061, 0.0), (0.063, 0.018), (0.0, 0.018)], 'neon-red', seg=14, y0=0.08)
    m.box(-0.36, -0.24, 0.116, 0.119, -0.06, 0.03, 'metal')
    m.box(-0.34, -0.25, 0.12, 0.18, 0.03, 0.035, 'metal')
    m.tube((-0.32, 0.1, 0.0), (-0.18, 0.2, 0.08), 0.005, 'fabric-amber', seg=6)
    m.tube((-0.31, 0.1, 0.01), (-0.17, 0.19, 0.1), 0.005, 'fabric-amber', seg=6)
    # The sandwich box, a triangle prism lying on its side (empty, the film torn).
    m.lathe(0.0, -0.02, [(0.09, 0.0), (0.09, 0.065), (0.0, 0.065)], 'win-white', seg=3)
    m.box(-0.03, 0.0, 0.065, 0.068, -0.03, 0.0, 'fabric-amber')
    m.box(0.01, 0.025, 0.065, 0.067, -0.05, -0.035, 'fabric-amber')
    # The crisp bag, crushed: two bevelled slabs at an angle.
    m.box(0.12, 0.3, 0.0, 0.03, -0.08, 0.05, 'neon-violet', bevel=0.012)
    m.box(0.15, 0.27, 0.025, 0.05, -0.06, 0.02, 'neon-violet', bevel=0.01)
    # The can, standing, and napkins.
    m.cyl(0.37, -0.1, 0.033, 0.0, 0.155, 'neon-green', seg=12)
    m.lathe(0.37, -0.1, [(0.033, 0.0), (0.028, 0.01), (0.0, 0.01)], 'metal', seg=12, y0=0.155)
    for k in range(3):
        h = hashf(k, 3.1)
        m.box(0.28 + 0.02 * h, 0.4 + 0.02 * h, 0.003 * k, 0.003 * k + 0.003, 0.03 + 0.01 * k, 0.15 + 0.01 * k, 'win-white')
    return m


def towel():
    """A towel thrown on the bed, half folded, draped over the mattress's front edge (+z) onto the frame's lip 11 cm
    lower (0.7 x 0.6)."""
    m = Model('rd-capsule-towel')
    m.box(-0.35, 0.2, 0.0, 0.025, -0.18, 0.2, 'fabric-amber', bevel=0.01)
    m.box(-0.3, 0.12, 0.025, 0.05, -0.15, 0.1, 'fabric-amber', bevel=0.01)
    m.box(0.15, 0.35, 0.0, 0.02, -0.1, 0.2, 'fabric-amber', bevel=0.008)
    # Over the edge: down the mattress's face and out along the lip.
    m.box(-0.2, 0.34, -0.11, 0.015, 0.2, 0.225, 'fabric-amber', bevel=0.006)
    m.box(-0.2, 0.34, -0.115, -0.09, 0.2, 0.38, 'fabric-amber', bevel=0.006)
    m.box(-0.34, 0.18, 0.024, 0.026, 0.0, 0.01, 'trim-light')
    return m


def charger():
    """On the chest's lid: a phone face up with its screen lit, a power bank, their cable down the chest's side to the
    socket in the wall at the lid's right (+x), a second cable hanging loose (0.6 x 0.3)."""
    m = Model('rd-capsule-charger')
    m.box(-0.2, -0.125, 0.0, 0.009, -0.08, 0.075, 'dark', bevel=0.004)
    m.box(-0.195, -0.13, 0.009, 0.0095, -0.072, 0.067, 'win-teal')
    m.box(-0.06, 0.04, 0.0, 0.022, -0.06, 0.01, 'trim', bevel=0.006)
    m.box(0.03, 0.041, 0.008, 0.014, -0.04, -0.01, 'neon-blue')
    # The cable: phone to bank, bank over the lid's back edge to the socket.
    pts = [(-0.125, 0.004, 0.0), (-0.09, 0.004, 0.03), (-0.06, 0.006, -0.02)]
    pts2 = [(0.04, 0.01, -0.03), (0.14, 0.004, -0.05), (0.24, 0.004, -0.02), (0.27, -0.02, 0.0), (0.27, -0.12, 0.0),
            (0.3, -0.14, 0.0)]
    for a, b in list(zip(pts, pts[1:])) + list(zip(pts2, pts2[1:])):
        m.tube(a, b, 0.004, 'cable', seg=6)
    # The socket on the wall: a double outlet plate, the plug in the left one.
    m.box(0.3, 0.32, -0.2, -0.08, -0.08, 0.08, 'trim-light', bevel=0.004)
    m.box(0.295, 0.3, -0.16, -0.12, -0.04, 0.0, 'dark')
    # A loose cable from the lid's front edge.
    loose = [(-0.02, 0.003, 0.02), (0.05, 0.003, 0.07), (0.08, -0.02, 0.1), (0.08, -0.2, 0.1)]
    for a, b in zip(loose, loose[1:]):
        m.tube(a, b, 0.003, 'cable', seg=6)
    return m


def rules():
    """The rental card on the wall by the door: a laminated A5 with the house rules, a QR code for the app, the wifi
    password written on in marker, tape at its corners (0.15 x 0.21)."""
    m = Model('rd-capsule-rules')
    w, h = 0.148, 0.21
    m.box(-w / 2, w / 2, 0.0, h, 0.0, 0.003, 'win-white')
    m.box(-w / 2 + 0.01, w / 2 - 0.01, h - 0.03, h - 0.012, 0.003, 0.004, 'neon-cyan')
    for k in range(6):
        y = h - 0.05 - k * 0.014
        m.box(-w / 2 + 0.012, w / 2 - 0.012 - 0.03 * hashf(k, 7.0), y, y + 0.005, 0.003, 0.004, 'dark')
    # The QR code: a grid of dark modules, its three finder squares at the corners.
    q0x, q0y, s = -w / 2 + 0.012, 0.03, 0.006
    for i in range(9):
        for j in range(9):
            finder = (i < 3 and j < 3) or (i > 5 and j < 3) or (i < 3 and j > 5)
            if finder or hashf(i, j, 11.0) < 0.5:
                m.box(q0x + i * s, q0x + (i + 1) * s, q0y + j * s, q0y + (j + 1) * s, 0.003, 0.0042, 'dark')
    m.box(0.01, w / 2 - 0.01, 0.045, 0.058, 0.003, 0.0045, 'neon-blue')
    for x, y in ((-w / 2, h), (w / 2, h), (-w / 2, 0.0), (w / 2, 0.0)):
        m.box(x - 0.012, x + 0.012, y - 0.01, y + 0.01, 0.0035, 0.0045, 'fabric-amber')
    return m


MODELS = [door, hooks, trash, sink, food, towel, charger, rules]
