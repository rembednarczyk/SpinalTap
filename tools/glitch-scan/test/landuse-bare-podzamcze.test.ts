import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { cityLanduseWorld, landuseBare } from "./landuse-bare";

/**
 * G-536 and G-540: bare terrain (`landuse-bare`) on the shops' land of Podzamcze, round Nadstawna
 * 1-4 and the stops by Szkolna (`podzamcze-1-1`), and between Lubartowska and the Bazar, on the
 * dairy cooperative's yard, by the kiosks and along Ruska (`podzamcze-0-1`), counted by the scan's
 * own check on the city's data. The clusters are the map steward's, by the 0.5 m samples left in each.
 */

const OSM_DIR = join(__dirname, "../../../data/osm");
const osm = mergeOsm(
  readdirSync(OSM_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parseExtract(readFileSync(join(OSM_DIR, f), "utf8"))),
);
type Box = readonly [minX: number, maxX: number, minZ: number, maxZ: number];
const inBox = ([x, z]: readonly number[], [x0, x1, z0, z1]: Box) => x! > x0 && x! < x1 && z! > z0 && z! < z1;
const bare = landuseBare(cityLanduseWorld(osm)).map((f) => f.what.slice("bare ".length).split(",").map(Number));
const inCell = (id: string) => {
  const c = MAP_CHUNKS.find((k) => k.id === id)!.bounds;
  return bare.filter((p) => inBox(p, [c.minX, c.maxX, c.minZ, c.maxZ]));
};

describe("bare terrain on the shops' land of Podzamcze (G-536, G-540)", () => {
  // OSM maps no surface there; the orthophoto shows setts, car parks and lawns (T-246). What is left
  // are the 0.4 m strips the added areas keep off the map's squares, lawns and steps (G-320, G-421):
  // along the Nowy Plac Targowy, the Targ na Ruskiej and the beds by the dairy and the stops.
  it.each<[string, Box, number]>([
    ["the forecourt and yards of Nadstawna 4", [747, 800, 446, 490], 10],
    ["the strip west of Nadstawna 4", [735, 750, 452, 511], 0],
    ["the yard south of Nadstawna 4's car parks", [742, 769, 513, 536], 2],
    ["the strip by the car park south of Nadstawna 4", [769, 808, 501, 526], 4],
    ["the strips round Nadstawna 1 and 3", [807, 841, 450, 490], 2],
    ["the stops by Szkolna", [848, 878, 487, 526], 27],
    ["the block between Lubartowska and the Bazar", [606, 662, 386, 461], 53],
    ["the dairy cooperative's yard", [520, 530, 417, 474], 31],
    ["the kiosks by the car park w227679484", [636, 650, 559, 580], 2],
    ["the shops by Ruska", [676, 715, 566, 580], 41],
  ])("leaves at most a sliver of %s bare", (_, box, most) => {
    const left = bare.filter((p) => inBox(p, box));
    expect(left.length, left.slice(0, 12).join(" ")).toBeLessThanOrEqual(most);
  });

  // 8 021 and 6 972 samples (about 2 005 and 1 743 m²) before the added areas; 188 and 222 after.
  it("leaves at most a tenth of podzamcze-1-1's 8 021 samples bare", () => {
    expect(inCell("podzamcze-1-1").length).toBeLessThanOrEqual(802);
  });

  it("leaves at most a tenth of podzamcze-0-1's 6 972 samples bare", () => {
    expect(inCell("podzamcze-0-1").length).toBeLessThanOrEqual(697);
  });
});
