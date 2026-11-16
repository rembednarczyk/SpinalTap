import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { Simulation } from "../src";
import { CROUCH_BODY_SCALE } from "../src/world/hitboxes";
import { STREET_START, input, run, teleportPlayer } from "./helpers";

/**
 * The crouched body in the collisions (ADR-0069, for W-3's culvert, ADR-0082): crouched the body
 * is 1.26 m, not 1.8 m, so it passes under a slab 1.4 m over the street that stops a standing one;
 * and under such a slab the player stays crouched with the key let go, never standing up into it.
 */

/** Open street, everyone gone, a slab 1.4..1.6 m over the ground from 1 m to 6 m east of the player, 3 m wide. */
const underSlab = (): { sim: Simulation; start: Vec3 } => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, STREET_START, Math.PI / 2);
  sim.step();
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  const start = { ...sim.player()!.position };
  const y = start.y;
  const solid = { min: { x: start.x + 1, y: y + 1.4, z: start.z - 1.5 }, max: { x: start.x + 6, y: y + 1.6, z: start.z + 1.5 } };
  const p = { x: start.x + 3.5, y: y + 1.5, z: start.z };
  sim.world.add({ id: 4501, position: p, prevPosition: p, yaw: 0, prevYaw: 0, pitch: 0, view: { kind: "block", size: { x: 5, y: 0.2, z: 3 }, material: "concrete" }, solid });
  return { sim, start };
};

describe("the crouched body under a low ceiling (ADR-0069, ADR-0082)", () => {
  it("is lower than the slab, the standing body is not", () => {
    expect(1.8 * CROUCH_BODY_SCALE).toBeLessThan(1.4);
  });

  it("passes crouching under a slab 1.4 m high that stops a standing body", () => {
    const standing = underSlab();
    teleportPlayer(standing.sim, standing.start, Math.PI / 2);
    run(standing.sim, 120, input({ moveZ: 1 }));
    expect(standing.sim.player()!.position.x).toBeLessThan(standing.start.x + 1);

    const crouched = underSlab();
    teleportPlayer(crouched.sim, crouched.start, Math.PI / 2);
    run(crouched.sim, 15, input({ crouch: true }));
    run(crouched.sim, 300, input({ moveZ: 1, crouch: true }));
    expect(crouched.sim.player()!.position.x).toBeGreaterThan(crouched.start.x + 7);
  });

  it("stays crouched under it with the key let go, and stands up past it", () => {
    const { sim, start } = underSlab();
    teleportPlayer(sim, { ...start, x: start.x + 3.5 }, Math.PI / 2);
    run(sim, 15, input({ crouch: true }));
    run(sim, 30);
    expect(sim.player()!.posture?.amount).toBe(1);
    run(sim, 200, input({ moveZ: 1 }));
    expect(sim.player()!.position.x).toBeGreaterThan(start.x + 6.5);
    run(sim, 30);
    expect(sim.player()!.posture?.amount).toBe(0);
  });
});
