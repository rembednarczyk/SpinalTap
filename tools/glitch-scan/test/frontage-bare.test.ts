import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutReplaced } from "../../osm-import/src/corrections-alchemia.ts";
import { correctedLine } from "../../osm-import/src/corrections.ts";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { REPO } from "../../osm-import/src/paths.ts";
import { type FrontageWorld, MIN_BARE, cityFrontageWorld, frontageBare, squaresOf } from "./frontage-bare";
import { cityLanduseWorld } from "./landuse-bare";

const box = (x0: number, z0: number, x1: number, z1: number) => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];
const area = (found: readonly { at: string }[]) => found.length * 0.25;

/** A pedestrian street along x at z = 5 (20 m), its setts 4 m wide, tenements 7 m off its axis to the north. */
const STREET: FrontageWorld = {
  walked: [[{ x: 0, z: 5 }, { x: 20, z: 5 }]],
  residential: [],
  oldTown: () => false,
  buildings: [box(0, 12, 20, 20)],
  ground: [box(0, 3, 20, 7)],
  green: [],
  chunks: [{ minX: 0, maxX: 20, minZ: -10, maxZ: 20 }],
};

describe("bare terrain before a pedestrian street's walls (frontage-bare, G-855)", () => {
  it("finds the strip between the setts and the walls and the ground within 8 m south, a 10 m square at a time", () => {
    const found = frontageBare(STREET);
    // North: 20 by 5 m to the walls; south: 20 by 6 m (z -3 to 3), the rest past 8 m.
    expect(area(found)).toBeCloseTo(20 * 5 + 20 * 6, 0);
    expect(new Set(squaresOf(found))).toEqual(new Set(["0,0", "10,0", "0,10", "10,10", "0,-10", "10,-10"]));
  });

  it("leaves paved ground, lawns, a square another kind has and one under 2 m² bare", () => {
    expect(frontageBare({ ...STREET, ground: [box(0, -10, 20, 12)] })).toEqual([]);
    expect(frontageBare({ ...STREET, ground: [box(0, -10, 20, 7)], green: [box(0, 7, 20, 12)] })).toEqual([]);
    // A building site of the map is bare as anywhere (G-866).
    expect(frontageBare({ ...STREET, ground: [box(0, -10, 20, 7)], sites: [box(0, 7, 20, 12)] })).toEqual([]);
    const taken = frontageBare({ ...STREET, taken: new Set(["0,10", "0,0", "0,-10"]) });
    expect([...squaresOf(taken)].sort()).toEqual(["10,-10", "10,0", "10,10"]);
    // A strip 0.5 m wide and 3 m long: 1.5 m², under the least that counts; 5 m long counts.
    expect(3 * 0.5).toBeLessThan(MIN_BARE);
    expect(frontageBare({ ...STREET, ground: [box(0, -10, 20, 11.5), box(3, 11.5, 20, 12)] })).toEqual([]);
    expect(area(frontageBare({ ...STREET, ground: [box(0, -10, 20, 11.5), box(5, 11.5, 20, 12)] }))).toBeCloseTo(5 * 0.5, 1);
  });

  it("counts a residential street only inside the Old Town's walls, 6 m off its axis", () => {
    const lane: FrontageWorld = { ...STREET, walked: [], residential: STREET.walked };
    expect(frontageBare(lane)).toEqual([]);
    // 4 m each side past the setts (z -1 to 3 and 7 to 11), short of the walls at 12.
    expect(area(frontageBare({ ...lane, oldTown: () => true }))).toBeCloseTo(20 * 4 + 20 * 4, 0);
  });

  it("finds no strip of 2 m² before the walls of Krakowskie Przedmieście nor at the Old Town's hot spots of G-853 and G-854", () => {
    const dir = join(REPO, "data/osm");
    const osm = mergeOsm(
      readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => parseExtract(readFileSync(join(dir, f), "utf8"))),
    );
    // Without the other kinds' squares: the strips the hunt measured, whichever kind has a square of them.
    const found = squaresOf(frontageBare(cityFrontageWorld(withoutReplaced(extractFeatures(osm)).lines.map((l) => correctedLine(l)), cityLanduseWorld(osm), new Set())));
    const spots = [
      [222.5, -70.6],
      [291.0, -69.9],
      [364.6, -86.0],
      [503.0, -69.3],
      [663.5, -38.0],
      [664.8, -119.4],
    ] as const;
    // A spot is the middle of a strip measured within 10 m of the axes: the squares round it, too.
    const near = ([x, z]: readonly [number, number]) =>
      [-10, 0, 10].flatMap((dx) => [-10, 0, 10].map((dz) => `${Math.floor((x + dx) / 10) * 10},${Math.floor((z + dz) / 10) * 10}`)).filter((k) => found.has(k));
    expect(spots.map((s) => ({ spot: s, squares: near(s) })).filter((s) => s.squares.length > 0)).toEqual([]);
  });
});
