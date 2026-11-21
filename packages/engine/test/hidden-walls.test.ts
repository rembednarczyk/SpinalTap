import { SCENERY_ID_BASE, WORLD_SCENERY } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { facadeFrame, hiddenWall } from "../src/renderer/mapcity/facade-frame";
import { landmarkAt } from "../src/renderer/mapcity/landmarks";
import { type BuildingEntry, MapEntries } from "../src/renderer/mapcity/map-entries";
import { type P2, boundsOf, cleanRing, pointInRing } from "../src/renderer/mapcity/polygon";

/**
 * Walls left out behind a neighbour (21.11, the user's "transparent walls"): a wall is not drawn
 * only where other buildings cover the whole of it up to its top, else a stretch of it would be a
 * hole into the empty building, its far walls seen from behind and culled.
 */
const entry = (ring: P2[], height: number): BuildingEntry =>
  ({
    ring: cleanRing(ring),
    view: { kind: "building", outline: ring, height, levels: 3, use: "commercial", look: 1 },
    at: { x: 0, y: 0, z: 0 },
    base: 0,
    bounds: boundsOf(ring),
    cell: "test",
    landmark: null,
  }) as BuildingEntry;

const box = (x0: number, z0: number, x1: number, z1: number): P2[] => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];

/** The wall of building 1 along z = 0, x 0..20, facing -z, with the given neighbours on that side. */
const southWall = (neighbours: P2[][]) => {
  const m = new MapEntries();
  m.addBuilding(1, entry(box(0, 0, 20, 10), 12));
  neighbours.forEach((r, i) => m.addBuilding(2 + i, entry(r, 15)));
  const f = facadeFrame(m.building(1, m.buildings.get(1)!), m.neighbourAt, m.neighboursNear, () => false);
  const w = f.walls.find((q) => q.nz < -0.99)!;
  return { f, w };
};

/** Every stretch of the wall, 2 cm off its ends and 0.6 m out, under another building at least its top high. */
const coveredWhole = (m: MapEntries, id: number, a: P2, b: P2, nx: number, nz: number, top: number): boolean => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  for (let u = Math.min(0.02, len / 2); u <= len - Math.min(0.02, len / 2) + 1e-9; u += 0.1) {
    const t = u / len;
    const h = m.neighbourAt(a.x + (b.x - a.x) * t + nx * 0.6, a.z + (b.z - a.z) * t + nz * 0.6, id);
    if (h === null || h < top - 0.1) return false;
  }
  return true;
};

describe("walls behind a neighbour", () => {
  it("leaves out a wall a neighbour covers whole, and draws one three neighbours cover only at the samples", () => {
    const whole = southWall([box(-2, -4, 22, 0.1)]);
    expect(whole.w.blind).toBe(true);
    expect(hiddenWall(whole.f, whole.w)).toBe(true);
    // Three narrow buildings over 15%, 50% and 85% of the wall: the stretches between them are open.
    const spotty = southWall([box(2, -4, 4, 0.1), box(9, -4, 11, 0.1), box(16, -4, 18, 0.1)]);
    expect(spotty.w.blind).toBe(true);
    expect(hiddenWall(spotty.f, spotty.w)).toBe(false);
    // A lower neighbour over half the wall: the rest of it shows over the roof.
    const low = southWall([box(-2, -4, 22, 0.1)]);
    expect(low.w.hiddenTo).toBeGreaterThanOrEqual(low.f.top - 0.1);
  });

  it("leaves no stretch of any wall of Lublin open behind a neighbour, every wall facing out of its building", () => {
    const m = new MapEntries();
    WORLD_SCENERY.forEach(({ view, at }, i) => {
      if (view.kind !== "building") return;
      const ring = cleanRing(view.outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z })));
      if (ring.length < 3) return;
      m.addBuilding(SCENERY_ID_BASE + i, { ring, view, at, base: at.y, bounds: boundsOf(ring), cell: "", landmark: landmarkAt(at.x, at.z, view.outline.length) });
    });
    expect(m.buildings.size).toBeGreaterThan(600);
    const open: string[] = [];
    const inward: string[] = [];
    let hidden = 0;
    for (const [id, e] of m.buildings) {
      const f = facadeFrame(m.building(id, e), m.neighbourAt, m.neighboursNear, () => false);
      for (const w of f.walls) {
        const mid = { x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 };
        const at = `(${mid.x.toFixed(1)}, ${mid.z.toFixed(1)})`;
        // Never in its own building in front and out of it behind: the faces are wound to the normal, so an inward one is
        // culled from the street. (Both out is a needle of the outline a few centimetres wide, not a turned wall.)
        if (pointInRing({ x: mid.x + w.nx * 0.05, z: mid.z + w.nz * 0.05 }, e.ring) && !pointInRing({ x: mid.x - w.nx * 0.05, z: mid.z - w.nz * 0.05 }, e.ring)) inward.push(at);
        if (!hiddenWall(f, w)) continue;
        hidden++;
        if (!coveredWhole(m, id, w.a, w.b, w.nx, w.nz, f.top)) open.push(at);
      }
    }
    expect(hidden).toBeGreaterThan(200);
    expect(open).toEqual([]);
    expect(inward).toEqual([]);
  });
});
