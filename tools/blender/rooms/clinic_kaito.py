"""Mori's clinic after its card (`docs/pomieszczenia/clinic.md`, ADR-0102 point 5, ADR-0098): the stool Kaito sat on
by the chair the nights Seki did not wake, his mug on it gone cold, the butts he stubbed out on the tiles though Mori
told him not to.

Its foot is on y = 0 at the clinic's floor. Variations from `hashf`, so the same script gives the same file. Comic
realism (`docs/zasady-lokacji.md` §9): a real round workshop stool on its three legs.
"""
import math

from shapes import Model, hashf

# A file of its own (the user's rule of 23.11: no shared bake while other scenes bake theirs; 768 KiB a file).
FILE = 'room-detail-klinika-props.glb'


def stool():
    """Kaito's stool (0.36 m across, 0.62 m high): three splayed steel legs on a ring, the round seat in cracked
    vinyl; his enamel mug on it, a saucer for an ashtray on the tiles with butts in it and round it (0.8 x 0.72 x 0.8)."""
    m = Model('rd-clinic-stool')
    for k in range(3):
        a = 2 * math.pi * k / 3
        m.tube((0.16 * math.cos(a), 0.0, 0.16 * math.sin(a)), (0.1 * math.cos(a), 0.6, 0.1 * math.sin(a)), 0.012, 'metal', seg=6)
    for k in range(3):
        a0, a1 = 2 * math.pi * k / 3, 2 * math.pi * (k + 1) / 3
        m.tube((0.14 * math.cos(a0), 0.22, 0.14 * math.sin(a0)), (0.14 * math.cos(a1), 0.22, 0.14 * math.sin(a1)), 0.008, 'metal', seg=5)
    m.lathe(0.0, 0.0, [(0.0, 0.0), (0.17, 0.0), (0.18, 0.03), (0.16, 0.06), (0.0, 0.065)], 'fabric-teal', seg=16, y0=0.6)
    m.tube((-0.06, 0.664, 0.02), (0.05, 0.664, 0.07), 0.002, 'dark', seg=4)
    m.lathe(0.07, -0.04, [(0.0, 0.0), (0.04, 0.0), (0.042, 0.09), (0.0, 0.09)], 'trim-light', seg=12, y0=0.665)
    m.tube((0.112, 0.73, -0.04), (0.13, 0.69, -0.04), 0.008, 'trim-light', seg=5)
    m.lathe(0.3, 0.25, [(0.0, 0.0), (0.07, 0.0), (0.08, 0.012), (0.0, 0.01)], 'trim-light', seg=14, y0=0.0)
    for k in range(9):
        a = hashf(k, 1.0) * math.pi
        r = 0.05 + 0.3 * hashf(k, 2.0)
        t = 2 * math.pi * hashf(k, 3.0)
        x, z = 0.3 + r * math.cos(t), 0.25 + r * math.sin(t)
        y = 0.014 if r < 0.07 else 0.005
        m.tube((x, y, z), (x + 0.03 * math.cos(a), y, z + 0.03 * math.sin(a)), 0.0045, 'win-white' if k % 3 else 'fabric-amber', seg=5)
    return m


MODELS = [stool]
