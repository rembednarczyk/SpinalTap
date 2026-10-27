import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { buildBlock } from "../src/renderer/props";

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);
const size = { x: 8, y: 4, z: 2 };

describe("sloped blocks (ADR-0020)", () => {
  it("draws stairs as one merged mesh of steps climbing along the axis", () => {
    const prop = buildBlock(scene, materials, "st", { kind: "block", size, material: "concrete", slope: { axis: "x", dir: 1, low: 0, steps: 16 } }, Vector3.Zero());
    const meshes = prop.root.getChildMeshes();
    expect(meshes).toHaveLength(1);
    const box = meshes[0]!.getBoundingInfo().boundingBox;
    expect(box.maximum.y).toBeCloseTo(size.y / 2 - (size.y / 16) * 0.5, 5);
    expect(box.minimum.y).toBeCloseTo(-size.y / 2, 5);
    expect(box.maximum.x - box.minimum.x).toBeCloseTo(size.x, 5);
  });

  it("slopes the top of a railing from `low` at the low end", () => {
    const prop = buildBlock(scene, materials, "rl", { kind: "block", size, material: "metal", slope: { axis: "x", dir: -1, low: 1 } }, Vector3.Zero());
    const mesh = prop.root.getChildMeshes()[0]!;
    const pos = mesh.getVerticesData("position")!;
    let lowEnd = -Infinity;
    let highEnd = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      if (pos[i]! > 3.9) lowEnd = Math.max(lowEnd, pos[i + 1]!);
      if (pos[i]! < -3.9) highEnd = Math.max(highEnd, pos[i + 1]!);
    }
    expect(lowEnd).toBeCloseTo(-size.y / 2 + 1, 5);
    expect(highEnd).toBeCloseTo(size.y / 2, 5);
  });
});
