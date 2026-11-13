import { describe, expect, it } from "vitest";
import { accepted, describeKey, diffKind, fails, formatDiff, formatKind, keyOf, keysOf, parseKind, placeOf, pruned } from "../src/scan-keys.ts";

const CELLS = [
  { id: "a-0-0", bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 100 } },
  { id: "a-1-0", bounds: { minX: 100, maxX: 200, minZ: 0, maxZ: 100 } },
];
const f = (at: string, what = "w1") => ({ at, what });
/** A 1 m kind and a sampled one (`SAMPLED_KINDS`). */
const [ONE, SAMPLED] = ["lane-dead-end", "landuse-bare"];

describe("the scan's keys by place", () => {
  it("keys a 1 m kind by its chunk and rounded place, the same under a shift of under half a metre", () => {
    expect(keyOf(ONE, f("12,34"), CELLS)).toBe("a-0-0 12,34");
    expect(keyOf(ONE, f("12.4,33.6"), CELLS)).toBe("a-0-0 12,34");
    expect(keyOf(ONE, f("-0.2,5"), [{ id: "b", bounds: { minX: -10, maxX: 10, minZ: 0, maxZ: 10 } }])).toBe("b 0,5");
    expect(keyOf(ONE, f("150,20"), CELLS)).toBe("a-1-0 150,20");
    expect(keyOf(ONE, f("500,20"), CELLS)).toBe("poza 500,20");
  });

  it("keys a sampled kind by its 10 m square, the same for every sample in it, in the square's chunk", () => {
    for (const at of ["100,0", "100.25,0.25", "109.75,9.75"]) expect(keyOf(SAMPLED, f(at), CELLS)).toBe("a-1-0 100,0");
    expect(keyOf(SAMPLED, f("99.75,0.25"), CELLS)).toBe("a-0-0 90,0");
    expect(keyOf(SAMPLED, f("-0.5,-0.5"), CELLS)).toBe("poza -10,-10");
    expect(describeKey(SAMPLED, "a-1-0 100,0")).toBe("landuse-bare a-1-0 100..110,0..10");
  });

  it("takes the last place in an `at` that is more than one, and keys one with none by its text", () => {
    expect(placeOf("patrol lane from 1,2 at 30.4,40.6 y 7.5")).toEqual({ x: 30.4, z: 40.6 });
    expect(keyOf(ONE, f("road and sidewalk at 30.4,40.6"), CELLS)).toBe("a-0-0 30,41");
    expect(keyOf(ONE, f("traffic sedan/0", "wheel off"), CELLS)).toBe("? traffic sedan/0");
    expect(keyOf(ONE, f("?", "w5 not in the map"), CELLS)).toBe("? w5 not in the map");
  });

  it("counts the findings on one metre of a 1 m kind, and a sampled kind's square once", () => {
    const one = keysOf(ONE, [f("12,34", "lane a"), f("12.2,34", "lane b"), f("50,50")], CELLS);
    expect([...one].map(([k, v]) => [k, v.n, v.what])).toEqual([
      ["a-0-0 12,34", 2, "lane a"],
      ["a-0-0 50,50", 1, "w1"],
    ]);
    const sampled = keysOf(SAMPLED, [f("1,1"), f("2,2"), f("3,3")], CELLS);
    expect([...sampled].map(([k, v]) => [k, v.n, v.samples])).toEqual([["a-0-0 0,0", 1, 3]]);
  });
});

describe("the scan's keys against the base", () => {
  const base = new Map([
    ["a-0-0 12,34", 2],
    ["a-0-0 50,50", 1],
  ]);

  it("fails on a new key even when the sum comes down, and lists what came and went", () => {
    const found = keysOf(ONE, [f("70,70", "new lane")], CELLS);
    const d = diffKind(ONE, base, found);
    expect(fails(d)).toBe(true);
    expect([d.before, d.after]).toEqual([3, 1]);
    expect(d.added).toEqual([{ key: "a-0-0 70,70", n: 1, what: "new lane" }]);
    expect(d.removed.map((r) => r.key)).toEqual(["a-0-0 12,34", "a-0-0 50,50"]);
    expect(formatDiff(d)).toEqual([
      "lane-dead-end: sum 3 -> 1, +1 new key(s), 0 grown, -2 gone or fewer",
      "  + lane-dead-end a-0-0 70,70: new lane",
      "  - lane-dead-end a-0-0 12,34",
      "  - lane-dead-end a-0-0 50,50",
    ]);
  });

  it("fails on a known key of a 1 m kind found more often than its base, and passes on fewer", () => {
    expect(fails(diffKind(ONE, base, keysOf(ONE, [f("12,34"), f("12,34"), f("12,34")], CELLS)))).toBe(true);
    const fewer = diffKind(ONE, base, keysOf(ONE, [f("12,34")], CELLS));
    expect(fails(fewer)).toBe(false);
    expect(fewer.removed).toEqual([
      { key: "a-0-0 12,34", was: 2, now: 1 },
      { key: "a-0-0 50,50", was: 1, now: 0 },
    ]);
    expect(formatDiff(diffKind(ONE, base, keysOf(ONE, [f("12,34"), f("12,34"), f("50,50")], CELLS)))).toEqual([]);
  });

  it("updates the base only by removing keys and bringing counts down, never adding", () => {
    const found = keysOf(ONE, [f("12,34"), f("12,34"), f("12,34"), f("70,70")], CELLS);
    expect([...pruned(base, found)]).toEqual([["a-0-0 12,34", 2]]);
    expect([...pruned(base, keysOf(ONE, [f("12,34")], CELLS))]).toEqual([["a-0-0 12,34", 1]]);
    expect(pruned(base, new Map()).size).toBe(0);
  });

  it("accepts the keys as found, the new ones in", () => {
    const found = keysOf(ONE, [f("12,34"), f("70,70")], CELLS);
    expect([...accepted(found)]).toEqual([
      ["a-0-0 12,34", 1],
      ["a-0-0 70,70", 1],
    ]);
    expect(fails(diffKind(ONE, accepted(found), found))).toBe(false);
  });
});

describe("the base's files", () => {
  it("writes one key a line by chunk, z and x, with the count past one, and reads it back", () => {
    const base = new Map([
      ["a-1-0 5,10", 1],
      ["? traffic sedan/0", 1],
      ["a-0-0 -3,10", 2],
      ["a-0-0 7,-2", 1],
    ]);
    const text = formatKind(ONE, base);
    expect(text).toBe("# lane-dead-end: grid 1 m (x,z rounded); a count after the place is how many findings hold it\na-0-0 7,-2\na-0-0 -3,10 *2\na-1-0 5,10\n? traffic sedan/0\n");
    expect(parseKind(ONE, text)).toEqual(base);
  });

  it("refuses a file whose header is another grid's", () => {
    const text = formatKind(SAMPLED, new Map([["a-0-0 0,0", 1]]));
    expect(text.split("\n")[0]).toBe("# landuse-bare: grid 10 m (x,z = the square's corner at its least x and z)");
    expect(() => parseKind(ONE, text)).toThrow(/grid changed/);
  });
});
