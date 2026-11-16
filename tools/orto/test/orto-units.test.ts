import { describe, expect, it } from "vitest";
import { worldToPuwg } from "../../osm-import/src/project.ts";
import { COVER, classify } from "../src/classify.ts";
import { type Cover, coverAt, emptyCover } from "../src/cover.ts";
import { decodeIndexed, decodeRgb, encodeIndexed4 } from "../src/png.ts";
import { bboxRegion, rectOf2180, regionsOf } from "../src/region.ts";
import { countIn, samplesIn } from "../src/rings.ts";
import { parseSheets, sheetOf } from "../src/sheets.ts";
import { THRESHOLDS } from "../src/thresholds.ts";

const square = (x0: number, z0: number, x1: number, z1: number) => [
  { x: x0, z: z0 },
  { x: x1, z: z0 },
  { x: x1, z: z1 },
  { x: x0, z: z1 },
];

describe("the orthophoto tool's parts", () => {
  it("writes and reads a 4-bit cover PNG unchanged, and reads it as RGB", () => {
    const index = Uint8Array.from({ length: 7 * 3 }, (_, i) => i % 6);
    const palette = [
      [0, 0, 0],
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10, 11, 12],
      [13, 14, 15],
    ] as const;
    const png = encodeIndexed4({ width: 7, height: 3, index, palette });
    const back = decodeIndexed(png);
    expect([back.width, back.height]).toEqual([7, 3]);
    expect([...back.index]).toEqual([...index]);
    expect([...decodeRgb(png).rgb.subarray(3, 6)]).toEqual([1, 2, 3]);
  });

  it("tells a lawn, paving, asphalt and shadow apart over the flights", () => {
    expect(classify([[95, 100, 80], [60, 95, 45], [70, 105, 50]])).toBe(COVER.green);
    expect(classify([[170, 165, 155], [160, 158, 150], [165, 160, 150]])).toBe(COVER.paving);
    expect(classify([[90, 92, 95], [80, 82, 85], [85, 86, 90]])).toBe(COVER.asphalt);
    expect(classify([[30, 32, 40], [35, 40, 38], [30, 35, 33]])).toBe(COVER.shadow);
    expect(classify([[200, 60, 40], [190, 60, 40], [195, 60, 45]])).toBe(COVER.unknown);
    expect(classify([])).toBe(COVER.none);
  });

  it("tells green under crowns, grey on the leaf-off flight, from green on the ground (G-672)", () => {
    expect(classify([[100, 102, 98], [50, 110, 40], [55, 115, 45]])).toBe(COVER.canopy);
    expect(classify([[110, 118, 95], [50, 110, 40], [55, 115, 45]])).toBe(COVER.green);
  });

  it("tells paving under crowns, light and grey on the leaf-off flight, from a lawn or soil under them (G-764)", () => {
    expect(classify([[150, 150, 145], [50, 110, 40], [55, 115, 45]])).toBe(COVER.canopyHard);
    // Darker than light paving, or brown: a lawn not yet green, soil, a shrub's bare twigs.
    expect(classify([[105, 106, 100], [50, 110, 40], [55, 115, 45]])).toBe(COVER.canopy);
    expect(classify([[150, 135, 115], [50, 110, 40], [55, 115, 45]])).toBe(COVER.canopy);
  });

  it("takes no lawn from a leaf-off green no lawn has: patina, beige setts in a summer shade (G-775)", () => {
    // Measured with one summer flight (G-771): the monument's patina on Królewska over 2024-06's setts, the corner of Lubartowska in 2023-09's shade.
    expect(classify([[109, 130, 126], [155, 153, 149]])).toBe(COVER.paving);
    // Its shaded side is dark in April, but the setts under it are light in June: paving, not asphalt.
    expect(classify([[88, 108, 109], [156, 153, 148]])).toBe(COVER.paving);
    expect(classify([[199, 188, 157], [57, 72, 79]])).toBe(COVER.canopyHard);
    // A green tarp the summer flight shows grey: a coloured surface, not a lawn.
    expect(classify([[40, 140, 110], [150, 150, 150]])).toBe(COVER.unknown);
    // Lawns: fresh and teal in April and green in June, green in April in a summer shade; a tree in blossom.
    expect(classify([[100, 133, 129], [103, 115, 97]])).toBe(COVER.green);
    expect(classify([[93, 114, 77], [41, 51, 60]])).toBe(COVER.green);
    expect(classify([[195, 194, 173], [66, 88, 85]])).toBe(COVER.green);
  });

  it("counts the samples of a ring, optionally away from its edges", () => {
    const c: Cover = emptyCover("t", { minX: 0, minZ: 0, maxX: 10, maxZ: 10 }, THRESHOLDS);
    c.cls.fill(COVER.green);
    expect(samplesIn(c.header, square(2, 2, 6, 6)).length).toBe(64);
    expect(samplesIn(c.header, square(2, 2, 6, 6), 1).length).toBe(16);
    expect(countIn(c, square(0, 0, 1, 1)).green).toBe(4);
    expect(coverAt(c, 9.9, 0.1)).toBe(COVER.green);
    expect(coverAt(c, 10.1, 5)).toBe(COVER.none);
  });

  it("reads the sheet index and picks the flight's sheet", () => {
    const html = `<script>var skorDo5cm = []; skorDo5cm.push({url:"x",godlo:"M-34-34-A-c-1-2", aktualnosc:"2024-06-21", wielkoscPiksela:"0.25", kolor:"CIR"}); skorDo5cm.push({url:"y",godlo:"M-34-34-A-c-1-2", aktualnosc:"2024-06-21", wielkoscPiksela:"0.25", kolor:"RGB"}); skorDo5cm.push({godlo:"M-34-34-A-c-1-2", aktualnosc:"2023-09-11", wielkoscPiksela:"0.05", kolor:"RGB"});</script>`;
    const sheets = parseSheets(html);
    expect(sheets.length).toBe(3);
    expect(sheetOf(sheets, "2024-06")).toEqual({ sheet: "M-34-34-A-c-1-2", date: "2024-06-21", pixel: 0.25, colour: "RGB" });
    expect(sheetOf(sheets)?.date).toBe("2023-09-11");
  });

  it("takes any rectangle, in world metres or in the PUWG 1992 grid", () => {
    const r = bboxRegion("lublin-n", { minX: 0, minZ: 0, maxX: 600, maxZ: 300 });
    expect(r.cells.map((c) => c.id)).toEqual(["lublin-n-0-0", "lublin-n-1-0", "lublin-n-2-0", "lublin-n-0-1", "lublin-n-1-1", "lublin-n-2-1"]);
    const [a, b] = [worldToPuwg({ x: 100, z: 50 }), worldToPuwg({ x: 300, z: 250 })];
    const back = rectOf2180(Math.min(a.e, b.e), Math.min(a.n, b.n), Math.max(a.e, b.e), Math.max(a.n, b.n));
    expect(back.minX).toBeLessThan(100);
    expect(back.minX).toBeGreaterThan(80);
    expect(back.maxZ).toBeGreaterThan(250);
    expect(back.maxZ).toBeLessThan(270);
    expect(regionsOf(["--bbox", "0,0,100,100", "--name", "proba"])[0]!.cells.length).toBe(1);
    expect(regionsOf(["--cell", "krakowskie-0-1"])[0]!.cells.map((c) => c.id)).toEqual(["krakowskie-0-1"]);
    expect(() => regionsOf(["--bbox", "0,0,100", "--name", "x"])).toThrow();
  });
});
