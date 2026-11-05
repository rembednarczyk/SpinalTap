import { describe, expect, it } from "vitest";
import { FLEE_RADIUS, Simulation } from "../src";
import { passerbyOnDeptak, run, teleportPlayer } from "./helpers";

/** A fresh game with the deptak's crowd out (ADR-0041), on a street hostile to the player (ADR-0070). */
const hostileCrowd = (seed: number): Simulation => {
  const snap = Simulation.create({ seed, crowd: "high" }).snapshot(null, "test", "");
  const reputation = { ...snap.domain.reputation, civilians: -60 };
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation } }, undefined, "high");
};

const byId = (sim: Simulation, id: number) => [...sim.world].find((e) => e.id === id)!;

/** A turn of the heading between two steps this sharp (radians) is a jump, not a curve. */
const JUMP = 0.4;
/** The first two seconds are the escape itself; how close it comes is read after them. */
const SETTLE = 120;

/**
 * Runs the escape of the walker `id` from the player `dx`, `dz` metres off it for five seconds:
 * how many times its heading jumped while it ran, in how many steps it ran back towards the
 * player, how close to the player it came after `SETTLE` and where it ended up.
 */
const watchEscape = (seed: number, id: number, dx: number, dz = 0) => {
  const sim = hostileCrowd(seed);
  const walker = passerbyOnDeptak(sim, 2, (e) => e.id === id);
  const at = byId(sim, walker.id).position;
  teleportPlayer(sim, { x: at.x + dx, y: at.y, z: at.z + dz });
  const p = sim.player()!.position;
  let jumps = 0;
  let towards = 0;
  let closest = Infinity;
  let last: number | null = null;
  for (let i = 0; i < 300; i++) {
    run(sim, 1);
    const e = byId(sim, walker.id);
    const ox = e.position.x - p.x;
    const oz = e.position.z - p.z;
    const d = Math.hypot(ox, oz);
    if (i >= SETTLE) closest = Math.min(closest, d);
    if (Math.hypot(e.velocity!.x, e.velocity!.z) < 0.05) continue;
    if ((e.velocity!.x * ox + e.velocity!.z * oz) / d < -0.05) towards++;
    if (last !== null && Math.abs(Math.atan2(Math.sin(e.yaw - last), Math.cos(e.yaw - last))) > JUMP) jumps++;
    last = e.yaw;
  }
  const e = byId(sim, walker.id);
  return { jumps, towards, closest, distance: Math.hypot(e.position.x - p.x, e.position.z - p.z) };
};

// Walkers of the deptak's crowd routes whose way away from the player runs into a wall.
const ALONG_A_WALL = [
  // Seed 3, walker 1002004, player 2 m off (G-317): 23 jumps of 0.8 rad in 0.4 s.
  { seed: 3, id: 1002004, dx: 2, was: 23 },
  // The same 1 m off: 9 jumps.
  { seed: 3, id: 1002004, dx: 1, was: 9 },
  // Seed 17, the player on the other side: 19 jumps.
  { seed: 17, id: 1002004, dx: -2, was: 19 },
  // Another walker: 37 jumps, and as many with a switch margin of 1.5 m.
  { seed: 3, id: 1002003, dx: 2, was: 37 },
] as const;

describe("an escape along a wall (G-317)", () => {
  for (const { seed, id, dx, was } of ALONG_A_WALL) {
    it(`keeps its heading instead of swinging between two open ways (seed ${seed}, walker ${id}, player ${dx} m off, ${was} jumps before)`, () => {
      const w = watchEscape(seed, id, dx);
      // A turn off the wall, round the corner and back away: no more than that.
      expect(w.jumps).toBeLessThanOrEqual(4);
      // It still gets away and does not stick to the wall.
      expect(w.distance).toBeGreaterThanOrEqual(FLEE_RADIUS);
    });
  }

  // Seed 11, walker 1002001 in a blind alley by (308; -101): it cannot get the flee radius away
  // and has always swung there. Keeping a way must not run it back towards the player.
  const BLIND_ALLEY = [
    // Before G-317: 63 steps towards the player. The first fix kept ways back: 107.
    { dz: 2, towards: 63, closest: 5.6 },
    // Before G-317: 4 steps towards. The first fix: 101; a switch margin of 0.5 m: 7.
    { dz: 1, towards: 4, closest: 5.4 },
  ] as const;
  for (const { dz, towards, closest } of BLIND_ALLEY) {
    it(`in a blind alley it comes no closer to the player than before (player ${dz} m off)`, () => {
      const w = watchEscape(11, 1002001, 0, dz);
      expect(w.towards).toBeLessThanOrEqual(towards);
      expect(w.closest).toBeGreaterThanOrEqual(closest);
    });
  }
});
