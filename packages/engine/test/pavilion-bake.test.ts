import { describe, expect, it } from "vitest";
import { METRO_ENTRANCES, WORLD_SCENERY } from "@seki/sim";
import { bakePavilion, bakePavilionFar, pavilionsIn } from "../src/renderer/metro/pavilion-bake";
import { cellBounds, cellKey } from "../src/renderer/mapcity/map-index";
import { PROP_BLOCK } from "../src/renderer/mapcity/prop-shapes";
import { MeshSink } from "../src/renderer/mesh-sink";

/** ADR-0071: up to 2 thousand triangles an entrance, baked into meshes the city already draws. */
const BUDGET = 2000;

describe("the metro's pavilions in the furniture's blocks (ADR-0071 stage 2)", () => {
  it("bakes each one under its budget of triangles, near and far", () => {
    for (const e of METRO_ENTRANCES) {
      const near = new MeshSink();
      bakePavilion(near, e);
      const far = new MeshSink();
      bakePavilionFar(far, e);
      expect(near.indices.length / 3, `${e.station} ${e.label}`).toBeLessThan(BUDGET);
      expect(near.indices.length / 3).toBeGreaterThan(300);
      expect(far.indices.length / 3).toBeLessThanOrEqual(24);
    }
  });

  it("puts each one in exactly one block, a block that has furniture of its own (so the block's meshes exist)", () => {
    const furniture = WORLD_SCENERY.flatMap((s) => (s.view.kind === "street-props" ? s.view.items : []));
    for (const e of METRO_ENTRANCES) {
      const key = cellKey(e.spot.x, e.spot.z, PROP_BLOCK);
      const bounds = cellBounds(key, PROP_BLOCK);
      expect(pavilionsIn(bounds)).toContain(e);
      expect(furniture.some((p) => cellKey(p.x, p.z, PROP_BLOCK) === key), `${e.station} ${e.label}`).toBe(true);
    }
  });

  it("draws the stairs down to the hall's floor and the roof over the street", () => {
    const e = METRO_ENTRANCES[0]!;
    const sink = new MeshSink();
    bakePavilion(sink, e);
    const ys = sink.positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeCloseTo(e.floor - 0.3, 5);
    expect(Math.max(...ys)).toBeCloseTo(e.street + 3.3, 5);
  });
});
