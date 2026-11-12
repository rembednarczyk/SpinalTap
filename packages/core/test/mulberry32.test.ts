import { describe, expect, it } from "vitest";
import { mulberry32, mulberry32Advance, mulberry32Output } from "../src";

/**
 * Reference: the first six outputs (times 2^32) and the state after six steps, computed with
 * the four copies the project had before they were merged into one (sim `SeededRandom`, audio
 * `mulberry32`, city kit `prng`, crowd `lookStream`); all four agreed on every number.
 */
const REFERENCE: ReadonlyArray<readonly [number, readonly number[], number]> = [
  [0, [1144304738, 1416247, 958946056, 627933444, 2007157716, 2340967985], 2399460286],
  [1, [2693262067, 11749833, 2265367787, 4213581821, 4159151403, 1207330352], 2399460287],
  [42, [2581720956, 1925393290, 3661312704, 2876485805, 750819978, 2261697747], 2399460328],
  [0xdeadbeef, [4043151706, 1147597007, 3315858022, 1538288752, 2042435954, 3600176436], 1840421549],
  [-7, [1860010037, 1397564179, 2337619704, 2062400319, 209248909, 176908872], 2399460279],
  [4294967295, [3850105811, 813802916, 3073704848, 4054706436, 3630262831, 2315588663], 2399460285],
];

describe("mulberry32", () => {
  it.each(REFERENCE)("seed %d gives the reference stream", (seed, outputs) => {
    const next = mulberry32(seed);
    expect(outputs.map(() => next() * 4294967296)).toEqual(outputs);
  });

  it.each(REFERENCE)("seed %d: stepping the state gives the same numbers and the reference state", (seed, outputs, finalState) => {
    let state = seed >>> 0;
    const values = outputs.map(() => {
      state = mulberry32Advance(state);
      return mulberry32Output(state) * 4294967296;
    });
    expect(values).toEqual(outputs);
    expect(state).toBe(finalState);
  });

  it("stays in [0, 1)", () => {
    const next = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
