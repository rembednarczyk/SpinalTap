import { describe, expect, it } from "vitest";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover, readCover } from "../../orto/src/cover.ts";
import { MAP_REGIONS } from "../../orto/src/region.ts";
import { THRESHOLDS } from "../../orto/src/thresholds.ts";
import { generatedCity } from "../../osm-import/test/city.ts";
import { fillOnGreen, pavingClasses } from "./fill-on-green";

/**
 * The control numbers of the bare ground rule (ADR-0077 steps 1.1 and 1.2) from the curator's
 * review of #483 (T-285): paving laid on the orthophoto's green (13.11: 90 m², the gate 150 m²)
 * and paving laid over the crowns, a guess from the cells round them (13.11: 7% of it, 17% in
 * podzamcze-0-0), which a cell keeps under 5% of its laid paving.
 */
const MAX_ON_GREEN_M2 = 150;
const MAX_UNDER_CROWNS = 0.05;
const SAMPLE_M2 = 0.25;

/** A 2 m square's cover: green west of x = 1, paving east of it. */
const COVER_2M: Cover = {
  header: { district: "t", x0: 0, z1: 2, step: 0.5, width: 4, height: 4, classes: [], source: "", tiles: [], thresholds: THRESHOLDS },
  cls: Uint8Array.from({ length: 16 }, (_, k) => (k % 4 < 2 ? COVER.green : k === 15 ? COVER.canopy : COVER.paving)),
};
const square = (x0: number, z0: number, x1: number, z1: number) => [x0, z0, x1, z0, x1, z1, x0, z1];

describe("paving the bare ground rule lays on the orthophoto's green (fill-on-green)", () => {
  it("names each green sample under laid paving, and none under a lawn or off the raster", () => {
    const found = fillOnGreen(
      [{ id: "c", fills: [{ surface: "square", outline: square(0, 0, 1, 0.5) }, { surface: "grass", outline: square(0, 1, 1, 2) }, { surface: "square", outline: square(5, 5, 6, 6) }] }],
      [COVER_2M],
    );
    expect(found.map((f) => f.what)).toEqual(["c: paving on green 0.25,0.25", "c: paving on green 0.75,0.25"]);
    const classes = pavingClasses([{ id: "c", fills: [{ surface: "square", outline: square(1, 0, 2, 1) }] }], [COVER_2M]).get("c")!;
    expect([classes.paving, classes.canopy, classes.green]).toEqual([3, 1, 0]);
  });

  describe("over the city", () => {
    const chunks = generatedCity().stats;
    const covers = MAP_REGIONS.map((r) => readCover(r.slug)).filter((c) => c !== undefined);

    it(`lays under ${MAX_ON_GREEN_M2} m² of it`, () => {
      expect(fillOnGreen(chunks, covers).length * SAMPLE_M2).toBeLessThan(MAX_ON_GREEN_M2);
    });

    it(`lays under ${MAX_UNDER_CROWNS * 100}% of a cell's paving over the crowns`, () => {
      for (const [id, c] of pavingClasses(chunks, covers)) {
        const all = Object.values(c).reduce((a, b) => a + b, 0);
        expect(all ? c.canopy / all : 0, id).toBeLessThan(MAX_UNDER_CROWNS);
      }
    });
  });
});
