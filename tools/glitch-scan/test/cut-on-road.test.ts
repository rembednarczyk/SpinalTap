import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { cutOnRoad, cutOnRoadInGame, gameFootprints } from "./cut-on-road";
import { isStreet } from "./pad-on-road";

const square = (name: string, x0: number, x1: number, z0: number, z1: number) => ({
  name,
  ring: [
    { x: x0, z: z0 },
    { x: x1, z: z0 },
    { x: x1, z: z1 },
    { x: x0, z: z1 },
  ],
});
const way = (id: string, pts: readonly [number, number][], highway = "service") => ({ id, osmId: Number(id.slice(1)), tags: { highway }, line: pts.map(([x, z]) => ({ x, z })) });

describe("cut-on-road (G-500, ADR-0074 stage 7)", () => {
  it("finds a cut or a solid of the game's on a street's axis, with the length it covers", () => {
    const input = { footprints: [square("trench", 0, 4, 0, 10)], ways: [way("w1", [[2, -5], [2, 15]]), way("w2", [[6, -5], [6, 15]])], replaced: [] };
    expect(cutOnRoad(input)).toEqual([{ at: "2,0", what: "trench on w1 (service) over 10.0 m" }]);
  });

  it("passes a way the import replaces with its register's row, and only with it", () => {
    const base = { footprints: [square("trench", 0, 4, 0, 10)], ways: [way("w1", [[2, -5], [2, 15]])] };
    expect(cutOnRoad({ ...base, replaced: [{ id: "w1", by: "plac", reason: "plac zamiast parkingu", ref: "T-239" }] })).toEqual([]);
    expect(cutOnRoad({ ...base, replaced: [{ id: "w1", by: "plac", reason: "plac zamiast parkingu", ref: "" }] })).toHaveLength(1);
  });

  const OSM_DIR = join(__dirname, "../../../data/osm");
  const ways = extractFeatures(mergeOsm(readdirSync(OSM_DIR).filter((f) => f.endsWith(".json")).map((f) => parseExtract(readFileSync(join(OSM_DIR, f), "utf8"))))).lines.filter((l) => isStreet(l.tags));

  it("reads Alchemia's cuts and its solids over the ground, not P-1's under it", () => {
    const names = gameFootprints().map((f) => f.name);
    expect(names.filter((n) => n.includes(" cut ")).length).toBeGreaterThanOrEqual(4);
    expect(names.some((n) => n.includes(" solid "))).toBe(true);
  });

  it("finds P-1's ramp trench, its stair core's shaft and stair house on the car park's aisle w177513189 (G-500)", () => {
    const found = cutOnRoadInGame(ways).map((f) => f.what);
    expect(found).toHaveLength(3);
    for (const f of found) expect(f).toContain("on w177513189");
  });
});
