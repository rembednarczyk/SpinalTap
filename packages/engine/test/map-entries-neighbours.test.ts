import { describe, expect, it } from "vitest";
import { type BuildingEntry, MapEntries } from "../src/renderer/mapcity/map-entries";
import type { Box2, P2 } from "../src/renderer/mapcity/polygon";

const boundsOf = (ring: readonly P2[]): Box2 => ({
  minX: Math.min(...ring.map((p) => p.x)),
  maxX: Math.max(...ring.map((p) => p.x)),
  minZ: Math.min(...ring.map((p) => p.z)),
  maxZ: Math.max(...ring.map((p) => p.z)),
});

const entry = (ring: P2[], height: number, base = 0): BuildingEntry =>
  ({
    ring,
    view: { kind: "building", outline: ring, height, levels: 3, use: "commercial", look: 1 },
    at: { x: 0, y: base, z: 0 },
    base,
    bounds: boundsOf(ring),
    cell: "test",
    landmark: null,
  }) as BuildingEntry;

const inside = (b: Box2, x: number, z: number): boolean => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

/**
 * The street wall of building 1 runs along z = 0 from x = 20 to x = 50, across the bin edge at
 * x = 32. Its neighbours: one straddling the bin edge, one with a skewed outline, one taller part
 * standing only over the wall's far end, and one far away.
 */
const city = (): MapEntries => {
  const m = new MapEntries();
  m.addBuilding(1, entry([{ x: 20, z: 0 }, { x: 50, z: 0 }, { x: 50, z: 12 }, { x: 20, z: 12 }], 15));
  m.addBuilding(2, entry([{ x: 28, z: -3 }, { x: 36, z: -3 }, { x: 36, z: 0.1 }, { x: 28, z: 0.1 }], 12));
  m.addBuilding(3, entry([{ x: 40, z: -2 }, { x: 46, z: -0.5 }, { x: 45, z: 0.15 }, { x: 39.5, z: -1 }], 18));
  m.addBuilding(4, entry([{ x: 48, z: -1 }, { x: 52, z: -1 }, { x: 52, z: 0.2 }, { x: 48, z: 0.2 }], 30, 10));
  m.addBuilding(5, entry([{ x: 200, z: 200 }, { x: 210, z: 200 }, { x: 210, z: 210 }, { x: 200, z: 210 }], 20));
  return m;
};

describe("MapEntries.neighboursNear (G-182)", () => {
  it("returns every other building neighbourAt can find along a wall, and never the building itself", () => {
    const m = city();
    // The wall's box as the sign plan grows it: 0.22 m out from the wall and one sample step.
    const box: Box2 = { minX: 20 - 0.32, maxX: 50 + 0.32, minZ: -0.32, maxZ: 0.32 };
    const near = m.neighboursNear(box, 1);
    let found = 0;
    for (let x = box.minX; x <= box.maxX; x += 0.05) {
      for (let z = box.minZ; z <= box.maxZ; z += 0.05) {
        if (m.neighbourAt(x, z, 1) === null) continue;
        found++;
        expect(near.some((b) => inside(b, x, z))).toBe(true);
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(near).toHaveLength(3);
    expect(near).not.toContainEqual(m.buildings.get(1)?.bounds);
    expect(near).not.toContainEqual(m.buildings.get(5)?.bounds);
  });

  it("finds none for a wall with no building near it, and forgets a removed one", () => {
    const m = city();
    expect(m.neighboursNear({ minX: 100, maxX: 120, minZ: 100, maxZ: 101 }, 1)).toEqual([]);
    m.remove(2);
    const near = m.neighboursNear({ minX: 27, maxX: 37, minZ: -0.32, maxZ: 0.32 }, 1);
    expect(near).toEqual([]);
  });
});
