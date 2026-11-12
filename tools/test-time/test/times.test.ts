import { describe, expect, it } from "vitest";
import { compareTimes, isSlower, mergeTimes, summary, warnings, type Times } from "../src/times.ts";

/** Time gate of the unit tests (ADR-0046): fixed times in, warnings out, no clock. */

const t = (ms: number, importMs = 0) => ({ ms, importMs });

describe("unit test time gate (ADR-0046)", () => {
  it("warns only above both limits: more than 50% and more than 2 s", () => {
    expect(isSlower(t(4000), t(6000))).toBe(false); // +2.0 s, +50%: at the limits, not over
    expect(isSlower(t(4000), t(6100))).toBe(true); // +2.1 s, +52%
    expect(isSlower(t(300), t(900))).toBe(false); // +200%, but 0.6 s: noise of a small file
    expect(isSlower(t(20_000), t(25_000))).toBe(false); // +5 s, but +25%
    expect(isSlower(t(20_000), t(31_000))).toBe(true); // +11 s, +55%
    expect(isSlower(t(6000), t(1000))).toBe(false); // faster
  });

  it("lists the slower files, the largest slowdown first, and gives no warning to new files", () => {
    const base: Times = { "a.test.ts": t(1000), "b.test.ts": t(4000, 3000), "c.test.ts": t(10_000), "gone.test.ts": t(9000) };
    const head: Times = { "a.test.ts": t(3500), "b.test.ts": t(9000, 8000), "c.test.ts": t(10_500), "new.test.ts": t(60_000) };
    const c = compareTimes(base, head);
    expect(c.slower.map((x) => x.file)).toEqual(["b.test.ts", "a.test.ts"]);
    expect(c.newFiles).toBe(1);
    expect(c.headTotalMs).toBe(83_000);
    expect(c.baseTotalMs).toBe(24_000);
    expect(warnings(c)).toEqual([
      "::warning file=b.test.ts,title=Slower test file::b.test.ts: 4.0 s on main -> 9.0 s (+125%; import 3.0 -> 8.0 s). Warning only, ADR-0046.",
      "::warning file=a.test.ts,title=Slower test file::a.test.ts: 1.0 s on main -> 3.5 s (+250%; import 0.0 -> 0.0 s). Warning only, ADR-0046.",
    ]);
  });

  it("without a reference run lists the times and warns about nothing", () => {
    const c = compareTimes(undefined, { "a.test.ts": t(90_000) });
    expect(c.slower).toEqual([]);
    expect(c.baseTotalMs).toBeUndefined();
    expect(c.newFiles).toBe(1);
    expect(warnings(c)).toEqual([]);
    const md = summary(c, undefined);
    expect(md).toContain("Reference: none found, nothing compared.");
    expect(md).toContain("| a.test.ts | 90.0 | 0.0 | - |");
    expect(md).not.toContain("Slower than main");
  });

  it("keeps the 10 slowest files and the sum in the summary", () => {
    const head: Times = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${String(i).padStart(2, "0")}.test.ts`, t((i + 1) * 1000)]));
    const c = compareTimes(head, head);
    expect(c.slowest.map((x) => x.file)).toEqual(["f11", "f10", "f09", "f08", "f07", "f06", "f05", "f04", "f03", "f02"].map((f) => `${f}.test.ts`));
    const md = summary(c, "main run 42");
    expect(md).toContain("Sum over test files: 78.0 s (main 78.0 s, +0%). Reference: main run 42.");
    expect(md).toContain("No test file over the limit.");
  });

  it("merges the shards into one set", () => {
    expect(mergeTimes([{ files: { "a.test.ts": t(1) } }, { files: { "b.test.ts": t(2) } }])).toEqual({ "a.test.ts": t(1), "b.test.ts": t(2) });
  });
});
