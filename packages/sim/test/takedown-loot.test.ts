import { describe, expect, it } from "vitest";
import { SIM_DT, Simulation, TAKEDOWN_TIME, gangerEntity, stateHash, type Entity } from "../src";
import { input, run, streetSim } from "./helpers";

/*
 * G-918 (the user's decision of 17.11): a guard knocked out from behind leaves the bag it would
 * leave at its death, by its body, and no second one when it is killed later. Knocking out is
 * worth the loot as killing is, without the kill's experience.
 */

const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);
const CROUCH = input({ crouch: true });

const quietStreet = (seed = 7): Simulation => {
  const sim = streetSim({ seed });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  const p = sim.player()!;
  p.posture!.crouched = true;
  p.posture!.amount = 1;
  p.posture!.prevAmount = 1;
  return sim;
};

const guardAt = (sim: Simulation, distance: number): Entity => {
  const p = sim.player()!;
  const at = { x: p.position.x, y: p.position.y, z: p.position.z + distance };
  return sim.world.add(gangerEntity(4012, { key: "guard", position: at, yaw: 0 }, null, 80, p.chunk ?? "", undefined, "tessen_guard"));
};

const takeDown = (sim: Simulation, lethal: boolean): Entity => {
  const guard = guardAt(sim, 1.2);
  sim.step(CROUCH);
  sim.enqueue({ type: "takedown", lethal });
  run(sim, ticks(TAKEDOWN_TIME) + 1, CROUCH);
  return guard;
};

const bag = (sim: Simulation) => sim.domain.loot.containers.find((c) => c.key === "loot:guard");

describe("the loot of a guard knocked out (G-918)", () => {
  it("is its death's bag, by its body, no XP; killed after, no second bag", () => {
    const killed = quietStreet();
    takeDown(killed, true);
    const dead = bag(killed);
    expect(dead).toBeDefined();

    const sim = quietStreet();
    const xp = sim.domain.progression.xp;
    const guard = takeDown(sim, false);
    expect(guard.unconscious).toBe(true);
    const out = bag(sim);
    // The same lines as the kill's bag (its own stream), by the body.
    expect(out?.lines).toEqual(dead?.lines);
    expect(Math.hypot(out!.position.x - guard.position.x, out!.position.z - guard.position.z)).toBeLessThan(1);
    // Experience of a kill only for a kill.
    expect(sim.domain.progression.xp - xp).toBeLessThan(60);
    // A save with the guard down loads the same.
    const loaded = Simulation.fromSnapshot(JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))));
    expect(stateHash(loaded.snapshot(null, "t", ""))).toBe(stateHash(sim.snapshot(null, "t", "")));
    // Killed where it lies: its corpse, and no second bag.
    const before = sim.domain.loot.containers.length;
    guard.health = { current: 0, max: guard.health!.max };
    guard.lastHitBy = sim.player()!.id;
    run(sim, 2, CROUCH);
    expect(sim.domain.loot.containers.length).toBe(before);
    expect(sim.domain.flags).not.toContain("looted:guard");
  });
});
