import { describe, expect, it } from "vitest";
import { LUBLIN_CHUNKS, type LublinBuildingData, buildingView } from "@seki/sim/lublin";
import { MeshSink } from "../src/renderer/mesh-sink";
import { type MapBuilding, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { planFarBuilding, planNearBuilding } from "../src/renderer/mapcity/facade-plan";
import { type BuildingSource, mapBuilding } from "../src/renderer/mapcity/map-building";
import { type P2, cleanRing, pointInRing } from "../src/renderer/mapcity/polygon";
import { addTowers } from "../src/renderer/mapcity/roof-plan";

/**
 * Landmarks the map shows whole and without a tower (G-210): the Trinity Chapel by the keep has
 * none, so the renderer's bell towers of a church (`roof-plan`) match nothing there. The
 * Bernardine church has a real one by its south wall (about (378.1, -247.7)), which waits for its
 * part (G-214); the renderer's two at its west end would stand in the wrong place. A church the
 * map has a tower by (G-212) keeps that one only, and no tower stands off its church.
 */

const all = LUBLIN_CHUNKS.flatMap((c) => c.buildings);
const byId = (id: string): LublinBuildingData => {
  const b = all.find((o) => o.id === id);
  if (!b) throw new Error(`no ${id}`);
  return b;
};

/** A building of the generated centre as the renderer gets it (ADR-0044), moved by (dx, dz). */
const sourceOf = (b: LublinBuildingData, dx = 0, dz = 0): BuildingSource => {
  const view = buildingView(b);
  if (view.kind !== "building") throw new Error("not a building");
  const at = { x: b.x + dx, y: b.y, z: b.z + dz };
  return { ring: cleanRing(view.outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z }))), view, at };
};

/** The top (world y) of a building's block, near or far. */
const blockTop = (e: BuildingSource, near: boolean): number => {
  const sink = new MeshSink();
  (near ? planNearBuilding : planFarBuilding)(sink, facadeFrame(mapBuilding(1, e, () => null), () => null));
  let top = -Infinity;
  for (let i = 0; i < sink.vertexCount; i++) top = Math.max(top, sink.positions[i * 3 + 1]!);
  return top;
};
const roofTop = (e: BuildingSource): number => e.at.y + e.view.height + (e.view.roof ?? 0) + 0.5;

const CHAPEL = "w66258167";
const BERNARDINES = "w66330578";
const KEEP = "w450180469";
const JOSAPHAT = "w69916021";
const NICHOLAS = "w66258180";
const BRIGITTINES = "w66264082";

describe("a landmark the map shows without a tower (G-210)", () => {
  it("raises no bell tower over the Trinity Chapel: the keep stays the castle hill's highest point", () => {
    const chapel = sourceOf(byId(CHAPEL));
    expect(chapel.view.use).toBe("church");
    const keep = byId(KEEP);
    for (const near of [false, true]) {
      const top = blockTop(chapel, near);
      expect(top, `near ${near}`).toBeLessThanOrEqual(roofTop(chapel));
      expect(top, `near ${near}`).toBeLessThan(keep.y + keep.height + (keep.roof ?? 0));
    }
  });

  it("nor over the Bernardine church, whose real tower waits for its part (G-214)", () => {
    const church = sourceOf(byId(BERNARDINES));
    expect(church.view.use).toBe("church");
    for (const near of [false, true]) expect(blockTop(church, near), `near ${near}`).toBeLessThanOrEqual(roofTop(church));
  });

  it("goes by the place, not the shape: the same chapel elsewhere is a church with its tower", () => {
    const moved = sourceOf(byId(CHAPEL), 300, 0);
    for (const near of [false, true]) expect(blockTop(moved, near), `near ${near}`).toBeGreaterThan(roofTop(moved) + 5);
  });
});

describe("a church the map has a tower by (G-212)", () => {
  it("raises no bell tower beside the map's: St Josaphat's, St Nicholas's, the Brigittines'", () => {
    // Josaphat's tower w1382552285 by its west front, Nicholas's belfry w680377807 7 m off the
    // nave, the Brigittines' w1090997970 by their wall (not imported, G-098).
    for (const id of [JOSAPHAT, NICHOLAS, BRIGITTINES]) {
      const church = sourceOf(byId(id));
      expect(church.view.use, id).toBe("church");
      for (const near of [false, true]) expect(blockTop(church, near), `${id} near ${near}`).toBeLessThanOrEqual(roofTop(church));
    }
  });

  it("goes by the place: the same church elsewhere, with no tower of the map by it, gets its own", () => {
    const moved = sourceOf(byId(NICHOLAS), 300, 0);
    for (const near of [false, true]) expect(blockTop(moved, near), `near ${near}`).toBeGreaterThan(roofTop(moved) + 5);
  });
});

const GREY = [0.5, 0.5, 0.5, 1] as const;

/** The tips of the renderer's far towers on a building: its highest points, one per spire. */
const towerTips = (b: MapBuilding): P2[] => {
  const sink = new MeshSink();
  addTowers(sink, facadeFrame(b, () => null), { wall: GREY, trim: GREY, plinth: GREY, roof: GREY }, false);
  const at = (i: number): P2 => ({ x: sink.positions[i * 3]!, z: sink.positions[i * 3 + 2]! });
  const ys = Array.from({ length: sink.vertexCount }, (_, i) => sink.positions[i * 3 + 1]!);
  const top = Math.max(...ys);
  const tips = new Map(ys.flatMap((y, i): [string, P2][] => (y > top - 1e-6 ? [[`${at(i).x.toFixed(2)},${at(i).z.toFixed(2)}`, at(i)]] : [])));
  return [...tips.values()];
};

describe("the renderer's bell towers (G-212)", () => {
  const box = cleanRing([
    { x: 5000, z: 5000 },
    { x: 5040, z: 5000 },
    { x: 5040, z: 5030 },
    { x: 5000, z: 5030 },
  ]);
  // The box with its north-west corner cut off: grass where the second tower across the west end stood.
  const bent = cleanRing([...box.slice(0, 3), { x: 5014, z: 5030 }, { x: 5014, z: 5015 }, { x: 5000, z: 5015 }]);
  const church: MapBuilding = { id: 1, ring: box, base: 0, foot: 0, height: 15, levels: 4, use: "church", look: 3, roof: 6 };

  it("stand with their middles on the church, never on the grass by a bent outline", () => {
    expect(towerTips(church)).toHaveLength(2);
    const tips = towerTips({ ...church, ring: bent });
    expect(tips).toHaveLength(1);
    expect(tips.every((t) => pointInRing(t, bent))).toBe(true);
  });
});
