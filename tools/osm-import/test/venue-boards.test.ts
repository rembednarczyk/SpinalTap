import { describe, expect, it } from "vitest";
import { boundsOf, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import { cityFrames } from "../src/venue-boards.ts";

describe("the city's buildings framed as the map city frames them", () => {
  it("finds the same neighbour over every building as a scan of them all (G-200)", () => {
    const frames = cityFrames(WORLD_SCENERY);
    const all = frames.map((b) => {
      const ring = cleanRing(b.view.outline.map((p) => ({ x: p.x + b.at.x, z: p.z + b.at.z })));
      return { ring, bounds: boundsOf(ring), top: b.at.y + b.view.height };
    });
    const scan = (x: number, z: number, self: number): number | null => {
      let top: number | null = null;
      all.forEach((b, i) => {
        if (i + 1 !== self && x >= b.bounds.minX && x <= b.bounds.maxX && z >= b.bounds.minZ && z <= b.bounds.maxZ && pointInRing({ x, z }, b.ring)) top = Math.max(top ?? -Infinity, b.top);
      });
      return top;
    };
    let met = 0;
    // Just outside and just inside each wall's middle and ends, where the frames sample.
    for (const b of frames.filter((_, i) => i % 3 === 0)) {
      for (const w of b.frame.walls) {
        for (const t of [0.02, 0.5, 0.98]) {
          for (const out of [0.6, -0.3]) {
            const x = w.a.x + (w.b.x - w.a.x) * t + w.nx * out;
            const z = w.a.z + (w.b.z - w.a.z) * t + w.nz * out;
            const want = scan(x, z, b.frame.b.id);
            if (want !== null) met++;
            expect(b.frame.neighbour(x, z, b.frame.b.id), `${x}, ${z}`).toBe(want);
          }
        }
      }
    }
    expect(met).toBeGreaterThan(1000);
  });
});
