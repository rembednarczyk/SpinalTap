import { describe, expect, it } from "vitest";
import { type Carriageway } from "../../gugik/src/extracts.ts";
import { WidthReport, bdotMatch, bdotWidth, streetWidth } from "../src/streets/widths.ts";

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

  it("reads how far BDOT10k's line runs left of the axis", () => {
    expect(bdotMatch(axis, [cw("a", 7, [[-5, 1.2], [105, 1.2]])])).toEqual({ width: 7, offset: 1.2 });
    expect(bdotMatch(axis, [cw("a", 7, [[-5, -0.8], [105, -0.8]])])?.offset).toBeCloseTo(-0.8, 6);
  });

  it("orders the sources: the map's width, BDOT10k, the orthophoto, fitted, the estimate", () => {
    const est = () => true;
    expect(streetWidth({ width: "8" }, 3, true, est, 7)).toEqual([{ half: 4, source: "osm" }, { half: 4, source: "osm" }]);
    expect(streetWidth({}, 3, true, est, 7)).toEqual([{ half: 3.5, source: "bdot10k" }, { half: 3.5, source: "bdot10k" }]);
    expect(streetWidth({}, 3, true, est, null)).toEqual([{ half: 3, source: "ortho" }, { half: 3, source: "ortho" }]);
    // BDOT10k 1.4 m off the orthophoto's measure: BDOT10k's all the same (the user's decision of 26.11).
    expect(streetWidth({}, 4.6, true, est, 7.8)).toEqual([{ half: 3.9, source: "bdot10k" }, { half: 3.9, source: "bdot10k" }]);
    // Off an estimate by any amount: BDOT10k's.
    expect(streetWidth({}, 3.25, false, est, 10)).toEqual([{ half: 5, source: "bdot10k" }, { half: 5, source: "bdot10k" }]);
    expect(streetWidth({}, 3, false, (side) => side < 0, null)).toEqual([{ half: 3, source: "fitted" }, { half: 3, source: "default" }]);
  });

  it("reports the length by source and the conflicts over 1 m", () => {
    const r = new WidthReport();
    // w143716181 measured on both sides on the orthophoto: a conflict; w40051033 on one side: the other half is the import's guess, not compared.
    r.add("w143716181", "Narutowicza", axis, streetWidth({}, 3.5, true, () => true, 7), 7, 9.2);
    r.add("w40051033", "Narutowicza", axis, streetWidth({}, 3.5, true, () => true, 7), 7, 9.2);
    r.add("w3", "Kozia", axis, streetWidth({}, 2.5, false, () => true, 5), 5, null);
    r.add("w2", "Kozia", axis, streetWidth({}, 2.5, false, () => true, null), null, null);
    const text = r.toString();
    expect(text).toContain("bdot10k 0.30 km (75.0%)");
    expect(text).toContain("default 0.10 km (25.0%)");
    expect(text).toContain("conflicts over 1 m: 1 (w143716181 Narutowicza: BDOT10k 7 m, orthophoto 9.2 m); against a one-sided measurement, not compared: 1");
  });
});
