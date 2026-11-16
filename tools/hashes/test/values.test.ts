import { describe, expect, it } from "vitest";
import { BY_HAND, compare, parseValue, partsOf, refusalOf, rewriteHash, softCopy } from "../src/values.ts";

// The values as Vitest serialised them for the three golden tests (a run with changed expectations).
const CUT = (k: string, s: string) => `{\n  "krakowskie-2-0": "${k}",\n  "square": "${s}",\n}`;
const MAP = (m: number, v: number, h: string) => `{\n  "hash": "${h}",\n  "meshes": ${m},\n  "vertices": ${v},\n}`;

describe("hashes:check's values", () => {
  it("takes a serialised value apart into hashes, counts and the rest", () => {
    expect(parseValue(CUT("6 408ae390", "13 c2c46b0d"))).toEqual({ "krakowskie-2-0": "6 408ae390", square: "13 c2c46b0d" });
    expect(partsOf(parseValue(CUT("6 408ae390", "13 c2c46b0d")))).toEqual({ hashes: { "krakowskie-2-0": "408ae390", square: "c2c46b0d" }, numbers: { "krakowskie-2-0": 6, square: 13 }, other: {} });
    expect(partsOf(parseValue(`"d8da2e11"`))).toEqual({ hashes: { "": "d8da2e11" }, numbers: {}, other: {} });
    expect(partsOf(parseValue("cd886d60")).hashes).toEqual({ "": "cd886d60" });
  });

  it("tells the same numbers with a new hash from changed numbers and from other assertions", () => {
    const same = compare(CUT("6 408ae391", "13 c2c46b0d"), CUT("6 408ae390", "13 c2c46b0d"));
    expect(same).toMatchObject({ verdict: "same-numbers", hashes: [{ path: "krakowskie-2-0", old: "408ae391", new: "408ae390" }], numbersChanged: [] });
    expect(compare(CUT("6 408ae390", "13 c2c46b0d"), CUT("7 11111111", "13 c2c46b0d"))).toMatchObject({ verdict: "numbers-changed", numbersChanged: ["krakowskie-2-0"] });
    expect(compare(MAP(24, 142538, "4a1427e0"), MAP(24, 142538, "4a1427e9")).verdict).toBe("same-numbers");
    expect(compare(MAP(24, 142538, "4a1427e0"), MAP(25, 142600, "4a1427e9"))).toMatchObject({ verdict: "numbers-changed", numbersChanged: ["meshes", "vertices"] });
    expect(compare(`"d8da2e10"`, `"d8da2e11"`).verdict).toBe("bare");
    expect(compare("1159", "1160").verdict).toBe("not-a-hash");
    // A key gone from one side is a changed number, not a new hash.
    expect(compare(`{"a": "1 aaaaaaaa"}`, `{"a": "1 aaaaaaaa", "b": "0 bbbbbbbb"}`).verdict).toBe("numbers-changed");
  });

  it("rewrites the hash on the assertion's line, else where the file has it once", () => {
    const src = ['const C = { a: "6 408ae391" };', 'expect(x).toBe("1ce01d19");', 'expect(y).not.toBe("1ce01d19");', "expect(got).toEqual(C);"].join("\n");
    expect(rewriteHash(src, 2, { path: "", old: "1ce01d19", new: "2ce01d19" })).toBe(src.replace('toBe("1ce01d19")', 'toBe("2ce01d19")'));
    expect(rewriteHash(src, 4, { path: "a", old: "408ae391", new: "408ae390" })).toContain('"6 408ae390"');
    // Twice in the file and not on the line: not certain where.
    expect(rewriteHash(src, 4, { path: "", old: "1ce01d19", new: "2ce01d19" })).toBeNull();
    expect(softCopy("expect(a).toBe(1); expect.soft(b); myexpect(c)")).toBe("expect.soft(a).toBe(1); expect.soft(b); myexpect(c)");
  });

  it("never writes the determinism or the ground hash, --bare or not: only by hand (decision of 16.11, ADR-0088)", () => {
    const bare = compare(`"cc9852f4"`, `"cc9852f5"`);
    const det = "packages/sim/test/determinism.test.ts";
    const map = "packages/engine/test/map-ground-golden.test.ts";
    expect(BY_HAND).toEqual([det, map]);
    for (const file of [det, map]) {
      expect(refusalOf(file, bare, true)).toContain("vitest -u");
      expect(refusalOf(file, bare, false)).toContain("vitest -u");
    }
    // The same numbers with a new hash on the ground's floor: a rule moved it, not the map.
    expect(refusalOf(map, compare(MAP(5, 4381, "53e83d0b"), MAP(5, 4381, "53e83d0c")), false)).toContain("vitest -u");
    // The other goldens as before: a bare hash with --bare, the same numbers always, changed numbers never.
    const cut = "packages/engine/test/ground-cut.test.ts";
    expect(refusalOf(cut, bare, true)).toBeNull();
    expect(refusalOf(cut, bare, false)).toBe("bez liczb, potrzebne --bare");
    expect(refusalOf(cut, compare(CUT("6 408ae391", "13 c2c46b0d"), CUT("6 408ae390", "13 c2c46b0d")), false)).toBeNull();
    expect(refusalOf(cut, compare(CUT("6 408ae390", "13 c2c46b0d"), CUT("7 11111111", "13 c2c46b0d")), true)).toBe("liczby: krakowskie-2-0");
  });
});
