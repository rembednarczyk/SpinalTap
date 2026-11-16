import { describe, expect, it } from "vitest";
import { checkWrite, inArea, parseScanChunks, restrictKeys, scanArea } from "../src/scan-chunks.ts";
import { diffKind, fails, keysOf } from "../src/scan-keys.ts";

/** Chunks in a row along x, `a-0-0 | a-1-0 | b-0-0 | c-0-0 | a-x-0-0` (district `a-x`), and `d-0-0` far off. */
const box = (minX: number, maxX: number) => ({ minX, maxX, minZ: 0, maxZ: 100 });
const CELLS = [
  { id: "a-0-0", bounds: box(0, 100) },
  { id: "a-1-0", bounds: box(100, 200) },
  { id: "b-0-0", bounds: box(200, 300) },
  { id: "c-0-0", bounds: box(300, 400) },
  { id: "d-0-0", bounds: { minX: 0, maxX: 100, minZ: 500, maxZ: 600 } },
  { id: "a-x-0-0", bounds: box(400, 500) },
];

describe("the glitch scan's part of the city on a pull request (GLITCH_SCAN_CHUNKS)", () => {
  it("reads the districts by commas, and no part when unset or empty", () => {
    expect(parseScanChunks("krakowskie, podzamcze")).toEqual(["krakowskie", "podzamcze"]);
    expect(parseScanChunks(undefined)).toBeUndefined();
    expect(parseScanChunks(" , ")).toBeUndefined();
  });

  it("takes a district's chunks and every chunk touching them, not one farther nor one of a longer name", () => {
    expect([...scanArea(["a"], CELLS)].sort()).toEqual(["a-0-0", "a-1-0", "b-0-0"]);
    expect([...scanArea(["b"], CELLS)].sort()).toEqual(["a-1-0", "b-0-0", "c-0-0"]);
    expect([...scanArea(["d"], CELLS)]).toEqual(["d-0-0"]);
  });

  it("refuses a district with no chunk, so a renamed table never compares nothing", () => {
    expect(() => scanArea(["a", "zz"], CELLS)).toThrow(/no chunk of zz/);
  });

  it("compares the keys off the map and with no place always", () => {
    const area = scanArea(["d"], CELLS);
    expect(["d-0-0 1,2", "poza 9,9", "? w123: no model", "a-0-0 1,2"].map((k) => inArea(area, k))).toEqual([true, true, true, false]);
  });

  it("on a small base ignores the other chunks' keys and fails on a new key in the changed one", () => {
    const base = new Map([
      ["a-0-0 10,10", 1],
      ["c-0-0 350,50", 2],
    ]);
    const area = scanArea(["a"], CELLS);
    // c-0-0 is past the ring: its key gone and a new one there are not compared.
    const elsewhere = keysOf("pad-on-road", [{ at: "10.2,9.8", what: "pad" }, { at: "360,50", what: "pad" }], CELLS);
    const d = diffKind("pad-on-road", restrictKeys(base, area), restrictKeys(elsewhere, area));
    expect(fails(d)).toBe(false);
    expect(d.removed).toEqual([]);
    // The same findings over the whole city: the new key in c-0-0 fails.
    expect(fails(diffKind("pad-on-road", base, elsewhere))).toBe(true);
    // A new key in the changed district, and one in its neighbour b-0-0, fail.
    for (const at of ["150,40", "250,40"]) {
      const found = keysOf("pad-on-road", [{ at: "10,10", what: "pad" }, { at, what: "pad" }], CELLS);
      const changed = diffKind("pad-on-road", restrictKeys(base, area), restrictKeys(found, area));
      expect(fails(changed), at).toBe(true);
      expect(changed.added.map((a) => a.key), at).toHaveLength(1);
    }
  });

  it("with no part compares every key", () => {
    const keys = new Map([["c-0-0 1,1", 1]]);
    expect(restrictKeys(keys, undefined)).toEqual(keys);
  });

  it("refuses to write the base from a part, and lets the whole scan write it", () => {
    expect(() => checkWrite("update", ["a"])).toThrow(/whole scan/);
    expect(() => checkWrite("accept", ["a"])).toThrow(/whole scan/);
    expect(() => checkWrite("update", undefined)).not.toThrow();
    expect(() => checkWrite(undefined, ["a"])).not.toThrow();
  });
});
