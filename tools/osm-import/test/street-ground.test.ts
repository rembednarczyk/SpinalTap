import { describe, expect, it } from "vitest";
import { type Pt } from "../src/geometry.ts";
import { type Area, areaOfRing, holds, join, sizeOf, within } from "../src/streets/clip.ts";
import { type StreetEdge, streetAreas, streetGround } from "../src/streets/street-ground.ts";

/** ADR-0104 E1: the streets' ground from the street graph, on made-up junctions. */

const street = (way: string, axis: Pt[], half: number, walk = 2.5, kerbRadius = 3): StreetEdge => ({ way, axis, left: half, right: half, walkLeft: walk, walkRight: walk, kerbRadius });
const areaOf = (rs: readonly (readonly Pt[])[]): Area => join(...rs.map(areaOfRing));

/** Points every `step` m along a ring. */
const dense = (ring: readonly Pt[], step = 0.1): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i]!, ring[(i + 1) % ring.length]!];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  return out;
};

/**
 * The jags of an outline: the most a point strays from the chord between the points 1 m before
 * and after it, where the outline turns back the other way within that metre (a notch or a spike,
 * not an arc: an arc of 3 m keeps turning one way).
 */
const jags = (ring: readonly Pt[], limit = 0.1): Pt[] => {
  const p = dense(ring);
  const n = p.length;
  const turn = (i: number) => {
    const [a, b, c] = [p[(i - 1 + n) % n]!, p[i]!, p[(i + 1) % n]!];
    return (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
  };
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const [a, b] = [p[(i - 10 + n) % n]!, p[(i + 10) % n]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const dev = Math.abs((p[i]!.x - a.x) * (b.z - a.z) - (p[i]!.z - a.z) * (b.x - a.x)) / len;
    if (dev <= limit) continue;
    const signs = new Set<number>();
    for (let k = -10; k <= 10; k++) {
      const t = turn((i + k + n) % n);
      if (Math.abs(t) > 1e-4) signs.add(Math.sign(t));
    }
    if (signs.size > 1) out.push(p[i]!);
  }
  return out;
};

const overlap = (a: Area, b: Area) => sizeOf(within(a, b));

describe("the streets' ground from the street graph (ADR-0104)", () => {
  it("the check finds a notch of 0.5 m in a kerb and none round an arc of 3 m", () => {
    const notched = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10.3, z: 0.5 }, { x: 10.6, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 10 }, { x: 0, z: 10 }];
    expect(jags(notched).length).toBeGreaterThan(0);
    // A kerb's corner: straight, an arc of 3 m tangent to both sides, straight on.
    const arc = [{ x: 3, z: -10 }, ...Array.from({ length: 19 }, (_, i) => ({ x: 3 * Math.cos((i * Math.PI) / 36), z: 3 * Math.sin((i * Math.PI) / 36) })), { x: -10, z: 3 }, { x: -10, z: -10 }];
    expect(jags(arc)).toEqual([]);
  });

  it("a T junction: one kerb round the corner, the sidewalk meets it all along, nothing laps", () => {
    const g = streetGround([street("A", [{ x: -50, z: 0 }, { x: 0, z: 0 }, { x: 50, z: 0 }], 4), street("B", [{ x: 0, z: 0 }, { x: 0, z: 50 }], 3.5)]);
    const [c, s] = [areaOf(g.carriageway), areaOf(g.sidewalks)];
    expect(g.junctions).toEqual([{ x: 0, z: 0 }]);
    expect(overlap(c, s)).toBeLessThan(0.01);
    for (const r of g.carriageway) expect(jags(r)).toEqual([]);
    for (const r of g.sidewalks) expect(jags(r)).toEqual([]);
    // The corner's arc of 3 m: its centre 3 m off both kerbs, the asphalt out to it.
    expect(holds(c, { x: 3.8, z: 4.3 })).toBe(true);
    expect(holds(c, { x: 4.73, z: 5.23 })).toBe(false);
    expect(holds(s, { x: 4.73, z: 5.23 })).toBe(true);
    // A step off the kerb is sidewalk, all along both streets and round the corner.
    for (let x = -45; x <= 45; x += 0.5) expect(holds(s, { x, z: -4.05 })).toBe(true);
    for (let z = 10; z <= 45; z += 0.5) expect(holds(s, { x: 3.55, z })).toBe(true);
    for (let a = 0; a <= 90; a += 5) {
      const t = (a * Math.PI) / 180;
      expect(holds(s, { x: 6.5 - 2.95 * Math.cos(t), z: 7 - 2.95 * Math.sin(t) }), `corner ${a}°`).toBe(true);
    }
    // No sidewalk across the side street's mouth.
    expect(holds(s, { x: 0, z: 4.5 })).toBe(false);
  });

  it("a street meeting another at 30°: no wedge at the acute corner, no notch at the obtuse one", () => {
    const d = { x: Math.cos(Math.PI / 6), z: Math.sin(Math.PI / 6) };
    const g = streetGround([street("A", [{ x: -50, z: 0 }, { x: 0, z: 0 }, { x: 50, z: 0 }], 4), street("B", [{ x: 0, z: 0 }, { x: 50 * d.x, z: 50 * d.z }], 3.5)]);
    const [c, s] = [areaOf(g.carriageway), areaOf(g.sidewalks)];
    expect(overlap(c, s)).toBeLessThan(0.01);
    for (const r of [...g.carriageway, ...g.sidewalks]) expect(jags(r)).toEqual([]);
    for (let x = -45; x <= -10; x += 0.5) expect(holds(s, { x, z: 4.05 })).toBe(true);
  });

  it("a crossroads and a bend: one smooth kerb", () => {
    const bend = Array.from({ length: 19 }, (_, i) => ({ x: 60 + 30 * Math.sin((i * Math.PI) / 36), z: -30 + 30 * Math.cos((i * Math.PI) / 36) }));
    const g = streetGround([
      street("A", [{ x: -50, z: 0 }, { x: 0, z: 0 }, { x: 60, z: 0 }], 4),
      street("B", [{ x: 0, z: -50 }, { x: 0, z: 0 }, { x: 0, z: 50 }], 3.5),
      street("C", [{ x: 60, z: 0 }, ...bend.slice(1)], 3.5),
    ]);
    const [c, s] = [areaOf(g.carriageway), areaOf(g.sidewalks)];
    expect(overlap(c, s)).toBeLessThan(0.01);
    for (const r of [...g.carriageway, ...g.sidewalks]) expect(jags(r)).toEqual([]);
  });

  it("a sidewalk on one side only, and none through a building", () => {
    const one: StreetEdge = { ...street("A", [{ x: -50, z: 0 }, { x: 50, z: 0 }], 4), walkRight: 0 };
    const house = [{ x: 10, z: 5 }, { x: 20, z: 5 }, { x: 20, z: 15 }, { x: 10, z: 15 }];
    const g = streetGround([one], [], [house]);
    const s = areaOf(g.sidewalks);
    const left = Math.sign(g.sidewalks[0]![0]!.z);
    expect(holds(s, { x: 0, z: left * 5 })).toBe(true);
    expect(holds(s, { x: 0, z: -left * 5 })).toBe(false);
    if (left > 0) expect(holds(s, { x: 15, z: 5.5 })).toBe(false);
  });

  it("a dual road keeps its median away from the junctions", () => {
    const g = streetGround([
      street("N", [{ x: -60, z: 5 }, { x: 0, z: 5 }, { x: 60, z: 5 }], 3.5, 0),
      street("S", [{ x: -60, z: -5 }, { x: 0, z: -5 }, { x: 60, z: -5 }], 3.5, 0),
      street("X", [{ x: 0, z: -40 }, { x: 0, z: -5 }, { x: 0, z: 5 }, { x: 0, z: 40 }], 3.5, 2.5),
    ]);
    const c = areaOf(g.carriageway);
    for (const x of [-30, -15, 15, 30]) expect(holds(c, { x, z: 0 })).toBe(false);
  });

  it("a verge keeps the sidewalk off the kerb and is left bare for the cover", () => {
    const a = streetAreas([{ ...street("A", [{ x: -50, z: 0 }, { x: 50, z: 0 }], 4), vergeLeft: 1.5, vergeRight: 1.5 }]);
    for (const side of [1, -1]) {
      expect(holds(a.verges, { x: 0, z: side * 4.75 })).toBe(true);
      expect(holds(a.sidewalks, { x: 0, z: side * 4.75 })).toBe(false);
      expect(holds(a.sidewalks, { x: 0, z: side * 6.75 })).toBe(true);
      expect(holds(a.sidewalks, { x: 0, z: side * 8.1 })).toBe(false);
    }
    expect(overlap(a.verges, join(a.c, a.sidewalks))).toBeLessThan(0.01);
  });

  it("a zebra spans its carriageway kerb to kerb and no further", () => {
    const g = streetGround([street("A", [{ x: -50, z: 0 }, { x: 50, z: 0 }], 4)], [{ at: { x: 20, z: 0 }, width: 4 }]);
    const z = areaOf(g.crossings);
    expect(holds(z, { x: 20, z: 3.9 })).toBe(true);
    expect(holds(z, { x: 20, z: -3.9 })).toBe(true);
    expect(holds(z, { x: 20, z: 4.1 })).toBe(false);
    expect(holds(z, { x: 22.5, z: 0 })).toBe(false);
  });
});
