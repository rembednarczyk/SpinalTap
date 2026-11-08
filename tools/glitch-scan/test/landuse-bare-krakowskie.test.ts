import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { cityLanduseWorld, landuseBare } from "./landuse-bare";

/**
 * G-513: bare terrain (`landuse-bare`) in the yards and by the walls of the public and commercial
 * buildings of the cell `krakowskie-0-0` (Krakowskie Przedmieście between Plac Litewski, Peowiaków
 * and the Centrum Kultury), counted by the scan's own check on the city's data. The clusters are the
 * map steward's, by the 0.5 m samples left in each.
 */

const OSM_DIR = join(__dirname, "../../../data/osm");
const osm = mergeOsm(
  readdirSync(OSM_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parseExtract(readFileSync(join(OSM_DIR, f), "utf8"))),
);
const cell = MAP_CHUNKS.find((c) => c.id === "krakowskie-0-0")!.bounds;
type Box = readonly [minX: number, maxX: number, minZ: number, maxZ: number];
const inBox = ([x, z]: readonly number[], [x0, x1, z0, z1]: Box) => x! > x0 && x! < x1 && z! > z0 && z! < z1;
const bare = landuseBare(cityLanduseWorld(osm))
  .map((f) => f.what.slice("bare ".length).split(",").map(Number))
  .filter((p) => inBox(p, [cell.minX, cell.maxX, cell.minZ, cell.maxZ]));

describe("bare terrain by the public and commercial buildings of krakowskie-0-0 (G-513)", () => {
  // The yards and the strips along the walls had no surface: OSM maps none there (T-243).
  it.each<[string, Box, number]>([
    ["the yard behind KP 50", [-54, -13.5, -94.5, -84], 0],
    ["the yard of KP 39", [-176.5, -161.5, -32.5, -20], 0],
    ["the Grand Hotel Lublinianka's frontage and east wall", [-155.5, -106.5, -101, -71.5], 0],
    ["the yard west of the Sąd Okręgowy", [-16.5, -2, -128, -99], 0],
    ["the Centrum Kultury's west wing", [-189.5, -149.5, -220, -188.5], 2],
    ["south and west of the Centrum Kultury", [-188.5, -126.5, -270, -220], 9],
  ])("leaves at most a sliver of %s bare", (_, box, most) => {
    const left = bare.filter((p) => inBox(p, box));
    expect(left.length, left.slice(0, 12).join(" ")).toBeLessThanOrEqual(most);
  });

  it("leaves at most 155 of the cell's 10 075 samples bare", () => {
    // 10 075 samples (about 2 500 m²) before the yards and the strips were paved; what is left is
    // the bed in the ring path south of the Centrum Kultury, kerb gaps and slivers along edges.
    expect(bare.length).toBeLessThanOrEqual(155);
  });
});
