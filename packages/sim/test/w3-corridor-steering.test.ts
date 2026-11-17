import { describe, expect, it } from "vitest";
import { type Contract, contractAlarmFlag, contractTag } from "@seki/core";
import { type Entity, SIM_HZ, Simulation, W3_CORE_BLIND_SPOT, lineOfSight, w3 } from "../src";
import { nearBuilds, steeringWork } from "../src/systems/ai/steering";
import { input, teleportPlayer } from "./helpers";

/**
 * The steering's work in W-3's corridor S fight (G-928): the charges' alarm, the waves coming in
 * and the line's two technicians running from the shots down the hall's aisle. Each running
 * technician asked for a way round to a point 6 m ahead of it, and so for a new field of the
 * near window (80 m a side) every half metre it ran and a new raster every 8 m: 2-8 ms a step,
 * the session tests of the fight 12-13 s under coverage. Counted in units of work (cells gone
 * through), not in time.
 */

const accept = (sim: Simulation): Contract => {
  teleportPlayer(sim, W3_CORE_BLIND_SPOT, 0);
  sim.step();
  sim.enqueue({ type: "accept-contract", kind: "sabotage" });
  sim.step();
  const c = sim.domain.contracts.active;
  if (c?.kind !== "sabotage") throw new Error("no sabotage");
  return c;
};

const alive = (e: Entity) => (e.health?.current ?? 0) > 0;
const eye = (e: Entity) => ({ x: e.position.x, y: e.position.y + 1.62, z: e.position.z });
const chest = (e: Entity) => ({ x: e.position.x, y: e.position.y + 1.25, z: e.position.z });

/** Aims at the nearest guard of the job she sees; true when there is one. */
const aimAtNearest = (sim: Simulation, c: Contract): boolean => {
  const p = sim.player()!;
  const seen = [...sim.world.with("enemy", "health")]
    .filter((e) => e.tag === contractTag(c.id) && alive(e) && lineOfSight(sim.world, eye(p), chest(e)))
    .sort((a, b) => Math.hypot(a.position.x - p.position.x, a.position.z - p.position.z) - Math.hypot(b.position.x - p.position.x, b.position.z - p.position.z))[0];
  if (!seen) return false;
  const [from, to] = [eye(p), chest(seen)];
  p.yaw = Math.atan2(to.x - from.x, to.z - from.z);
  p.pitch = -Math.atan2(to.y - from.y, Math.hypot(to.x - from.x, to.z - from.z));
  return true;
};

/**
 * At most this many units of the steering's work a step on average after the first second, when
 * the waves' own ways are made (the wide window's raster, G-625): the technicians' running took
 * some 3,500 in the near window, 1,200 in their own.
 */
const UNITS_A_STEP = 1_600;

describe("the steering in W-3's corridor S fight (G-928)", () => {
  it("costs little a step while the technicians run from the shots down the aisle: no fields of the near window for them", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    teleportPlayer(sim, w3(2555, 0, 402), Math.PI);
    sim.step();
    sim.step(input({ interact: true }));
    expect(sim.domain.flags).toContain(contractAlarmFlag(c.id));
    teleportPlayer(sim, w3(2552, 0, 405), -Math.PI / 2);
    const technicians = [...sim.world].filter((e) => e.staff);
    const near = nearBuilds(sim.world).fields;
    let [work, running] = [0, 0];
    for (let t = 0; t < 8 * SIM_HZ; t++) {
      if (t === SIM_HZ) work = steeringWork(sim.world);
      sim.step(input({ fire: aimAtNearest(sim, c), aim: true }));
      running += technicians.filter((e) => e.civilian?.crowd?.state === "fleeing").length;
    }
    // Both of them run most of the time (a technician running for a step counts once).
    expect(running).toBeGreaterThan(8 * SIM_HZ);
    // The waves' ways to her: one field of the near window, none of it for the runners.
    expect(nearBuilds(sim.world).fields - near).toBeLessThanOrEqual(2);
    expect((steeringWork(sim.world) - work) / (7 * SIM_HZ)).toBeLessThan(UNITS_A_STEP);
  });
});
