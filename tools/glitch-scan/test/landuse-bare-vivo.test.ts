import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { cityLanduseWorld, landuseBare } from "./landuse-bare";

/**
 * G-664: a lawn the map lays above the ground (`layer` > 0 or on a roof, VIVO's r11978659 at
 * `layer=4`) is not the ground's, so a point in its outline alone is not left out of
 * `landuse-bare`. The bare strip north of VIVO (G-661, about 55 m² at x 1101–1120,
 * z 239.7–244.4) lies under that lawn's outline and was hidden from the scan.
 */

const OSM_DIR = join(__dirname, "../../../data/osm");
const osm = mergeOsm(
  readdirSync(OSM_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parseExtract(readFileSync(join(OSM_DIR, f), "utf8"))),
);
const world = cityLanduseWorld(osm);
const strip = landuseBare(world)
  .map((f) => f.what.slice("bare ".length).split(",").map(Number))
  .filter(([x, z]) => x! > 1101 && x! < 1120 && z! > 239.7 && z! < 244.4);

describe("a raised lawn does not hide bare ground from landuse-bare (G-664)", () => {
  it("counts the bare strip north of VIVO under its roof's lawn", () => {
    // About 55 m² bare (G-661): 4 samples a square metre.
    expect(strip.length).toBeGreaterThanOrEqual(150);
  });
});
