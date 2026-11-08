import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { cityLanduseWorld, landuseBare } from "./landuse-bare";

/**
 * G-521: bare terrain (`landuse-bare`) in the yards of the blocks of the cell `krakowskie-0-1`
 * (Krakowskie Przedmieście's north side between Żołnierzy Niepodległej, 3 Maja and Radziwiłłowska),
 * counted by the scan's own check on the city's data. The clusters are the map steward's, by the
 * 0.5 m samples left in each.
 */

const OSM_DIR = join(__dirname, "../../../data/osm");
const osm = mergeOsm(
  readdirSync(OSM_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parseExtract(readFileSync(join(OSM_DIR, f), "utf8"))),
);
const cell = MAP_CHUNKS.find((c) => c.id === "krakowskie-0-1")!.bounds;
type Box = readonly [minX: number, maxX: number, minZ: number, maxZ: number];
const inBox = ([x, z]: readonly number[], [x0, x1, z0, z1]: Box) => x! > x0 && x! < x1 && z! > z0 && z! < z1;
const bare = landuseBare(cityLanduseWorld(osm))
  .map((f) => f.what.slice("bare ".length).split(",").map(Number))
  .filter((p) => inBox(p, [cell.minX, cell.maxX, cell.minZ, cell.maxZ]));

describe("bare terrain in the yards of krakowskie-0-1 (G-521)", () => {
  // The yards, the strips along the walls and the pavements had no surface: OSM maps none there (T-245).
  it.each<[string, Box, number]>([
    ["the block of Litevski, Żołnierzy Niepodległej 2 and 3 Maja 2", [-200, -118, -5, 49], 0],
    ["the yard of Żołnierzy Niepodległej 3 and the school", [-198, -165, 92, 124], 0],
    ["the courtyard of 3 Maja 6", [-163, -135, 73, 92], 0],
    ["the pavement of Żołnierzy Niepodległej before Żołnierzy Niepodległej 1 and 3 Maja 6", [-170, -113, 53, 62], 0],
    ["the pavement of 3 Maja before 3 Maja 6 and 8", [-122, -113, 53, 102], 0],
    ["the sidewalk at the bus stop on 3 Maja's east side", [-106, -101.5, -16, 23], 0],
    ["the yard north of the Collegium", [-28, -5, 143, 158.5], 0],
    ["the Collegium's east yard", [6, 20, 139, 152], 0],
    ["the Collegium's south and west", [-35, 20, 122, 138], 0],
    ["the lawn and the forecourt north of the clinic", [-90, -60, 147, 153], 0],
  ])("leaves at most a sliver of %s bare", (_, box, most) => {
    const left = bare.filter((p) => inBox(p, box));
    expect(left.length, left.slice(0, 12).join(" ")).toBeLessThanOrEqual(most);
  });

  it("leaves at most 136 of the cell's 10 004 samples bare", () => {
    // 10 004 samples (about 2 500 m²) before the yards and the pavements were paved; what is left is
    // the light well of 3 Maja 8, the strip between the clinic's east wall and its car park and
    // slivers along shared edges.
    expect(bare.length).toBeLessThanOrEqual(136);
  });
});
