import { describe, expect, it } from "vitest";
import { LUBLIN_CHUNKS, type LublinBuildingData, buildingView } from "@seki/sim/lublin";
import { MeshSink } from "../src/renderer/mesh-sink";
import { type MapBuilding, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { planFarBuilding, planNearBuilding } from "../src/renderer/mapcity/facade-plan";
import { facadeStyle } from "../src/renderer/mapcity/facade-style";
import { type BuildingSource, mapBuilding } from "../src/renderer/mapcity/map-building";
import { type P2, centroid, cleanRing, pointInRing } from "../src/renderer/mapcity/polygon";
import { planBuildingSigns } from "../src/renderer/mapcity/sign-plan";

/**
 * Parts of the landmarks lifted onto them (OSM `building:part`, G-049): a nave over a church's
 * aisles, a turret, a helmet. Each is a building of its own with its walls from its soffit up.
 */

const rect = (x0: number, z0: number, x1: number, z1: number): P2[] =>
  cleanRing([
    { x: x0, z: z0 },
    { x: x1, z: z0 },
    { x: x1, z: z1 },
    { x: x0, z: z1 },
  ]);

/** A church's nave over its aisles: 20 x 12 m, walls from 19 m to 29 m over the street, a 7 m roof. */
const nave: MapBuilding = { id: 7, ring: rect(0, 0, 20, 12), base: 0, foot: 19, height: 29, levels: 9, use: "church", look: 0x2b1d, roof: 7, lifted: true };
/** The church under it: its top (world y) wherever the nave's walls look out. */
const church = () => 19;

const topOf = (plan: (sink: MeshSink) => void): number => {
  const sink = new MeshSink();
  plan(sink);
  let top = -Infinity;
  for (let i = 0; i < sink.vertexCount; i++) top = Math.max(top, sink.positions[i * 3 + 1]!);
  return top;
};

describe("parts lifted onto a landmark (G-049)", () => {
  it("raise no bell towers of their own: a church's towers are the church's", () => {
    const f = facadeFrame(nave, church);
    expect(f.style.tower).toBe(true);
    expect(topOf((s) => planNearBuilding(s, f))).toBeLessThanOrEqual(nave.height + nave.roof! + 0.5);
    expect(topOf((s) => planFarBuilding(s, f))).toBeLessThanOrEqual(nave.height + nave.roof! + 0.5);
  });

  it("take a hipped roof, never a dome drawn by chance over a gabled nave", () => {
    for (let look = 0; look < 64; look++) {
      expect(facadeStyle({ use: "church", levels: 6, height: 20, roof: 6, look, area: 140, width: 10, lifted: true }).roof).toBe("hip");
    }
    // On the ground the same plans still get their domes now and then.
    const kinds = new Set(Array.from({ length: 64 }, (_, look) => facadeStyle({ use: "church", levels: 6, height: 20, roof: 6, look, area: 140, width: 10 }).roof));
    expect(kinds.has("dome")).toBe(true);
  });

  it("have windows over the building under them: it is no neighbour's firewall", () => {
    const f = facadeFrame(nave, church);
    expect(f.walls.every((w) => !w.blind)).toBe(true);
    // A footbridge between two taller houses still ends in their firewalls.
    const bridge: MapBuilding = { ...nave, use: "residential", foot: 4.6, height: 8, roof: 1.4 };
    expect(facadeFrame(bridge, () => 14).walls.every((w) => w.blind)).toBe(true);
  });

  it("hang no tall ad down past their own walls onto the building under them", () => {
    // The body of Wieża Trynitarska: 10 m of walls from 42 m to 52 m.
    for (let look = 0; look < 32; look++) {
      const body: MapBuilding = { id: 8, ring: rect(0, 0, 12, 12), base: 0, foot: 42, height: 52, levels: 3, use: "historic", look, lifted: true };
      const sink = new MeshSink();
      planBuildingSigns(sink, facadeFrame(body, () => 42), () => null);
      for (let i = 0; i < sink.vertexCount; i++) expect(sink.positions[i * 3 + 1]!, `look ${look}`).toBeGreaterThanOrEqual(42 - 0.01);
    }
  });
});

/** A building of the generated centre as the renderer gets it (ADR-0044). */
const sourceOf = (b: LublinBuildingData): BuildingSource => {
  const view = buildingView(b);
  if (view.kind !== "building") throw new Error("not a building");
  const at = { x: b.x, y: b.y, z: b.z };
  return { ring: cleanRing(view.outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z }))), view, at };
};

/** The top (world y) of a building's block among the buildings round it: over its roof only with towers. */
const blockTop = (e: BuildingSource, around: readonly BuildingSource[], near = false): number =>
  topOf((s) => (near ? planNearBuilding : planFarBuilding)(s, facadeFrame(mapBuilding(1, e, () => null, around), () => null)));
const roofTop = (e: BuildingSource): number => e.at.y + e.view.height + (e.view.roof ?? 0) + 0.5;

describe("a church whose parts come from the map (G-057)", () => {
  const all = LUBLIN_CHUNKS.flatMap((c) => c.buildings);
  const byId = (id: string): BuildingSource => {
    const b = all.find((o) => o.id === id);
    if (!b) throw new Error(`no ${id}`);
    return sourceOf(b);
  };

  it("raises no procedural towers over the parts it has (Archikatedra, Dominicans)", () => {
    for (const [church, parts] of [
      ["w66286341", ["w617763433", "w617763434", "w617763435"]],
      ["w66286338", ["w618270604", "w618270605", "w617763428", "w617763429"]],
    ] as const) {
      const e = byId(church);
      expect(e.view.use).toBe("church");
      for (const near of [false, true]) expect(blockTop(e, parts.map(byId), near), `${church} near ${near}`).toBeLessThanOrEqual(roofTop(e));
    }
  });

  it("keeps them with no part on it: none, or a part of another church", () => {
    const e = byId("w66286341");
    expect(blockTop(e, [])).toBeGreaterThan(roofTop(e) + 5);
    expect(blockTop(e, [byId("w617763428")])).toBeGreaterThan(roofTop(e) + 5);
    // The parts themselves stay without towers (G-049) whatever stands round them.
    expect(blockTop(byId("w617763433"), [e])).toBeLessThanOrEqual(roofTop(byId("w617763433")));
  });

  it("over the whole centre: no church a part stands on keeps towers, every other church does", () => {
    // The landmarks the map shows without a tower (G-210) and the churches the map has a tower by
    // (G-212) keep none either: landmark-towers.test.ts. The Discalced Carmelites' outline is the
    // whole friary, its box's west end on the grass (G-212): no tower stands there.
    const towerless = ["w66258167", "w66330578", "w69916021", "w66258180", "w66264082", "r5420467"].map(byId);
    const sources = all.map(sourceOf);
    const lifted = sources.filter((s) => s.view.soffit !== undefined);
    const churches = sources.filter((s) => s.view.use === "church" && s.view.soffit === undefined);
    const carrying = churches.filter((c) => lifted.some((p) => pointInRing(centroid(p.ring), c.ring)));
    expect(carrying.length).toBe(2);
    for (const c of churches) {
      const top = blockTop(c, sources);
      if (carrying.includes(c) || towerless.some((t) => t.at.x === c.at.x && t.at.z === c.at.z)) expect(top).toBeLessThanOrEqual(roofTop(c));
      else expect(top).toBeGreaterThan(roofTop(c));
    }
  });
});
