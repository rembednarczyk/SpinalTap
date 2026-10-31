import { describe, expect, it } from "vitest";
import { STOREY } from "../src/building-tags.ts";
import { ALL_CHUNKS } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import { type Pt, inRect, pointInRing } from "../src/geometry.ts";
import { loadInputs } from "../src/load.ts";
import { type BuildingOut } from "../src/model.ts";
import { filterOsm, parseOsmXml } from "../src/osm.ts";
import { worldToGeo } from "../src/project.ts";

/**
 * Landmarks mapped with `building:part` (Simple 3D Buildings, G-049): their towers, helmets and
 * naves come from the parts, not from the one outline round them.
 */

const ring = (b: BuildingOut): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < b.outline.length; i += 2) pts.push({ x: b.outline[i]! + b.x, z: b.outline[i + 1]! + b.z });
  return pts;
};

/** Highest point (world y, roofs included) of the buildings standing over (x, z). */
const peakAt = (all: readonly BuildingOut[], p: Pt): number => Math.max(...all.filter((b) => pointInRing(p, ring(b))).map((b) => b.y + b.height + (b.roof ?? 0)));

describe("building parts (G-049)", () => {
  const inputs = loadInputs();
  const at = (p: Pt) => ALL_CHUNKS.filter((c) => inRect(p, c.rect));
  const specs = [...new Set([...at({ x: 591.3, z: -147.3 }), ...at({ x: 472.6, z: -91.2 }), ...at({ x: 634.2, z: -183.8 }), ...at({ x: 416.1, z: -69.6 }), ...at({ x: 731.1, z: -55.5 })])];
  const all = generate(inputs.osm, inputs.src, specs).chunks.flatMap((c) => c.buildings);
  const byId = (id: string) => all.find((b) => b.id === id);

  it("raises Wieża Trynitarska to its helmet at 60 m", () => {
    const tower = byId("w66286371")!;
    // The pyramidal helmet w617763432: from 55 m to 60 m over the ground at the tower.
    const helmet = byId("w617763432");
    expect(helmet).toBeDefined();
    expect(helmet!.soffit! - helmet!.plinth).toBeCloseTo(55, 1);
    expect(helmet!.height - helmet!.plinth + (helmet!.roof ?? 0)).toBeCloseTo(60, 1);
    expect(peakAt(all, { x: 590.9, z: -147.6 }) - tower.y).toBeGreaterThanOrEqual(59);
  });

  it("gives Brama Krakowska a two-storey annex, the tower and the octagon with its helmet on top", () => {
    const gate = byId("r7224409")!;
    expect(gate.levels).toBeLessThanOrEqual(2);
    expect(gate.height - gate.plinth).toBeLessThanOrEqual(2 * STOREY + 0.05);
    const tower = byId("w617597407");
    const octagon = byId("w617878341");
    expect(tower).toBeDefined();
    expect(octagon).toBeDefined();
    // The octagon (6 storeys, an onion helmet) stands on the tower (5 storeys), not inside it.
    expect(octagon!.soffit).toBeCloseTo(tower!.height, 1);
    expect(octagon!.height + octagon!.roof!).toBeGreaterThan(tower!.height + (tower!.roof ?? 0) + 2 * STOREY);
    expect(peakAt(all, { x: 477.7, z: -89.2 }) - gate.y - gate.plinth).toBeGreaterThan(6 * STOREY);
  });

  it("gives the Archikatedra its higher nave and the turrets of its facade, the Town Hall its tower, the Dominicans their chapels", () => {
    const cathedral = byId("w66286341")!;
    const nave = byId("w617763433");
    expect(nave?.height).toBeCloseTo(cathedral.plinth + 9 * STOREY, 1);
    for (const turret of ["w617763434", "w617763435"]) expect(byId(turret)?.height).toBeCloseTo(cathedral.plinth + 10 * STOREY, 1);
    expect(peakAt(all, { x: 415.0, z: -79.3 }) - byId("w66264120")!.y).toBeGreaterThan(8 * STOREY);
    for (const chapel of ["w617763428", "w617763429"]) expect(byId(chapel)?.levels).toBe(6);
  });

  it("starts every part on what stands under it, never under the ground", () => {
    const parts = all.filter((b) => b.soffit !== undefined);
    expect(parts.length).toBeGreaterThanOrEqual(10);
    for (const p of parts) expect(p.soffit!).toBeGreaterThan(p.plinth);
    for (const p of parts) expect(p.height - p.soffit!).toBeGreaterThanOrEqual(1);
  });

  it("leaves the museum in Brama Krakowska off Jezuicka 3, whose outline its point falls in (G-051)", () => {
    // n993790419 (Plac Łokietka 3) lies 6 m off the gate (Bramowa 1), inside Jezuicka 3.
    expect(byId("w66286384")?.name).toBeUndefined();
    expect(byId("r7224409")?.name).toBe("Brama Krakowska");
  });
});

describe("the extract keeps building parts", () => {
  const node = (id: number, x: number, z: number) => {
    const g = worldToGeo({ x, z });
    return ` <node id="${id}" lat="${g.lat}" lon="${g.lon}"/>`;
  };
  it("keeps a way tagged building:part and its nodes", () => {
    const xml = [
      "<osm>",
      node(1, 0, 0),
      node(2, 10, 0),
      node(3, 10, 10),
      node(4, 0, 10),
      ' <way id="7"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="building:part" v="yes"/><tag k="height" v="60"/><tag k="min_height" v="55"/></way>',
      "</osm>",
    ].join("\n");
    const d = filterOsm(parseOsmXml(xml));
    expect(d.ways.get(7)?.tags).toMatchObject({ "building:part": "yes", min_height: "55" });
    expect(d.nodes.size).toBe(4);
  });
});
