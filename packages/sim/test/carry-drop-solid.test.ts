import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import type { Entity, Simulation } from "../src";
import { input, run } from "./helpers";
import { quietStreet, takeDown, ticks, victim } from "./takedown-scenes";

/** G-479: a body put down in front of the player lands beside a solid, never with its centre inside one. */

const STAND = input();

/** A container (no hiding place) with its footprint `min`..`max` on the ground under the player. */
const container = (sim: Simulation, id: number, min: { x: number; z: number }, max: { x: number; z: number }): Entity => {
  const y = sim.player()!.position.y;
  const center = { x: (min.x + max.x) / 2, y: y + 1.3, z: (min.z + max.z) / 2 };
  return sim.world.add({
    id,
    position: center,
    prevPosition: center,
    yaw: 0,
    prevYaw: 0,
    pitch: 0,
    chunk: sim.player()!.chunk ?? "",
    view: { kind: "block", size: { x: max.x - min.x, y: 2.6, z: max.z - min.z }, material: "metal" },
    solid: { min: { x: min.x, y, z: min.z }, max: { x: max.x, y: y + 2.6, z: max.z } },
  });
};

/** The player with a knocked-out guard on her shoulder, facing `yaw`. */
const carrying = (seed: number, yaw: number): { sim: Simulation; body: Entity } => {
  const sim = quietStreet(seed);
  const body = victim(sim);
  takeDown(sim);
  run(sim, ticks(1), STAND);
  sim.step(STAND);
  sim.enqueue({ type: "carry-body" });
  sim.step(STAND);
  expect(sim.session.carrying).toBe(body.id);
  const p = sim.player()!;
  p.yaw = yaw;
  p.prevYaw = yaw;
  return { sim, body };
};

const inside = (s: Entity, at: Vec3): boolean =>
  at.x > s.solid!.min.x && at.x < s.solid!.max.x && at.z > s.solid!.min.z && at.z < s.solid!.max.z;

/** Drops the body and checks its centre right after and 30 steps later. */
const dropClear = (sim: Simulation, body: Entity, solids: readonly Entity[]): void => {
  sim.enqueue({ type: "drop-body" });
  sim.step(STAND);
  expect(sim.session.carrying).toBeNull();
  for (const s of solids) expect(inside(s, body.position)).toBe(false);
  run(sim, 30, STAND);
  for (const s of solids) expect(inside(s, body.position)).toBe(false);
  // Still at her feet, not thrown across the street.
  const p = sim.player()!.position;
  expect(Math.hypot(body.position.x - p.x, body.position.z - p.z)).toBeLessThan(1.5);
};

describe("dropping a body by a solid (G-479)", () => {
  it("facing a container right in front of her: the body lands outside it", () => {
    const { sim, body } = carrying(7, 0);
    const p = sim.player()!.position;
    // The container's near face 0.45 m ahead (north), as the one at 391.2..392.8 x -33.6..-32.4.
    const box = container(sim, 9100, { x: p.x - 0.8, z: p.z + 0.45 }, { x: p.x + 0.8, z: p.z + 1.65 });
    dropClear(sim, body, [box]);
  });

  it("facing east, another seed, a container ahead and another on her left: still outside both", () => {
    const { sim, body } = carrying(11, Math.PI / 2);
    const p = sim.player()!.position;
    const ahead = container(sim, 9100, { x: p.x + 0.45, z: p.z - 0.8 }, { x: p.x + 1.65, z: p.z + 0.8 });
    const left = container(sim, 9101, { x: p.x - 0.8, z: p.z + 0.45 }, { x: p.x + 0.8, z: p.z + 1.65 });
    dropClear(sim, body, [ahead, left]);
  });

  it("boxed in on four sides: the body lies under her, in no container", () => {
    const { sim, body } = carrying(7, 0);
    const p = sim.player()!.position;
    const boxes = [
      container(sim, 9100, { x: p.x - 1.6, z: p.z + 0.45 }, { x: p.x + 1.6, z: p.z + 1.65 }),
      container(sim, 9101, { x: p.x - 1.6, z: p.z - 1.65 }, { x: p.x + 1.6, z: p.z - 0.45 }),
      container(sim, 9102, { x: p.x + 0.45, z: p.z - 0.44 }, { x: p.x + 1.65, z: p.z + 0.44 }),
      container(sim, 9103, { x: p.x - 1.65, z: p.z - 0.44 }, { x: p.x - 0.45, z: p.z + 0.44 }),
    ];
    dropClear(sim, body, boxes);
  });
});
