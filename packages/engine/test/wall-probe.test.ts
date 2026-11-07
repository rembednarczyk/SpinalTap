import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { type AbstractMesh, MeshBuilder, Scene } from "../src/babylon";
import { wallProbe } from "../src/renderer/wall-probe";

/** G-458: the walls round a lying body are the scene's blockers and the simulation's ray, the nearer of the two. */

const setup = () => {
  const scene = new Scene(new NullEngine());
  // A blocker box whose near face is 2 m ahead (+Z) of the origin, and a box nobody counts as a wall 1 m ahead.
  const wall = MeshBuilder.CreateBox("wall", { size: 1 }, scene);
  wall.position.set(0, 0.5, 2.5);
  const prop = MeshBuilder.CreateBox("prop", { size: 1 }, scene);
  prop.position.set(0, 0.5, -1.5);
  for (const m of [wall, prop]) m.computeWorldMatrix(true);
  const blockers = new Set<AbstractMesh>([wall]);
  return { scene, isBlocker: (m: AbstractMesh) => blockers.has(m) };
};

const O = { x: 0, y: 0.3, z: 0 };
const AHEAD = { x: 0, y: 0, z: 1 };
const BACK = { x: 0, y: 0, z: -1 };

describe("wall probe (G-458)", () => {
  it("takes the nearer of the scene's blocker and the simulation's ray", () => {
    const { scene, isBlocker } = setup();
    expect(wallProbe(scene, isBlocker, () => () => 3)(O, AHEAD, 4)).toBeCloseTo(2, 3);
    expect(wallProbe(scene, isBlocker, () => () => 1.2)(O, AHEAD, 4)).toBeCloseTo(1.2, 6);
  });

  it("takes either alone, and null from neither (meshes that are no blockers do not count)", () => {
    const { scene, isBlocker } = setup();
    expect(wallProbe(scene, isBlocker, () => null)(O, AHEAD, 4)).toBeCloseTo(2, 3);
    expect(wallProbe(scene, isBlocker, () => () => null)(O, AHEAD, 1.5)).toBeNull();
    expect(wallProbe(scene, isBlocker, () => () => 0.8)(O, BACK, 4)).toBeCloseTo(0.8, 6);
    expect(wallProbe(scene, isBlocker, () => () => null)(O, BACK, 4)).toBeNull();
  });
});
