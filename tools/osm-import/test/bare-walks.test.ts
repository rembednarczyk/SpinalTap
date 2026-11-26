import { describe, expect, it } from "vitest";
import { Cells, LABEL } from "../src/bare-cells.ts";
import { SETT_DISTRICTS, kerbWalks, streetRings } from "../src/bare-walks.ts";

/*
 * The rule's paving that meets a street is a sidewalk (the user's decision of 26.11): the whole
 * connected run of paved cells, forecourt and all; a run off the street, or one that meets a mapped
 * square, stays a square's (the curator's review: a deptak keeps one paving).
 */
describe("the bare ground rule's walks by the kerb (bare-walks.ts)", () => {
  // 10 x 10 cells of 0.5 m: a street in column 0, a paved run from column 1 to 4 (rows 0-3) that
  // reaches on past row 3 in column 4 to row 7, a paved run off the street at columns 7-8.
  const raster = () => {
    const cells = new Cells({ minX: 0, maxX: 5, minZ: 0, maxZ: 5 });
    const at = (i: number, j: number) => j * cells.nx + i;
    const street = new Uint8Array(cells.nx * cells.nz);
    const place = new Uint8Array(cells.nx * cells.nz);
    for (let j = 0; j < cells.nz; j++) street[at(0, j)] = 1;
    for (let j = 0; j < 4; j++) for (let i = 1; i <= 4; i++) cells.label[at(i, j)] = LABEL.square;
    for (let j = 4; j < 8; j++) cells.label[at(4, j)] = LABEL.square;
    for (let j = 0; j < 4; j++) for (let i = 7; i <= 8; i++) cells.label[at(i, j)] = LABEL.square;
    return { cells, at, street, place };
  };

  it("lays the whole run that meets the street as a walk, and leaves a run off it a square's", () => {
    const { cells, at, street, place } = raster();
    kerbWalks(cells, street, place);
    expect(cells.label[at(1, 0)]).toBe(LABEL.walk);
    expect(cells.label[at(4, 7)]).toBe(LABEL.walk);
    expect(cells.label[at(7, 0)]).toBe(LABEL.square);
    expect(cells.label[at(8, 3)]).toBe(LABEL.square);
  });

  it("keeps a run that meets a mapped square a square's, a deptak's paving whole", () => {
    const { cells, at, street, place } = raster();
    place[at(4, 8)] = 1;
    kerbWalks(cells, street, place);
    expect(cells.label[at(1, 0)]).toBe(LABEL.square);
    expect(cells.label[at(4, 7)]).toBe(LABEL.square);
  });

  it("takes the carriageways of streets, not of service ways", () => {
    const ring = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }];
    const lines = [{ id: "w1", tags: { highway: "residential" } }, { id: "w2", tags: { highway: "service" } }];
    const bands = [{ carriageway: true as const, source: "w1", ring }, { carriageway: true as const, source: "w2", ring }, { source: "w1", ring }];
    expect(streetRings(lines, bands)).toEqual([ring]);
  });

  it("keeps the Old Town's sett and granite", () => {
    expect(SETT_DISTRICTS.has("stare-miasto")).toBe(true);
    expect(SETT_DISTRICTS.has("krakowskie")).toBe(false);
  });
});
