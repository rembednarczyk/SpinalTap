import { describe, expect, it } from "vitest";
import { DISTRICTS } from "../../osm-import/src/config.ts";
import { worldToPuwg } from "../../osm-import/src/project.ts";
import { CHM_STEP, DATUM, MARGIN, NO_DATA, TILE, chmAt, districtBox, encodeChm, highestAround, parseAsciiGrid, reduceChm, tilesOf } from "../src/nmpt.ts";

/** The geoportal's answer: the grid as one part of a multipart body, its projection as another. */
const ANSWER = [
  "--wcs",
  "Content-Type: image/x-aaigrid",
  "Content-ID: coverage/result.asc",
  "",
  "ncols        2",
  "nrows        2",
  "xllcorner    748330.000000000000",
  "yllcorner    381760.000000000000",
  "cellsize     0.500000000000",
  "NODATA_value -9999",
  " 195.30999755859375 205.5",
  " -9999 195.25",
  "--wcs",
  "Content-Type: application/octet-stream",
  "Content-ID: coverage/result.prj",
  "",
  'PROJCS["ETRS89_Poland_CS92"]',
  "--wcs--",
].join("\r\n");

describe("NMPT less NMT for the trees (audit ADR-0077 gap 4)", () => {
  it("reads the grid of the geoportal's multipart answer, row 0 north, no data as NaN", () => {
    const g = parseAsciiGrid(ANSWER);
    expect([g.cols, g.rows, g.xll, g.yll, g.cell]).toEqual([2, 2, 748330, 381760, 0.5]);
    expect(g.values[0]).toBeCloseTo(195.31, 2);
    expect(g.values[1]).toBe(205.5);
    expect(g.values[2]).toBeNaN();
    expect(() => parseAsciiGrid("<html>busy</html>")).toThrow();
    expect(() => parseAsciiGrid(ANSWER.replace(" -9999 195.25", " -9999"))).toThrow(/3 of 4/);
  });

  it("covers every district's rectangle with its margin by tiles of the fixed grid", () => {
    for (const d of DISTRICTS) {
      const b = districtBox(d);
      const tiles = tilesOf(b);
      for (const t of tiles) expect([t.e % TILE, t.n % TILE]).toEqual([0, 0]);
      for (const corner of [
        { x: d.rect.minX - MARGIN, z: d.rect.minZ - MARGIN },
        { x: d.rect.maxX + MARGIN, z: d.rect.maxZ + MARGIN },
      ]) {
        const g = worldToPuwg(corner);
        expect(tiles.some((t) => g.e >= t.e && g.e < t.e + TILE && g.n >= t.n && g.n < t.n + TILE)).toBe(true);
      }
    }
  });

  it("keeps a metre's highest crown over the ground, the ground as 0, no data as such", () => {
    // The NMT under the surface model in its own datum: the surface model is DATUM higher.
    const box = { e0: 100, e1: 102, n0: 200, n1: 201 };
    // Column 0: one 0.5 m cell 12.2 m over the ground (in steps of 0.2 m); column 1: no surface model.
    const dsm = (e: number, n: number) => (e >= 101 ? Number.NaN : e < 100.5 && n > 200.5 ? 162.2 : 150.1);
    const chm = reduceChm(box, dsm, () => 150 - DATUM);
    expect([chm.header.cols, chm.header.rows, chm.header.e0, chm.header.n0]).toEqual([2, 1, 100, 201]);
    expect(chm.cells[0]! * CHM_STEP).toBeCloseTo(12.2, 5);
    expect(chm.cells[1]).toBe(NO_DATA);
    expect(chmAt([chm], 100.7, 200.2)).toBeCloseTo(12.2, 5);
    expect(chmAt([chm], 101.5, 200.5)).toBeNaN();
    expect(encodeChm(-2)).toBe(0);
    expect(encodeChm(80)).toBe(254);
  });

  it("takes the highest cell around a world point, leaving out the blocked ones", () => {
    const g = worldToPuwg({ x: 0, z: 0 });
    const box = { e0: Math.floor(g.e) - 10, e1: Math.floor(g.e) + 10, n0: Math.floor(g.n) - 10, n1: Math.floor(g.n) + 10 };
    // 8 m all round, 15 m two metres east (in PUWG), 25 m five metres east.
    const dsm = (e: number) => (Math.abs(e - g.e - 2) < 0.5 ? 165 : Math.abs(e - g.e - 5) < 0.5 ? 175 : 158);
    const chm = reduceChm(box, dsm, () => 150 - DATUM);
    expect(highestAround([chm], { x: 0, z: 0 }, 3, () => false)).toBeCloseTo(15, 5);
    expect(highestAround([chm], { x: 0, z: 0 }, 3, (q) => q.x > 1)).toBeCloseTo(8, 5);
    expect(highestAround([chm], { x: 0, z: 0 }, 3, () => true)).toBeNull();
    expect(highestAround([chm], { x: 500, z: 500 }, 3, () => false)).toBeNull();
  });
});
