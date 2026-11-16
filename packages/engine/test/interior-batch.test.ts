import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import type { Mesh } from "../src/babylon";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { InteriorBatches } from "../src/renderer/interior-batch";

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);
const wall = () => ({ kind: "block", size: { x: 0.3, y: 4, z: 6 }, material: "concrete", interior: true }) as const;

describe("interior blocks merged per preset and cell (ADR-0038)", () => {
  it("draws many boxes as one mesh, rebuilds on removal and drops an empty group", () => {
    const live = new Set<Mesh>();
    const batches = new InteriorBatches(scene, materials, (old, next) => {
      if (old) live.delete(old);
      if (next) live.add(next);
    });
    batches.add(1, wall(), { x: 0, y: 2, z: 0 });
    batches.add(2, wall(), { x: 3, y: 2, z: 0 });
    batches.add(3, { kind: "block", size: { x: 1, y: 1, z: 1 }, material: "metal", interior: true }, { x: 1, y: 0.5, z: 1 });
    batches.flush();
    expect(batches.size).toBe(3);
    expect(live.size).toBe(2);
    const concrete = [...live].find((m) => m.getTotalVertices() === 48)!;
    expect(concrete).toBeDefined();
    expect(concrete.getBoundingInfo().boundingBox.maximumWorld.x).toBeCloseTo(3.15, 5);
    batches.remove(2);
    batches.flush();
    expect([...live].map((m) => m.getTotalVertices()).sort()).toEqual([24, 24]);
    batches.remove(1);
    batches.remove(3);
    batches.flush();
    expect(live.size).toBe(0);
    expect(batches.has(1)).toBe(false);
  });
});
