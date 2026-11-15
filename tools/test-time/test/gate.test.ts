import { describe, expect, it } from "vitest";
import { EXCEPTIONS } from "../src/exceptions.ts";
import { type TestTimes, errors, exceptionFor, gateSummary, gateTests, median, medianTimes, testId } from "../src/gate.ts";
import { mergeTests } from "../src/times.ts";

/** Gate of single tests (ADR-0083 step 2): fixed times in, breaches out, no clock. */

const t = (ms: number, limitMs = 20_000) => ({ ms, limitMs });
const A = testId("a.test.ts", "city > matches");
const B = testId("b.test.ts", "small");

describe("gate of single tests (ADR-0083 step 2)", () => {
  it("fails a new test over half of its own limit, at half not yet", () => {
    // Main's runs know only D: A, B and the long one are new.
    const main = [{ "d.test.ts > old": t(1_000) }];
    const g = gateTests({ [A]: t(10_001), [B]: t(10_000), "c.test.ts > long": t(100_000, 240_000) }, main, []);
    expect(g.breaches.map((b) => [b.test, b.kind])).toEqual([[A, "limit"]]);
    expect(errors(g)).toEqual([
      "::error file=a.test.ts,title=Test too slow::a.test.ts > city > matches: 10.0 s, over 50% of its 20.0 s limit. Find what made it slower (ADR-0083: a profile, not a higher limit) or add it with a reason to tools/test-time/src/exceptions.ts.",
    ]);
  });

  // 15.11, #585: crowd tests of main at 10.4 and 11.2 s failed half their limit by the runner's noise alone.
  it("holds a test main has by its growth and by three quarters of its limit, not by half", () => {
    const main = [{ [A]: t(10_500) }, { [A]: t(9_500) }, { [A]: t(10_000) }];
    expect(gateTests({ [A]: t(11_200) }, main, []).breaches).toEqual([]);
    expect(gateTests({ [A]: t(13_500) }, main, []).breaches.map((b) => b.kind)).toEqual(["growth"]);
    const hard = gateTests({ [A]: t(15_100) }, [{ [A]: t(14_800) }], []);
    expect(hard.breaches.map((b) => b.kind)).toEqual(["limit"]);
    // With no run of main to compare with, only three quarters hold.
    expect(gateTests({ [A]: t(14_000) }, [], []).breaches).toEqual([]);
    expect(gateTests({ [A]: t(15_100) }, [], []).breaches.map((b) => b.kind)).toEqual(["limit"]);
  });

  it("fails a test more than 30% and more than 1 s slower than the median of main's runs", () => {
    const main: TestTimes[] = [{ [A]: t(4000), [B]: t(100) }, { [A]: t(9000), [B]: t(100) }, { [A]: t(5000), [B]: t(100) }];
    expect(gateTests({ [A]: t(6500), [B]: t(900) }, main, []).breaches).toEqual([]); // +30% of 5 s; +800%, but 0.8 s
    const g = gateTests({ [A]: t(6600), [B]: t(1200) }, main, []);
    expect(g.breaches.map((b) => [b.test, b.kind, b.medianMs, b.runs])).toEqual([
      [A, "growth", 5000, 3],
      [B, "growth", 100, 3],
    ]);
    expect(g.compared).toBe(2);
    expect(errors(g)[0]).toContain("6.6 s against 5.0 s on main (median of 3 runs, +32%)");
  });

  it("compares a new test with nothing and a test of fewer runs with those it has", () => {
    const g = gateTests({ [A]: t(3000), "new.test.ts > x": t(9000) }, [{ [A]: t(1000) }, {}], []);
    expect(g.breaches.map((b) => [b.test, b.kind, b.runs])).toEqual([[A, "growth", 1]]);
    expect(g.compared).toBe(1);
  });

  it("lets through only the tests of the list of exceptions, by test or by file, with their reasons", () => {
    const exceptions = [{ test: A, reason: "the whole city, ADR-0083 step 3" }, { test: "c.test.ts", reason: "a file of the city" }];
    expect(exceptionFor(exceptions, "c.test.ts > any > test")?.reason).toBe("a file of the city");
    expect(exceptionFor(exceptions, "c.test.tsx > x")).toBeUndefined();
    const g = gateTests({ [A]: t(16_000), "c.test.ts > x": t(16_000), [B]: t(16_000) }, [], exceptions);
    expect(g.breaches.map((b) => b.test)).toEqual([B]);
    expect(g.excused.map((b) => [b.test, b.reason])).toEqual([
      [A, "the whole city, ADR-0083 step 3"],
      ["c.test.ts > x", "a file of the city"],
    ]);
    const md = gateSummary(g);
    expect(md).toContain("### Over the limits (1)");
    expect(md).toContain(`| ${A} | limit | 16.0 s, over 80% of its 20.0 s limit | the whole city, ADR-0083 step 3 |`);
  });

  it("gives every exception a reason", () => {
    for (const e of EXCEPTIONS) expect(e.reason.length, e.test).toBeGreaterThan(10);
  });

  it("takes the median of an odd and an even number of runs, and reads runs from before ADR-0083 as none", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(medianTimes([{ [A]: t(1) }, { [A]: t(5) }, { [B]: t(7) }])).toEqual(new Map([[A, { ms: 3, runs: 2 }], [B, { ms: 7, runs: 1 }]]));
    expect(mergeTests([{ files: {} }, { files: {}, tests: { [A]: t(1) } }])).toEqual({ [A]: t(1) });
    expect(gateSummary(gateTests({ [B]: t(1) }, [], []))).toContain("No test over the limits.");
  });

  it("excuses a known-slow test only from the limit: its growth over main still fails", () => {
    const exceptions = [{ test: A, reason: "known slow at the gate's start", only: "limit" as const }];
    const slowAsBefore = gateTests({ [A]: t(15_500) }, [{ [A]: t(15_200) }], exceptions);
    expect(slowAsBefore.breaches).toEqual([]);
    expect(slowAsBefore.excused.map((b) => b.kind)).toEqual(["limit"]);
    const grown = gateTests({ [A]: t(17_000) }, [{ [A]: t(11_800) }], exceptions);
    // Over the limit and grown: the limit is excused, the growth is not.
    expect(grown.breaches.map((b) => b.kind)).toEqual(["growth"]);
  });
});
