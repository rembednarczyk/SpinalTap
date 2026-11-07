import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { type RayClient, connectWorldRays } from "../src/world-rays";
import { setup, steps } from "./story-helpers";

/**
 * The simulation's rays handed to the renderer (ADR-0045, G-458): the TPP camera looks past the
 * street furniture, a lying body is laid clear of it (the body dropped against a container went
 * into it while the walls were the camera's).
 */

type Ray = (origin: Vec3, dir: Vec3, maxDist: number) => number | null;

const fakeRenderer = () => {
  const r: RayClient & { occluder: Ray | null } = {
    occluder: null,
    wallRay: null,
    rig: { setOccluder: (ray) => (r.occluder = ray) },
  };
  return r;
};

describe("the simulation's rays in the renderer (G-458)", () => {
  it("the walls of a lying body include the street furniture the camera looks past", () => {
    const { session } = setup();
    session.newGame();
    steps(session, 2);
    const renderer = fakeRenderer();
    connectWorldRays(renderer, () => session.sim);
    const furniture = session.sim.world.entities.find((e) => e.solid && e.seeThrough && e.solid.max.y - e.solid.min.y > 0.5)!;
    expect(furniture).toBeDefined();
    const box = furniture.solid!;
    // Two metres off its -X side, level, at half its height.
    const origin = { x: box.min.x - 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2 };
    const ahead = { x: 1, y: 0, z: 0 };
    // At its side (the solid index's ray lands within a few centimetres of it).
    expect(renderer.wallRay?.(origin, ahead, 5)).toBeCloseTo(2, 1);
    expect(renderer.occluder?.(origin, ahead, 5) ?? 5).toBeGreaterThan(2.5);
  });
});
