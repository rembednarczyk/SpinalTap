import { describe, expect, it } from "vitest";
import { LUBLIN_CHUNKS, type LublinBuildingData, buildingView } from "@seki/sim/lublin";
import { MeshSink } from "../src/renderer/mesh-sink";
import { facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { planFarBuilding, planNearBuilding } from "../src/renderer/mapcity/facade-plan";
import { type BuildingSource, mapBuilding } from "../src/renderer/mapcity/map-building";
import { cleanRing } from "../src/renderer/mapcity/polygon";

/**
 * Landmarks the map shows whole and without a tower (G-210): the Trinity Chapel by the keep has
 * none, so the renderer's bell towers of a church (`roof-plan`) match nothing there. The
 * Bernardine church has a real one by its south wall (about (378.1, -247.7)), which waits for its
 * part (G-214); the renderer's two at its west end would stand in the wrong place.
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
