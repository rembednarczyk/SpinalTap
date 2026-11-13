import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover, readCover } from "../../orto/src/cover.ts";
import { MAP_REGIONS } from "../../orto/src/region.ts";
import { THRESHOLDS } from "../../orto/src/thresholds.ts";
import { mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { REPO } from "../../osm-import/src/paths.ts";
import { bareOnCover } from "./bare-on-cover";
import { cityLanduseWorld, landuseBare } from "./landuse-bare";

/**
 * ADR-0077 step 1.1: the import lays the bare ground the orthophoto shows green or light paving as
 * a lawn or paving (`tools/osm-import/src/bare-cover.ts`), everywhere in a town's paved places.
 * Before the rule `landuse-bare` counted 39 094 such samples (12.11.2026: 9 775 m², 2 015 of them
 * green, 7 760 paving); the rule leaves some 5 930, by the kerbs, the bridges and the outlines' edges.
 */
const MAX_LEFT = 10_000;

describe("bare ground in a town's paved places the orthophoto shows green or paving (bare-on-cover)", () => {
  it("names a bare sample on green or paving and leaves one on asphalt or off the raster", () => {
    const cls = new Uint8Array(4).fill(COVER.green);
    cls[1] = COVER.paving;
    cls[2] = COVER.asphalt;
    const cover: Cover = { header: { district: "t", x0: 0, z1: 1, step: 0.5, width: 2, height: 2, classes: [], source: "", tiles: [], thresholds: THRESHOLDS }, cls };
    const found = bareOnCover(
      [
        { at: "0,1", what: "bare 0.25,0.75" },
        { at: "1,1", what: "bare 0.75,0.75" },
        { at: "0,0", what: "bare 0.25,0.25" },
        { at: "5,5", what: "bare 5.25,5.25" },
      ],
      [cover],
    );
    expect(found.map((f) => f.what)).toEqual(["bare 0.25,0.75 green", "bare 0.75,0.75 paving"]);
  });

  it("leaves under 10 000 of them in the city", () => {
    const dir = join(REPO, "data/osm");
    const osm = mergeOsm(
      readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => parseExtract(readFileSync(join(dir, f), "utf8"))),
    );
    const covers = MAP_REGIONS.map((r) => readCover(r.slug)).filter((c) => c !== undefined);
    expect(bareOnCover(landuseBare(cityLanduseWorld(osm)), covers).length).toBeLessThan(MAX_LEFT);
  });
});
