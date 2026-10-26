import { describe, expect, it } from "vitest";
import { SeededRandom } from "../src";

describe("SeededRandom", () => {
  it("produces the same stream for the same seed", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    const xs = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it("differs between seeds and resumes from saved state", () => {
    const a = new SeededRandom(1);
    expect(a.next()).not.toBe(new SeededRandom(2).next());
    const state = a.getState();
    const expected = a.next();
    const b = new SeededRandom(999);
    b.setState(state);
    expect(b.next()).toBe(expected);
  });
});
