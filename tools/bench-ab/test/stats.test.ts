import { describe, expect, it } from "vitest";
import { median, oneLine, pairOrder, pl, quantile, summarize, testDuration, waitForLoad, type Pair } from "../src/stats.ts";

const pair = (a: number, b: number, loadStart = 2, loadEnd = 3, waitedOut = false): Pair => ({ a, b, first: "A", loadStart, loadEnd, waitedOut });

describe("bench-ab: pairs, median, spread", () => {
  it("alternates the order of the pairs", () => {
    expect([0, 1, 2, 3].map(pairOrder)).toEqual([
      ["A", "B"],
      ["B", "A"],
      ["A", "B"],
      ["B", "A"],
    ]);
  });

  it("takes the median and quantiles by linear interpolation", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(quantile([10, 20, 30, 40, 50], 0.25)).toBe(20);
    expect(quantile([1, 2], 0.25)).toBe(1.25);
    expect(median([])).toBeNaN();
  });

  it("gives the median of the per-pair change, not the change of the medians", () => {
    // Pair changes +10%, +20%, -50% (one pair under a spike on A), +5%: median +7.5%.
    const s = summarize([pair(1000, 1100), pair(1000, 1200, 3.1, 3.9), pair(2000, 1000), pair(1000, 1050, 1.2, 2)]);
    expect(s.deltaPct).toBe(7.5);
    expect(s.aMs).toBe(1000);
    expect(s.bMs).toBe(1075);
    expect(s.spread).toEqual({ min: -50, p25: -8.7, p75: 12.5, max: 20 });
    expect(s.load).toEqual({ min: 1.2, max: 3.9 });
    expect(oneLine(s)).toBe("+7,5% (1000 ms / 1075 ms, 4 par, load 1,2–3,9); rozrzut −50,0…+20,0%, połowa par −8,7…+12,5%");
  });

  it("says how many pairs ran over the load limit", () => {
    const s = summarize([pair(100, 90, 5, 6, true), pair(100, 95)]);
    expect(s.waitedOut).toBe(1);
    expect(oneLine(s)).toMatch(/^−7,5% \(100 ms \/ 92,5 ms, 2 par, load 2,0–6,0, 1 par ponad progiem obciążenia\)/);
  });

  it("writes Polish numbers with a real minus and no negative zero", () => {
    expect(pl(-0.04, 1)).toBe("0,0");
    expect(pl(0, 1, true)).toBe("+0,0");
    expect(pl(-12.34, 1)).toBe("−12,3");
  });
});

describe("bench-ab: the load gate", () => {
  it("waits until the load falls under the limit", async () => {
    const loads = [6, 5, 3.9];
    const slept: number[] = [];
    const r = await waitForLoad(() => loads.shift()!, async (ms) => void slept.push(ms), 4, 60_000, 15_000);
    expect(r).toEqual({ load: 3.9, waitedMs: 30_000, waitedOut: false });
    expect(slept).toEqual([15_000, 15_000]);
  });

  it("gives up after the longest wait and marks the pair", async () => {
    const r = await waitForLoad(() => 9, async () => {}, 4, 45_000, 15_000);
    expect(r).toEqual({ load: 9, waitedMs: 45_000, waitedOut: true });
  });
});

describe("bench-ab: the time of a Vitest test", () => {
  const report = {
    testResults: [
      {
        name: "/r/tools/osm-import/test/venues.test.ts",
        assertionResults: [
          { fullName: "venues sign nearly all of the city's venues", status: "passed", duration: 4123.4 },
          { fullName: "venues keep the order", status: "skipped", duration: null },
        ],
      },
    ],
  };

  it("takes the duration of the one test named", () => {
    expect(testDuration(report, "sign nearly")).toBe(4123.4);
  });

  it("refuses a name of no test, of two tests, or of a test that did not pass", () => {
    expect(() => testDuration(report, "nothing")).toThrow(/0 tests/);
    expect(() => testDuration(report, "venues")).toThrow(/2 tests/);
    expect(() => testDuration(report, "keep the order")).toThrow(/skipped/);
  });
});
