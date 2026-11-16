import { describe, expect, it } from "vitest";
import type { Structure } from "../../osm-import/src/structures.ts";
import { fillOnConstruction } from "./fill-construction";

const box = (minX: number, minZ: number, maxX: number, maxZ: number) => [minX, minZ, maxX, minZ, maxX, maxZ, minX, maxZ];
const site = (id: string, kind: Structure["kind"], minX: number, minZ: number, maxX: number, maxZ: number, holes: Structure["holes"] = []): Structure => ({
  id,
  kind,
  ring: [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ },
  ],
  holes,
  box: { minX, minZ, maxX, maxZ },
});

/** The glitch scan's check `fill-on-construction` (G-866). */
describe("fill-on-construction", () => {
  it("counts the samples of a frontage's pieces in a building site, out of its holes, once each", () => {
    const sites = [site("w1", "construction", 0, 0, 2, 2, [[{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }, { x: 0, z: 1 }]]), site("w2", "building", 10, 0, 12, 2)];
    const ground = [
      { surface: "square" as const, outline: box(0, 0, 4, 2), front: true as const },
      { surface: "grass" as const, outline: box(0, 0, 4, 2), front: true as const },
      { surface: "square" as const, outline: box(0, 0, 2, 2) },
      { surface: "square" as const, outline: box(10, 0, 12, 2), front: true as const },
    ];
    const found = fillOnConstruction(sites, [{ id: "c", ground }]);
    // 16 samples of the 2 m site, less the 4 of its hole; a building is no site, a piece off the frontages none.
    expect(found).toHaveLength(12);
    expect(new Set(found.map((f) => f.at)).size).toBe(12);
    expect(found[0]!.what).toContain("building site w1");
    // A piece cut on the site's outline: its samples on the outline are none.
    const edge = [site("w3", "construction", 0.249, 0, 2, 2), site("w4", "construction", 0.15, 3, 2, 5)];
    expect(fillOnConstruction(edge, [{ id: "c", ground: [{ surface: "square" as const, outline: box(0, 0, 0.5, 2), front: true as const }, { surface: "square" as const, outline: box(0, 3, 0.5, 5), front: true as const }] }]).map((f) => f.what)).toEqual(Array(4).fill("c: square of a frontage on building site w4"));
  });
});
