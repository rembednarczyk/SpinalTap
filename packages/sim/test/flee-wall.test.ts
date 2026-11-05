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

/** A player running after the walker at `speed` (m/s) who stops `stop` metres from it. */
type Chase = { speed: number; stop: number };

/**
 * Runs the escape of the walker `id` from the player `dx`, `dz` metres off it for five seconds:
 * how many times its heading jumped while it ran and its sharpest turn, in how many steps it ran
 * back towards the player, how close to the player it came after `SETTLE`, where it ended up
 * and how far from where it set off (`gone`). With `chase` the player runs after it.
 */
const watchEscape = (seed: number, id: number, dx: number, dz = 0, chase?: Chase) => {
  const sim = hostileCrowd(seed);
  const walker = passerbyOnDeptak(sim, 2, (e) => e.id === id);
  const at = { ...byId(sim, walker.id).position };
  teleportPlayer(sim, { x: at.x + dx, y: at.y, z: at.z + dz });
  let p = sim.player()!.position;
  let jumps = 0;
  let towards = 0;
  let closest = Infinity;
  let sharpest = 0;
  let last: number | null = null;
  for (let i = 0; i < 300; i++) {
    run(sim, 1);
    const e = byId(sim, walker.id);
    const ox = e.position.x - p.x;
    const oz = e.position.z - p.z;
    const d = Math.hypot(ox, oz);
    if (i >= SETTLE) closest = Math.min(closest, d);
    if (chase && d > chase.stop) {
      const s = Math.min(chase.speed / 60, d - chase.stop);
      teleportPlayer(sim, { x: p.x + (ox / d) * s, y: p.y, z: p.z + (oz / d) * s });
      p = sim.player()!.position;
    }
    if (Math.hypot(e.velocity!.x, e.velocity!.z) < 0.05) continue;
    if ((e.velocity!.x * ox + e.velocity!.z * oz) / d < -0.05) towards++;
    const turn = last === null ? 0 : Math.abs(Math.atan2(Math.sin(e.yaw - last), Math.cos(e.yaw - last)));
    sharpest = Math.max(sharpest, turn);
    if (turn > JUMP) jumps++;
    last = e.yaw;
  }
  const e = byId(sim, walker.id);
  return { jumps, towards, closest, sharpest, distance: Math.hypot(e.position.x - p.x, e.position.z - p.z), gone: Math.hypot(e.position.x - at.x, e.position.z - at.z) };
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

  // Seed 3, walker 1002009, the player 2 m off: it set off on the heading it walked on, kept it
  // for a step and turned by 1.5 rad on the next.
  it("sets off straight away, not on the heading it walked on (seed 3, walker 1002009)", () => {
    expect(watchEscape(3, 1002009, -2).sharpest).toBeLessThan(1);
  });

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

  // The same walker with the player running after it from behind: it gets out up the alley
  // towards (332; -74). Keeping the way it ran on while the way closer to straight away bent
  // round a corner turned it off into the corner by (316; -95), where it swung back and forth
  // at the player's feet.
  const PURSUIT = [
    // Kept so: 83 steps towards the player, 1.16 m off it.
    { dz: -1, speed: 4, stop: 1.5 },
    // Kept so: 87 steps towards, 0.76 m off.
    { dz: -2, speed: 6, stop: 1 },
  ] as const;
  for (const { dz, speed, stop } of PURSUIT) {
    it(`chased up the alley it does not turn into the corner (player ${-dz} m behind at ${speed} m/s, stopping ${stop} m off)`, () => {
      const w = watchEscape(11, 1002001, 0, dz, { speed, stop });
      expect(w.towards).toBe(0);
      expect(w.closest).toBeGreaterThanOrEqual(stop - 0.05);
    });
  }
});

// Walkers whose way away from the player grazes a corner: the knee-high line to the point
// ahead opened and closed every step, and the walker swung between it and the way round.
const PAST_A_CORNER = [
  // Seed 17, walker 1002005, player 2 m off (G-326): 25 jumps of 0.42 rad.
  { seed: 17, id: 1002005, dx: 2, dz: 0, was: 25 },
  // The same 1 m off: 43 jumps.
  { seed: 17, id: 1002005, dx: 1, dz: 0, was: 43 },
  // Seed 23, walker 1002006 by (262; -81), on the same way away all along: 6 jumps of 0.5 rad.
  { seed: 23, id: 1002006, dx: 0, dz: 1, was: 6 },
  // Seed 29, walker 1002006: 258 jumps, stuck 2.46 m off. Its way round bends by more than
  // 0.05 rad a step: with that tolerance it lets go of it again (67 jumps, 2.45 m off).
  { seed: 29, id: 1002006, dx: 0, dz: 2, was: 258 },
] as const;

describe("an escape past a corner (G-326)", () => {
  for (const { seed, id, dx, dz, was } of PAST_A_CORNER) {
    it(`keeps to the way round instead of swinging back to the straight line (seed ${seed}, walker ${id}, ${was} jumps before)`, () => {
      const w = watchEscape(seed, id, dx, dz);
      expect(w.jumps).toBeLessThanOrEqual(2);
      expect(w.distance).toBeGreaterThanOrEqual(FLEE_RADIUS);
    });
  }

  // Seed 43, walker 1002008, player 2 m off by (309; -99): its way out leads round past the
  // player. A rule that ran it on to the point a probe ahead when the way round turned back
  // (since withdrawn) pinned it against a wall 2.69 m off the player, running on the spot.
  it("takes the way round even when it leads back past the player (seed 43, walker 1002008)", () => {
    expect(watchEscape(43, 1002008, 2).distance).toBeGreaterThanOrEqual(FLEE_RADIUS);
  });
});

describe("an escape through a gap narrower than the body (G-338)", () => {
  // Seed 17, walker 1002008 by (248.2; -65), chased from the south at 4 m/s up to 2 m: the way
  // straight away runs between a lamp post and a planter 0.2 m apart. The knee-high line went
  // through, the body did not: 242 jumps of a quarter turn on the spot, 0.1 m from where it was.
  it("does not take a way its body does not fit through (seed 17, walker 1002008, 242 jumps before)", () => {
    const w = watchEscape(17, 1002008, 0, -2, { speed: 4, stop: 2 });
    expect(w.jumps).toBeLessThanOrEqual(4);
    expect(w.towards).toBe(0);
    expect(w.gone).toBeGreaterThanOrEqual(FLEE_RADIUS);
  });
});
