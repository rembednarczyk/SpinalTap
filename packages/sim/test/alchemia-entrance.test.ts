import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type Vec3 } from "@seki/core";
import { MAIN_DOORS, MAIN_WAY_X, MALL, MALL_LEVELS, P1_RAMP, P1_STAIR, PAVILION_CORNERS, Simulation, WORLD_NAV, groundY } from "../src";
import { routeAcrossLevels } from "../src/world/nav";
import { lineOfSight } from "../src/world/hitscan";
import { teleportPlayer } from "./helpers";

/*
 * The main entrance from Bajkowskiego (ADR-0093 O2b): a straight way from the footway east of the
 * ramp to the gallery's main doors on P1, 4 m and more in the clear, no stairs down to P-1 on it (its
 * stair house stood on the way until O2b, the pavilion's west corner closed it to 1.7 m at the
 * footway). Measured by a stepped player and on the level graph.
 */

const L = MALL_LEVELS;
/** Where the player starts: on Bajkowskiego's footway in the way's line, north of the bollards along its kerb (z -11.8). */
const FOOTWAY = { x: MAIN_WAY_X, z: P1_RAMP.top - 2.5 } as const;
/** On P1's gallery before the atrium, straight in from the doors. */
const GALLERY = { x: MAIN_WAY_X, z: 37.6 } as const;
const onGround = (x: number, z: number): Vec3 => ({ x, y: groundY(x, z), z });

/** A world with the player at (x, z) on the ground facing north, nobody else in it. */
const start = (x: number, z: number): Simulation => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, { x, y: groundY(x, z) + 0.05, z }, 0);
  sim.step();
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

/** Runs to each point in turn, turning towards it: the seconds it took and the lowest the feet went, or null if stuck. */
const runThrough = (sim: Simulation, points: readonly { x: number; z: number }[], limit = 20): { seconds: number; lowest: number } | null => {
  let steps = 0;
  let lowest = Infinity;
  for (const q of points) {
    for (;;) {
      const p = sim.player()!;
      if (Math.hypot(q.x - p.position.x, q.z - p.position.z) < 0.4) break;
      if (steps++ > 60 * limit) return null;
      const want = Math.atan2(q.x - p.position.x, q.z - p.position.z);
      sim.step({ ...EMPTY_INPUT, moveZ: 1, sprint: true, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) });
      lowest = Math.min(lowest, sim.player()!.position.y);
    }
  }
  return { seconds: steps / 60, lowest };
};

describe("the main entrance from Bajkowskiego (ADR-0093 O2b)", () => {
  it("takes the player straight north from the footway through the main doors onto P1's gallery in under 10 s, never down to P-1", () => {
    const sim = start(FOOTWAY.x, FOOTWAY.z);
    let lowest = Infinity;
    let steps = 0;
    // Only forward, the view held due north: no steering round anything.
    for (; steps < 60 * 10 && sim.player()!.position.z < GALLERY.z; steps++) {
      const p = sim.player()!;
      sim.step({ ...EMPTY_INPUT, moveZ: 1, sprint: true, lookYaw: -Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw)) });
      lowest = Math.min(lowest, sim.player()!.position.y);
    }
    const at = sim.player()!.position;
    expect(at.z, `stopped at ${at.x.toFixed(2)},${at.y.toFixed(2)},${at.z.toFixed(2)}`).toBeGreaterThanOrEqual(GALLERY.z);
    expect(at.y).toBeCloseTo(L.p1, 1);
    expect(Math.abs(at.x - FOOTWAY.x)).toBeLessThan(0.05);
    // 7.3 s at a run (12.1 s walking); before O2b there was no way straight in at all.
    expect(steps / 60).toBeLessThan(10);
    expect(lowest).toBeGreaterThan(-2.4);
  });

  it("takes the player from under the arcade north, east over the ramp's covered part onto the way and in, in about 10 s", () => {
    const sim = start(407.5, 0.5);
    const run = runThrough(sim, [
      { x: 407.5, z: P1_RAMP.covered + 1.4 },
      { x: MAIN_WAY_X, z: P1_RAMP.covered + 1.4 },
      GALLERY,
    ]);
    expect(run).not.toBeNull();
    expect(run!.seconds).toBeLessThan(10);
    expect(run!.lowest).toBeGreaterThan(-2.4);
    expect(sim.player()!.position.y).toBeCloseTo(L.p1, 1);
  });

  it("keeps the way 4 m wide in the clear from the footway to the doors, the doors as wide", () => {
    const sim = start(FOOTWAY.x, FOOTWAY.z);
    expect(MAIN_DOORS.x1 - MAIN_DOORS.x0).toBeGreaterThanOrEqual(4);
    expect(MAIN_WAY_X).toBeCloseTo((MAIN_DOORS.x0 + MAIN_DOORS.x1) / 2, 6);
    /** How far from the way's middle across it a body's knee and chest go free, to the west (-1) or east (+1), up to 4 m. */
    const free = (z: number, side: -1 | 1): number => {
      const y = z > MALL.z0 ? L.p1 : groundY(MAIN_WAY_X, z);
      let d = 0;
      while (d < 4 && [0.3, 1.25].every((h) => lineOfSight(sim.world, { x: MAIN_WAY_X, y: y + h, z }, { x: MAIN_WAY_X + side * (d + 0.05), y: y + h, z }, false))) d += 0.05;
      return d;
    };
    let narrowest = Infinity;
    for (let z = FOOTWAY.z; z < MALL.z0 + 0.8; z += 0.25) {
      const width = free(z, -1) + free(z, 1);
      narrowest = Math.min(narrowest, width);
      expect(width, `z ${z.toFixed(2)}`).toBeGreaterThanOrEqual(4);
    }
    // The doors' jambs are the narrowest (4.4 m); a lamp of the map's by its east edge at z 3.5 leaves 4.3 m.
    expect(narrowest).toBeLessThan(4.6);
    // What stood on it moved off it: the pavilion's west corner east of it, P-1's stair house beside it.
    expect(PAVILION_CORNERS[0].x).toBeGreaterThan(MAIN_WAY_X + 2);
    expect(P1_STAIR.minX).toBeGreaterThan(MAIN_WAY_X + 2);
  });

  it("routes an NPC from the footway to P1's gallery up the way, not down through P-1", () => {
    const sim = start(FOOTWAY.x, FOOTWAY.z);
    const from = onGround(FOOTWAY.x, FOOTWAY.z);
    const route = routeAcrossLevels(sim.world, WORLD_NAV, from, { x: GALLERY.x, y: L.p1, z: GALLERY.z });
    expect(route).not.toBeNull();
    // The straight way is some 50 m; through P-1 and the hall it was over 90.
    expect(route!.cost, JSON.stringify(route)).toBeLessThan(60);
    expect(route!.next.y).toBeGreaterThan(-2.4);
    expect(Math.abs(route!.next.x - MAIN_WAY_X)).toBeLessThan(0.5);
  });
});
