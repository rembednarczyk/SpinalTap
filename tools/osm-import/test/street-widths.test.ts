import { describe, expect, it } from "vitest";
import { type Carriageway } from "../../gugik/src/extracts.ts";
import { WidthReport, bdotWidth, streetWidth } from "../src/streets/widths.ts";

/** ADR-0104 pkt 4: the carriageway's width by the order of the sources, BDOT10k's matched to the axis. */

const cw = (id: string, width: number | null, line: [number, number][]): Carriageway => ({ id, width, roadClass: "droga lokalna", line: line.map(([x, z]) => ({ x, z })) });
const axis = [{ x: 0, z: 0 }, { x: 100, z: 0 }];

describe("the carriageway's width from its sources (ADR-0104 pkt 4)", () => {
  it("takes BDOT10k's width from the carriageway running along the axis, not one crossing it or one far off", () => {
    expect(bdotWidth(axis, [cw("a", 7, [[-5, 1], [105, 1]])])).toBe(7);
    // Crossing at right angles: no match.
    expect(bdotWidth(axis, [cw("b", 12, [[50, -50], [50, 50]])])).toBeNull();
    // 5 m off the axis: another street's.
    expect(bdotWidth(axis, [cw("c", 9, [[-5, 5], [105, 5]])])).toBeNull();
    // Along under half the axis: no match.
    expect(bdotWidth(axis, [cw("d", 6, [[0, 0.5], [40, 0.5]])])).toBeNull();
    // Two stretches of different widths: the median of the samples.
    expect(bdotWidth(axis, [cw("e", 6, [[0, 0], [70, 0]]), cw("f", 10, [[70, 0], [100, 0]])])).toBe(6);
    // A carriageway BDOT10k gives no width is no source.
    expect(bdotWidth(axis, [cw("g", null, [[-5, 1], [105, 1]])])).toBeNull();
  });

  it("orders the sources: the map's width, BDOT10k, the orthophoto, fitted, the estimate", () => {
    const est = () => true;
    expect(streetWidth({ width: "8" }, 3, true, est, 7)).toEqual([{ half: 4, source: "osm" }, { half: 4, source: "osm" }]);
    expect(streetWidth({}, 3, true, est, 7)).toEqual([{ half: 3.5, source: "bdot10k" }, { half: 3.5, source: "bdot10k" }]);
    expect(streetWidth({}, 3, true, est, null)).toEqual([{ half: 3, source: "ortho" }, { half: 3, source: "ortho" }]);
    // BDOT10k 1.4 m off the orthophoto's measure: disputed, the measure the street has stays until the review.
    expect(streetWidth({}, 4.6, true, est, 7.8)).toEqual([{ half: 4.6, source: "ortho" }, { half: 4.6, source: "ortho" }]);
    // Off an estimate by any amount: BDOT10k's.
    expect(streetWidth({}, 3.25, false, est, 10)).toEqual([{ half: 5, source: "bdot10k" }, { half: 5, source: "bdot10k" }]);
    expect(streetWidth({}, 3, false, (side) => side < 0, null)).toEqual([{ half: 3, source: "fitted" }, { half: 3, source: "default" }]);
  });

  it("reports the length by source and the conflicts over 1 m", () => {
    const r = new WidthReport();
    r.add("w1", "Narutowicza", axis, streetWidth({}, 4.6, true, () => true, 7), 4.6, 7, true);
    r.add("w3", "Kozia", axis, streetWidth({}, 2.25, false, () => true, 5), 2.25, 5, false);
    r.add("w2", "Kozia", axis, streetWidth({}, 2.5, false, () => true, null), 2.5, null, false);
    const text = r.toString();
    expect(text).toContain("bdot10k 0.10 km (33.3%)");
    expect(text).toContain("ortho 0.10 km (33.3%)");
    expect(text).toContain("default 0.10 km (33.3%)");
    expect(text).toContain("conflicts over 1 m: 1 (w1 Narutowicza: BDOT10k 7 m, orthophoto 9.2 m)");
  });
});
