import { describe, expect, it } from "vitest";
import { LUBLIN_CHUNKS } from "@seki/sim/lublin";
import { CANOPY_MIN_DEPTH, mapBuilding } from "../src/renderer/mapcity/map-building";

/** The map's roofs on posts (G-063) as the renderer draws them: from the simulation's soffit, a thin slab. */
const ROOFS = LUBLIN_CHUNKS.flatMap((c) => c.canopies ?? []);
const pts = (flat: readonly number[]) => Array.from({ length: flat.length >> 1 }, (_, i) => ({ x: flat[2 * i]!, z: flat[2 * i + 1]! }));

describe("the roofs on posts drawn (G-063)", () => {
  it("start at the soffit the simulation's slab starts at, however thin the slab", () => {
    expect(ROOFS.length).toBeGreaterThan(0);
    for (const r of ROOFS) {
      const outline = pts(r.outline);
      const view = { kind: "building" as const, outline, height: r.height, levels: 1, use: "garage" as const, look: r.look, soffit: r.soffit };
      const b = mapBuilding(1, { ring: outline.map((p) => ({ x: p.x + r.x, z: p.z + r.z })), view, at: { x: r.x, y: r.y, z: r.z } }, () => null);
      expect(b.canopy, r.id).toBeDefined();
      expect(b.foot, r.id).toBeCloseTo(r.y + r.soffit, 5);
      expect(r.height - r.soffit, r.id).toBeGreaterThanOrEqual(CANOPY_MIN_DEPTH);
      expect(r.height - r.soffit, r.id).toBeLessThan(1);
    }
  });

  it("keeps a lifted building that is no roof on posts a storey's metre deep", () => {
    const outline = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }];
    const view = { kind: "building" as const, outline, height: 5.3, levels: 1, use: "residential" as const, look: 1, soffit: 5 };
    const b = mapBuilding(1, { ring: outline.map((p) => ({ x: p.x + 9999, z: p.z + 9999 })), view, at: { x: 9999, y: 0, z: 9999 } }, () => null);
    expect(b.canopy).toBeUndefined();
    expect(b.foot).toBeCloseTo(4.3, 5);
  });
});
