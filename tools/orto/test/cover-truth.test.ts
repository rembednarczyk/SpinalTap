import { describe, expect, it } from "vitest";
import { agreement } from "../src/agreement.ts";
import { cellById } from "../src/config.ts";
import { readCover } from "../src/cover.ts";
import { loadOsm, truthAreas } from "../src/truth.ts";

/**
 * The cover against the truth in `krakowskie-0-1` (ADR-0077), offline on the committed raster:
 * the lawns and setts the curator laid from the orthophoto (T-243, T-245) and the map's lawns,
 * parks and squares. Measured with the thresholds of `thresholds.ts` (11.11.2026): lawns 91.1%
 * green, paved areas 91.0% hard surface (light paving or asphalt), shadow under 1%.
 */
const cell = cellById("krakowskie-0-1");
const cover = readCover("krakowskie");
const areas = truthAreas(loadOsm(), cell.rect);

describe("the orthophoto cover agrees with the truth in krakowskie-0-1", () => {
  it("has the cell's raster committed", () => {
    expect(cover?.header.tiles.filter((t) => t.cell === cell.id).length).toBeGreaterThanOrEqual(3);
  });

  it("finds green on at least 90% of the lawns", () => {
    const a = agreement(cover!, areas, "lawn", cell.rect);
    expect(a.samples).toBeGreaterThan(10_000);
    expect(a.share, JSON.stringify(a.counts)).toBeGreaterThanOrEqual(0.9);
    expect(a.shadow).toBeLessThan(0.05);
  });

  it("finds a hard surface on at least 90% of the setts and squares", () => {
    const a = agreement(cover!, areas, "paving", cell.rect);
    expect(a.samples).toBeGreaterThan(10_000);
    expect(a.share, JSON.stringify(a.counts)).toBeGreaterThanOrEqual(0.9);
    expect(a.shadow).toBeLessThan(0.05);
  });

  it("agrees with the curator's own areas as well", () => {
    const curated = areas.filter((a) => a.from === "curator");
    expect(agreement(cover!, curated, "paving", cell.rect).share).toBeGreaterThanOrEqual(0.9);
    // Their lawns are 59% green: beds and shrubs under trees, with paving between (measured 11.11.2026).
    expect(agreement(cover!, curated, "lawn", cell.rect).share).toBeGreaterThanOrEqual(0.55);
  });
});
