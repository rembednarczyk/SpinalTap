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


MODELS = [lambda: lantern(0.18, 0.45, 'rd-fh-lantern'), lambda: lantern(0.12, 0.3, 'rd-fh-lantern-small'), lambda: meal(0, 'rd-fh-ramen'),
          lambda: meal(1, 'rd-fh-donburi'), cup, spilled, stool]
