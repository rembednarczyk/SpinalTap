"""Alchemia's food hall on P3 (`docs/pomieszczenia/alchemia-foodhall.md`, ADR-0098): the round things its seating had as
boxes (`packages/sim/src/content/alchemia/foodhall-seating.ts`): the paper lanterns over the tables and along the
atrium's balustrade, the bowls left on the tables, a cup, the stool knocked over by Fumiko's bar.

Sizes from the simulation: the tables 0.75 m high, the lanterns 0.36 x 0.45 (the strings' 0.24 x 0.3), the bowls 0.18 m
across, the stools 0.34 m across and 0.75 m high. Each model's foot is on y = 0 where it stands (a table's top, the
floor), a lantern's at its top where its cable holds it, its front to +z.
"""
import math

from shapes import Model, hashf

FILE = 'room-detail-alchemia-props.glb'


def lantern(r, h, key):
    """A paper lantern (chochin) hanging from its cable: black lacquered caps, the paper's bulge on its ribs lit warm from
    inside, a red band with the shop's character round its middle, a tassel (r across, h high; foot at its top)."""
    m = Model(key)
    cap = h * 0.1
    m.lathe(0, 0, [(r * 0.55, -cap), (r * 0.6, -cap * 0.4), (r * 0.5, 0.0), (0.0, 0.0)], 'dark', seg=14)
    prof = []
    n = 8
    for k in range(n + 1):
        t = k / n
        y = -cap - t * (h - 2 * cap)
        prof.append((r * (0.62 + 0.38 * math.sin(math.pi * t)), y))
    prof = list(reversed(prof))
    m.lathe(0, 0, prof, 'win-warm', seg=16, cap=False)
    # The ribs over the paper, but where the red band runs.
    for k in (1, 2, 6, 7):
        t = k / n
        y = -cap - t * (h - 2 * cap)
        rr = r * (0.62 + 0.38 * math.sin(math.pi * t)) + 0.002
        m.lathe(0, 0, [(rr, y - 0.003), (rr, y + 0.003)], 'dark', seg=16, cap=False)
    mid = -h / 2
    m.lathe(0, 0, [(r + 0.003, mid - h * 0.12), (r + 0.003, mid + h * 0.12)], 'neon-red', seg=16, cap=False)
    m.lathe(0, 0, [(0.0, -h), (r * 0.5, -h), (r * 0.55, -h + cap * 0.6), (r * 0.6, -h + cap)], 'dark', seg=14, cap=False)
    m.tube((0.0, -h, 0.0), (0.0, -h - 0.1, 0.0), 0.01, 'neon-red', seg=6)
    return m


def meal(variant, key):
    """What was left of a meal on its tray: a ramen bowl with its broth, noodles and an egg, or a donburi with its lid off
    and a tea cup; chopsticks across, a spoon (0.36 x 0.12 x 0.26)."""
    m = Model(key)
    m.box(-0.18, 0.18, 0.0, 0.012, -0.13, 0.13, 'fabric-amber' if variant == 0 else 'dark', bevel=0.004)
    y = 0.012
    if variant == 0:
        m.lathe(-0.02, 0.0, [(0.035, 0.0), (0.07, 0.02), (0.09, 0.07), (0.092, 0.08), (0.087, 0.08), (0.083, 0.07), (0.0, 0.065)], 'neon-red', seg=16, y0=y)
        m.lathe(-0.02, 0.0, [(0.08, 0.0), (0.0, 0.002)], 'fabric-amber', seg=16, y0=y + 0.064)
        m.lathe(0.01, 0.02, [(0.022, 0.0), (0.018, 0.01), (0.0, 0.012)], 'win-white', seg=10, y0=y + 0.064)
        m.box(-0.07, -0.03, y + 0.064, y + 0.07, -0.05, 0.02, 'plant')
        m.tube((-0.1, y + 0.085, 0.06), (0.14, y + 0.085, -0.02), 0.004, 'fabric-amber', seg=6)
        m.tube((-0.1, y + 0.085, 0.075), (0.14, y + 0.085, -0.005), 0.004, 'fabric-amber', seg=6)
        m.box(0.09, 0.17, y, y + 0.012, 0.05, 0.09, 'trim-light', bevel=0.004)
    else:
        m.lathe(-0.04, 0.0, [(0.04, 0.0), (0.075, 0.03), (0.085, 0.075), (0.0, 0.07)], 'dark', seg=16, y0=y)
        m.lathe(-0.04, 0.0, [(0.08, 0.0), (0.04, 0.015), (0.0, 0.02)], 'win-white', seg=14, y0=y + 0.07)
        m.lathe(0.11, -0.06, [(0.08, 0.0), (0.085, 0.02), (0.0, 0.025)], 'dark', seg=14, y0=y)
        m.lathe(0.12, 0.07, [(0.028, 0.0), (0.035, 0.06), (0.0, 0.055)], 'trim-light', seg=12, y0=y)
        m.tube((-0.13, y + 0.003, 0.1), (0.07, y + 0.003, 0.11), 0.004, 'fabric-amber', seg=6)
        m.tube((-0.13, y + 0.003, 0.112), (0.07, y + 0.003, 0.122), 0.004, 'fabric-amber', seg=6)
    return m


def cup():
    """A paper cup of iced tea standing on the table, its lid and straw (0.08 x 0.16)."""
    m = Model('rd-fh-cup')
    m.lathe(0, 0, [(0.03, 0.0), (0.04, 0.12), (0.0, 0.12)], 'fabric-teal', seg=14)
    m.lathe(0, 0, [(0.042, 0.0), (0.04, 0.008), (0.0, 0.012)], 'trim-light', seg=14, y0=0.12)
    m.tube((0.01, 0.13, 0.0), (0.02, 0.2, 0.0), 0.003, 'neon-pink', seg=6)
    return m


def spilled():
    """The cup knocked over by the spilled drink: on its side, its lid off beside it, the straw out (0.25 x 0.08)."""
    m = Model('rd-fh-spilled')
    m.tube((-0.06, 0.035, 0.0), (0.06, 0.04, 0.0), 0.037, 'fabric-teal', seg=14)
    m.lathe(0.11, 0.05, [(0.042, 0.0), (0.04, 0.008), (0.0, 0.012)], 'trim-light', seg=14)
    m.tube((0.08, 0.004, -0.06), (0.2, 0.004, -0.04), 0.003, 'neon-pink', seg=6)
    return m


def stool():
    """A bar stool knocked over on its side by Fumiko's bar: its round padded seat, four legs splayed, the foot ring
    (along x, 0.75 long, 0.34 high)."""
    m = Model('rd-fh-stool')
    r = 0.17
    m.tube((0.0, r, 0.0), (0.06, r, 0.0), r, 'fabric-magenta', seg=16)
    m.tube((0.06, r, 0.0), (0.075, r, 0.0), r - 0.02, 'dark', seg=16)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        p0 = (0.075, r + 0.12 * math.sin(a), 0.12 * math.cos(a))
        p1 = (0.75, r + 0.16 * math.sin(a), 0.16 * math.cos(a))
        m.tube(p0, p1, 0.012, 'metal', seg=6)
    for k in range(4):
        a0, a1 = math.pi / 4 + k * math.pi / 2, math.pi / 4 + (k + 1) * math.pi / 2
        m.tube((0.5, r + 0.145 * math.sin(a0), 0.145 * math.cos(a0)), (0.5, r + 0.145 * math.sin(a1), 0.145 * math.cos(a1)), 0.01, 'metal', seg=6)
    return m


def pot():
    """A stock pot on the cooker: steel, its two handles, the lid pushed half off, a ladle in it (0.36 x 0.3 x 0.32)."""
    m = Model('rd-fh-pot')
    m.lathe(0, 0, [(0.14, 0.0), (0.15, 0.01), (0.15, 0.24), (0.155, 0.25), (0.145, 0.25), (0.14, 0.24), (0.0, 0.2)], 'metal', seg=18)
    for x0, x1 in ((0.15, 0.185), (-0.185, -0.15)):
        m.box(x0, x1, 0.2, 0.22, -0.03, 0.03, 'dark')
    m.lathe(0.07, 0.03, [(0.155, 0.0), (0.15, 0.015), (0.05, 0.035), (0.0, 0.035)], 'metal', seg=18, y0=0.25)
    m.lathe(0.07, 0.03, [(0.02, 0.0), (0.02, 0.025), (0.0, 0.03)], 'dark', seg=8, y0=0.285)
    m.tube((-0.06, 0.18, 0.02), (-0.1, 0.33, -0.05), 0.008, 'metal', seg=6)
    return m


def bowls():
    """A stack of clean bowls by the line: six white bowls, one inside the next (0.3 x 0.2)."""
    m = Model('rd-fh-bowls')
    for k in range(6):
        y = k * 0.028
        m.lathe(0, 0, [(0.05, 0.0), (0.11, 0.03), (0.135, 0.06), (0.13, 0.062), (0.0, 0.035)], 'trim-light', seg=16, y0=y)
    m.lathe(0, 0, [(0.13, 0.0), (0.135, 0.003), (0.0, 0.003)], 'neon-red', seg=16, y0=5 * 0.028 + 0.055)
    return m


def teacup():
    """A yunomi tea cup by the till, still warm (0.08 x 0.1)."""
    m = Model('rd-fh-teacup')
    m.lathe(0, 0, [(0.028, 0.0), (0.035, 0.01), (0.04, 0.095), (0.036, 0.095), (0.0, 0.085)], 'fabric-teal', seg=14)
    m.lathe(0, 0, [(0.035, 0.0), (0.0, 0.001)], 'fabric-amber', seg=14, y0=0.08)
    return m


def gas():
    """A gas bottle for the cooker: a welded steel cylinder painted red, its foot ring, the collar round the valve, the
    regulator and its hose (0.3 x 0.95)."""
    m = Model('rd-fh-gas')
    m.lathe(0, 0, [(0.13, 0.0), (0.13, 0.06), (0.12, 0.07)], 'dark', seg=16, cap=False)
    m.lathe(0, 0, [(0.12, 0.06), (0.145, 0.1), (0.145, 0.68), (0.12, 0.76), (0.05, 0.8), (0.0, 0.8)], 'neon-red', seg=16)
    m.lathe(0, 0, [(0.1, 0.0), (0.1, 0.12), (0.09, 0.12)], 'neon-red', seg=12, y0=0.78, cap=False)
    m.cyl(0, 0, 0.02, 0.8, 0.88, 'metal', seg=8)
    m.lathe(0.0, 0.05, [(0.03, 0.0), (0.03, 0.03), (0.0, 0.03)], 'metal', seg=10, y0=0.86)
    m.tube((0.0, 0.88, 0.08), (0.05, 0.92, 0.2), 0.008, 'dark', seg=6)
    m.box(-0.08, 0.08, 0.35, 0.5, 0.145, 0.15, 'win-white')
    return m


def condiments():
    """The table's condiments on a black tray (§14's clutter cluster): a soy dispenser of glass with its red cap, a shichimi
    shaker, a pot of toothpicks, a cup of wrapped disposable chopsticks (0.24 x 0.16 x 0.14)."""
    m = Model('rd-fh-condiments')
    m.box(-0.12, 0.12, 0.0, 0.01, -0.07, 0.07, 'dark', bevel=0.003)
    y = 0.01
    m.lathe(-0.075, 0.0, [(0.025, 0.0), (0.03, 0.01), (0.03, 0.07), (0.02, 0.09), (0.0, 0.09)], 'glass-dark', seg=12, y0=y)
    m.lathe(-0.075, 0.0, [(0.014, 0.0), (0.012, 0.02), (0.0, 0.022)], 'neon-red', seg=10, y0=y + 0.09)
    m.tube((-0.075, y + 0.1, 0.0), (-0.05, y + 0.105, 0.0), 0.003, 'neon-red', seg=6)
    m.lathe(-0.02, 0.02, [(0.018, 0.0), (0.018, 0.06), (0.0, 0.065)], 'fabric-amber', seg=10, y0=y)
    m.lathe(-0.02, 0.02, [(0.019, 0.0), (0.019, 0.015), (0.0, 0.017)], 'neon-red', seg=10, y0=y + 0.06)
    m.lathe(0.025, -0.03, [(0.016, 0.0), (0.016, 0.045), (0.0, 0.045)], 'trim', seg=10, y0=y)
    for k in range(5):
        a = k * 1.2566
        m.tube((0.025 + 0.007 * math.cos(a), y + 0.04, -0.03 + 0.007 * math.sin(a)), (0.025 + 0.01 * math.cos(a), y + 0.07, -0.03 + 0.01 * math.sin(a)), 0.0015, 'trim-light', seg=4)
    m.lathe(0.08, 0.0, [(0.026, 0.0), (0.03, 0.08), (0.0, 0.08)], 'metal', seg=12, y0=y)
    for k in range(7):
        a = k * 0.9
        x, z = 0.08 + 0.014 * math.cos(a), 0.014 * math.sin(a)
        m.box(x - 0.005, x + 0.005, y + 0.02, y + 0.13 + 0.01 * (k % 3), z - 0.003, z + 0.003, 'win-white' if k % 2 else 'fabric-amber')
    return m


def leftovers():
    """What the eaters left by their tray: napkins crumpled into balls, the receipt with a ring from the glass, the water
    glass with an inch left in it (0.3 x 0.11 x 0.2)."""
    m = Model('rd-fh-leftovers')
    for k, (x, z, r) in enumerate(((-0.1, 0.03, 0.03), (-0.06, -0.04, 0.025), (-0.12, -0.05, 0.02))):
        m.lathe(x, z, [(r * 0.6, 0.0), (r, r * 0.5), (r * 0.8, r * 1.2), (r * 0.3 + 0.003 * k, r * 1.5), (0.0, r * 1.5)], 'win-white', seg=7)
    m.box(0.0, 0.07, 0.0, 0.002, -0.07, 0.04, 'trim-light')
    m.box(0.012, 0.058, 0.002, 0.003, -0.05, -0.045, 'dark')
    m.lathe(0.09, 0.03, [(0.026, 0.0), (0.032, 0.11), (0.03, 0.11), (0.024, 0.005), (0.0, 0.005)], 'glass-blue', seg=14, cap=False)
    m.lathe(0.09, 0.03, [(0.026, 0.0), (0.0, 0.001)], 'glass-blue', seg=14, y0=0.025)
    return m


def till():
    """The till on a kitchen's counter by the keeper's cup: the card terminal on its stand with its screen lit, a spike of
    order slips, a jar of tips with coins in it, a biro (0.34 x 0.16 x 0.2)."""
    m = Model('rd-fh-till')
    m.box(-0.17, -0.07, 0.0, 0.015, -0.06, 0.06, 'dark', bevel=0.004)
    m.box(-0.155, -0.085, 0.015, 0.16, -0.035, 0.0, 'dark', bevel=0.006)
    m.box(-0.148, -0.092, 0.08, 0.145, 0.0, 0.003, 'neon-green')
    m.box(-0.15, -0.09, 0.025, 0.07, 0.0, 0.004, 'trim')
    m.cyl(-0.02, 0.02, 0.025, 0.0, 0.008, 'metal', seg=10)
    m.tube((-0.02, 0.008, 0.02), (-0.02, 0.15, 0.02), 0.0015, 'metal', seg=4)
    for k in range(4):
        y = 0.012 + k * 0.012
        m.box(-0.06, 0.02, y, y + 0.002, -0.02 + 0.006 * k, 0.06 - 0.004 * k, 'trim-light')
    m.lathe(0.09, 0.0, [(0.035, 0.0), (0.037, 0.12), (0.04, 0.125), (0.0, 0.125)], 'glass-blue', seg=14, cap=False)
    m.lathe(0.09, 0.0, [(0.033, 0.0), (0.02, 0.025), (0.0, 0.03)], 'neon-amber', seg=10, y0=0.002)
    m.box(0.07, 0.11, 0.06, 0.09, 0.037, 0.039, 'trim-light')
    m.tube((-0.06, 0.004, -0.07), (0.07, 0.004, -0.05), 0.004, 'fabric-teal', seg=6)
    return m


def prep():
    """By the stack of bowls on a kitchen's line: a steel bin of chopsticks, a jug with a ladle in it, two squeeze bottles
    (a red sauce, a yellow mayo) (0.36 x 0.3 x 0.16)."""
    m = Model('rd-fh-prep')
    m.box(-0.18, -0.08, 0.0, 0.13, -0.05, 0.05, 'metal', bevel=0.004)
    for k in range(9):
        x, z = -0.165 + (k % 3) * 0.035, -0.03 + (k // 3) * 0.03
        m.box(x, x + 0.006, 0.1, 0.24 + 0.01 * (k % 2), z, z + 0.006, 'fabric-amber')
    m.lathe(-0.01, 0.0, [(0.045, 0.0), (0.05, 0.16), (0.055, 0.17), (0.0, 0.17)], 'metal', seg=14, cap=False)
    m.lathe(-0.01, 0.0, [(0.045, 0.0), (0.0, 0.001)], 'metal', seg=14)
    m.tube((-0.01, 0.06, 0.0), (0.03, 0.3, 0.02), 0.006, 'metal', seg=6)
    m.lathe(0.03, 0.02, [(0.025, 0.0), (0.0, 0.01)], 'metal', seg=10, y0=0.3)
    for x, role in ((0.09, 'neon-red'), (0.145, 'neon-amber')):
        m.lathe(x, 0.0, [(0.022, 0.0), (0.024, 0.13), (0.012, 0.15), (0.004, 0.19), (0.0, 0.19)], role, seg=12)
    return m


MODELS = [lambda: lantern(0.18, 0.45, 'rd-fh-lantern'), lambda: lantern(0.12, 0.3, 'rd-fh-lantern-small'), lambda: meal(0, 'rd-fh-ramen'),
          lambda: meal(1, 'rd-fh-donburi'), cup, spilled, stool,
          pot, bowls, teacup, gas, condiments, leftovers, till, prep]
