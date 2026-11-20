import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { type Entity, SIM_HZ, Simulation, W3_CORE_BLIND_SPOT, ground, w3 } from "../src";
import { FLEE_FAR_WINDOW, FLEE_WINDOW, memoOf } from "../src/systems/ai/nav-field";
import { detourStep, fleeDetourStep, straightWalk } from "../src/systems/ai/steering";
import { teleportPlayer } from "./helpers";

/**
 * Round 2 of G-928: runners whose way round leaves the flee window (40 m) keep the near window's
 * way. With the flee window alone a runner by the Bystrzyca's fence stood 4.5 s or swung on the
 * spot instead of running 16 m round it, and one by the west wall of W-3's hall stood 3.7 s
 * instead of running 13 m along it (the hunter's grid of 17.11, against main). A civilian alone,
 * set running from a danger 5 m behind it along one of eight headings, for 5 s: each run here is
 * the run of main (41e715f), which by the hall's wall swings on the spot at (2519, 396) but does
 * not stand there.
 */

interface Run {
  readonly gone: number;
  /** The longest it stood (s), under 0.3 m/s. */
  readonly stood: number;
  /** Turns of its heading by more than 0.4 rad from one step to the next while it moved. */
  readonly swings: number;
}

const turn = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

const runFrom = (sim: Simulation, c: Entity, from: Vec3, k: number): Run => {
  const h = (k * Math.PI) / 4;
  c.position = { ...from };
  c.prevPosition = { ...from };
  c.velocity = { x: 0, y: 0, z: 0 };
  c.yaw = h;
  const danger = { x: from.x - Math.sin(h) * 5, y: from.y, z: from.z - Math.cos(h) * 5 };
  c.civilian!.crowd = { state: "fleeing", timer: 8, from: danger, call: null, scared: 0 };
  let [still, stood, swings] = [0, 0, 0];
  let last: number | null = null;
  for (let i = 0; i < 5 * SIM_HZ; i++) {
    const prev = c.position;
    sim.step();
    const d = Math.hypot(c.position.x - prev.x, c.position.z - prev.z) * SIM_HZ;
    still = d < 0.3 ? still + 1 : 0;
    stood = Math.max(stood, still);
    if (d >= 0.05) {
      if (last !== null && turn(c.yaw, last) > 0.4) swings++;
      last = c.yaw;
    }
  }
  return { gone: Math.hypot(c.position.x - from.x, c.position.z - from.z), stood: stood / SIM_HZ, swings };
};

/** A world with one civilian left in it, the rest of them taken out. */
const alone = (sim: Simulation, pick: (e: Entity) => boolean): Entity => {
  const c = [...sim.world].find((e) => e.civilian && pick(e));
  if (!c) throw new Error("no civilian");
  for (const e of [...sim.world]) if (e.civilian && e !== c) sim.world.remove(e);
  return c;
};

describe("runners round a way out of the flee window (G-928, round 2)", () => {
  it("by the Bystrzyca's fence they run 10 m and more round it, as in the near window, not stand or swing", () => {
    const sim = Simulation.create({ seed: 3, crowd: "low" });
    teleportPlayer(sim, ground(2382, 485), 0);
    for (let i = 0; i < 3 * SIM_HZ; i++) sim.step();
    const c = alone(sim, (e) => !e.vehicle);
    for (const [x, z, k] of [
      [2322, 437, 0],
      [2362, 449, 2],
      [2346, 445, 4],
      [2334, 437, 0],
    ] as const) {
      const run = runFrom(sim, c, ground(x, z), k);
      expect.soft({ at: [x, z, k], far: run.gone >= 10, stood: run.stood <= 2, swings: run.swings < 5 }, JSON.stringify(run)).toEqual({ at: [x, z, k], far: true, stood: true, swings: true });
    }
  });

  it("by the west wall of W-3's hall they do not stand", () => {
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, W3_CORE_BLIND_SPOT, 0);
    sim.step();
    sim.enqueue({ type: "accept-contract", kind: "sabotage" });
    sim.step();
    for (let i = 0; i < 2 * SIM_HZ; i++) sim.step();
    const c = alone(sim, (e) => !!e.staff);
    // Without the sabotage's Tessen (the guards, the manager and the observer, 10-35 m off): the runner is the subject, its
    // pose at every step the same with them and without, and their minds and steps were an eighth of this test's time.
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    for (const [x, z, k, far] of [
      [2519, 396, 5, true],
      [2519, 396, 6, false],
      [2519, 396, 7, false],
      [2519, 436, 0, false],
    ] as const) {
      const run = runFrom(sim, c, w3(x, 0, z), k);
      expect.soft({ at: [x, z, k], far: !far || run.gone >= 10, stood: run.stood <= 2 }, JSON.stringify(run)).toEqual({ at: [x, z, k], far: true, stood: true });
    }
  });

  // The near window's way, from its cells with the fields grown as far as asked (`flee-lazy-field`): a whole field for each goal took 20 s.
  it("take the near window's way round wherever their way is blocked by the fence", () => {
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, ground(2342, 443), 0);
    for (let i = 0; i < 10; i++) sim.step();
    const flee = memoOf(sim.world, FLEE_WINDOW).built;
    let [blocked, round, own] = [0, 0, 0];
    for (let x = 2322; x <= 2362; x += 4) {
      for (let z = 437; z <= 449; z += 4) {
        for (let k = 0; k < 8; k++) {
          const from = ground(x, z);
          const h = (k * Math.PI) / 4;
          const goal = { x: from.x + 6 * Math.sin(h), y: from.y, z: from.z + 6 * Math.cos(h) };
          if (straightWalk(sim.world, from, goal)) continue;
          blocked++;
          const near = detourStep(sim.world, from, goal, FLEE_FAR_WINDOW);
          if (near && near.x !== goal.x) round++;
          const fields = flee.fields;
          expect(fleeDetourStep(sim.world, from, goal), `${x}, ${z}, ${k}`).toEqual(near);
          if (flee.fields > fields) own++;
        }
      }
    }
    expect(blocked).toBeGreaterThan(100);
    // Most of them round something, most of them from the flee window's own field.
    expect(round).toBeGreaterThan(blocked / 2);
    expect(own).toBeGreaterThan(blocked / 2);
  });
});
