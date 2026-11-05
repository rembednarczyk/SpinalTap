import { describe, expect, it } from "vitest";
import { FLEE_RADIUS, Simulation, stateHash } from "../src";
import { passerbyOnDeptak, run } from "./helpers";

/** A fresh game with the deptak's crowd out (ADR-0041), on a street hostile to the player (ADR-0070). */
const hostileCrowd = (seed: number): Simulation => {
  const snap = Simulation.create({ seed, crowd: "high" }).snapshot(null, "test", "");
  const reputation = { ...snap.domain.reputation, civilians: -60 };
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation } }, undefined, "high");
};

const byId = (sim: Simulation, id: number) => [...sim.world].find((e) => e.id === id)!;

/** A turn of the heading between two steps this sharp (radians) is a jump, not a curve. */
const JUMP = 0.4;

/**
 * Runs the escape of the walker `id` from the player `gap` metres east of it for `steps` steps:
 * how many times its heading jumped while it ran and where it ended up.
 */
const watchEscape = (seed: number, id: number, gap: number, steps = 300) => {
  const sim = hostileCrowd(seed);
  const walker = passerbyOnDeptak(sim, gap, (e) => e.id === id);
  let jumps = 0;
  let last: number | null = null;
  for (let i = 0; i < steps; i++) {
    run(sim, 1);
    const e = byId(sim, walker.id);
    if (Math.hypot(e.velocity!.x, e.velocity!.z) < 0.05) continue;
    if (last !== null && Math.abs(Math.atan2(Math.sin(e.yaw - last), Math.cos(e.yaw - last))) > JUMP) jumps++;
    last = e.yaw;
  }
  const e = byId(sim, walker.id);
  const p = sim.player()!.position;
  return { sim, jumps, distance: Math.hypot(e.position.x - p.x, e.position.z - p.z) };
};

// Walkers of the deptak's crowd routes whose way away from the player runs into a wall.
const CASES = [
  // Seed 3, walker 1002004, player 2 m off (G-317): 23 jumps of 0.8 rad in 0.4 s.
  { seed: 3, id: 1002004, gap: 2 },
  // The same 1 m off: 9 jumps.
  { seed: 3, id: 1002004, gap: 1 },
  // Seed 17, the player on the other side: 19 jumps.
  { seed: 17, id: 1002004, gap: -2 },
] as const;

describe("an escape along a wall (G-317)", () => {
  for (const { seed, id, gap } of CASES) {
    it(`keeps its heading instead of swinging between two open ways (seed ${seed}, walker ${id}, player ${gap} m off)`, () => {
      const w = watchEscape(seed, id, gap);
      // A turn off the wall, round the corner and back away: no more than that.
      expect(w.jumps).toBeLessThanOrEqual(4);
      // It still gets away and does not stick to the wall.
      expect(w.distance).toBeGreaterThanOrEqual(FLEE_RADIUS);
    });
  }

  it("keeps no hidden state: a load mid-escape goes on the same", () => {
    const sim = hostileCrowd(3);
    passerbyOnDeptak(sim, 2, (e) => e.id === 1002004);
    // Between the first turn off the wall and the corner, where the heading used to swing.
    run(sim, 60);
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""), undefined, "high");
    run(sim, 60);
    run(restored, 60);
    expect(stateHash(restored.snapshot(null, "x", ""))).toBe(stateHash(sim.snapshot(null, "x", "")));
  });
});
