import { describe, expect, it } from "vitest";
import { ALCHEMIA_CENTRE, ALCHEMIA_CUTS, ARKADY, FOODHALL, FOODHALL_INNER, arkadyLocal, arkadyPoint } from "@seki/sim";
import { MeshSink } from "../src/renderer/mesh-sink";
import { alchemiaIn, arkadyIn, bakeAlchemiaStandIn, bakeArkadyStandIn } from "../src/renderer/alchemia/alchemia-far";
import { ALCHEMIA_DRAW } from "../src/renderer/alchemia/alchemia-view";

/**
 * Alchemia's food hall from afar (ADR-0074 stage 1, review of #343): the ground under it is cut
 * out of the terrain for good, its detailed mesh drawn only within `ALCHEMIA_DRAW`; the street
 * furniture's block meshes carry a stand-in, so from 165 m there is the hall, not a hole.
 */

type V = { x: number; y: number; z: number };

/** The first triangle of the sink a vertical ray down at (x, z) hits: its height, or null. */
const hitDown = (s: MeshSink, x: number, z: number): number | null => {
  let best: number | null = null;
  const p = (i: number): V => ({ x: s.positions[i * 3]!, y: s.positions[i * 3 + 1]!, z: s.positions[i * 3 + 2]! });
  for (let t = 0; t < s.indices.length; t += 3) {
    const [a, b, c] = [p(s.indices[t]!), p(s.indices[t + 1]!), p(s.indices[t + 2]!)];
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(d) < 1e-9) continue;
    const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
    const l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
    const y = l1 * a.y + l2 * b.y + l3 * c.y;
    if (best === null || y > best) best = y;
  }
  return best;
};

describe("Alchemia's food hall from afar (ADR-0074 stage 1)", () => {
  it("closes the terrain's hole over the hall's whole outline with its roof, within a hand of the detailed one", () => {
    const s = new MeshSink();
    bakeAlchemiaStandIn(s);
    const cut = ALCHEMIA_CUTS[ALCHEMIA_CUTS.length - 1]!.bounds;
    expect(cut).toEqual({ minX: FOODHALL.minX, maxX: FOODHALL.maxX, minZ: FOODHALL.minZ, maxZ: FOODHALL.maxZ });
    const misses: string[] = [];
    for (let x = cut.minX + 0.05; x < cut.maxX; x += 1) {
      for (let z = cut.minZ + 0.05; z < cut.maxZ; z += 1) {
        const y = hitDown(s, x, z);
        if (y === null || y < FOODHALL.roof - 0.1) misses.push(`${x.toFixed(1)},${z.toFixed(1)}: ${y}`);
      }
    }
    expect(misses).toEqual([]);
  });

  it("shows its front (lit glass) to T1 and a floor through its way in, under the detailed boxes", () => {
    const s = new MeshSink();
    bakeAlchemiaStandIn(s);
    const ys = [];
    for (let i = 1; i < s.positions.length; i += 3) ys.push(s.positions[i]!);
    expect(Math.min(...ys)).toBeLessThan(FOODHALL.floor - 0.02);
    // Every vertex within the hall's outline and the stair house's eaves (0,1 m over it).
    for (let i = 0; i < s.positions.length; i += 3) {
      expect(s.positions[i]!).toBeGreaterThan(FOODHALL.minX - 0.1);
      expect(s.positions[i]!).toBeLessThan(FOODHALL.maxX);
      expect(s.positions[i + 2]!).toBeGreaterThan(FOODHALL.minZ - 0.1);
      expect(s.positions[i + 2]!).toBeLessThan(FOODHALL.maxZ);
    }
    expect(FOODHALL_INNER.maxZ).toBeLessThan(FOODHALL.maxZ);
  });

  it("is in the block of the street furniture that holds the hall, and 165 m is beyond the detailed mesh", () => {
    expect(alchemiaIn({ minX: 256, maxX: 512, minZ: 0, maxZ: 256 })).toBe(true);
    expect(alchemiaIn({ minX: 0, maxX: 256, minZ: 0, maxZ: 256 })).toBe(false);
    expect(165).toBeGreaterThan(ALCHEMIA_DRAW + 10);
    expect(Math.hypot(ALCHEMIA_CENTRE.x - 418, ALCHEMIA_CENTRE.z - 45)).toBeLessThan(1e-9);
  });
});

describe("the Arkady from afar (ADR-0074 stage 2)", () => {
  it("stands where the map's ruin stood, its roof over the whole outline, within a hand of the detailed one", () => {
    const s = new MeshSink();
    bakeArkadyStandIn(s);
    const misses: string[] = [];
    for (let a = 0.3; a < ARKADY.length - 0.3; a += 1) {
      for (let c = 0.3; c < ARKADY.depth - 0.3; c += 1) {
        const p = arkadyPoint(a, c);
        const y = hitDown(s, p.x, p.z);
        if (y === null || y < ARKADY.roof - 0.1) misses.push(`${a.toFixed(1)},${c.toFixed(1)}: ${y}`);
      }
    }
    expect(misses).toEqual([]);
    // Every vertex on the building's frame: its outline, the pavement east of it and the landing south of it, reaching 2.2 m west of its west face (G-460).
    for (let i = 0; i < s.positions.length; i += 3) {
      const q = arkadyLocal(s.positions[i]!, s.positions[i + 2]!);
      expect(q.a).toBeGreaterThan(-3.1);
      expect(q.a).toBeLessThan(ARKADY.length + 0.05);
      expect(q.c).toBeGreaterThan(-2.25);
      expect(q.c).toBeLessThan(ARKADY.depth + 5.05);
    }
  });

  it("is in the block of the street furniture that holds the Arkady", () => {
    expect(arkadyIn({ minX: 256, maxX: 512, minZ: 0, maxZ: 256 })).toBe(true);
    expect(arkadyIn({ minX: 256, maxX: 512, minZ: -256, maxZ: 0 })).toBe(false);
  });
});
