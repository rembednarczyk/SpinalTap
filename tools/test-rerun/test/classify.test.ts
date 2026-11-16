import { describe, expect, it } from "vitest";
import { classify, isTimeout, rerunCandidates, summary, type VitestReport } from "../src/classify.ts";

/** A Vitest JSON report as `--reporter=json` writes it, cut down to the fields the tool reads. */
const report: VitestReport = {
  success: false,
  numTotalTests: 6,
  testResults: [
    { name: "/r/packages/sim/test/ok.test.ts", status: "passed", message: "", assertionResults: [{ fullName: "ok works", status: "passed", failureMessages: [] }] },
    {
      name: "/r/packages/app/test/slow.test.ts",
      status: "failed",
      message: "",
      assertionResults: [
        { fullName: "slow plays act 1", status: "failed", failureMessages: ["Error: Test timed out in 20000ms.\nIf this is a long-running test, pass a timeout value as the last argument or configure it globally with \"testTimeout\"."] },
        { fullName: "slow plays act 2", status: "passed", failureMessages: [] },
      ],
    },
    {
      name: "/r/packages/sim/test/broken.test.ts",
      status: "failed",
      message: "",
      assertionResults: [
        { fullName: "broken hash", status: "failed", failureMessages: ["AssertionError: expected 'a1' to be 'b2' // Object.is equality\n    at broken.test.ts:9"] },
        { fullName: "broken slow", status: "failed", failureMessages: ["Error: Test timed out in 5000ms."] },
      ],
    },
    { name: "/r/packages/ui/test/hook.test.tsx", status: "failed", message: "Hook timed out in 10000ms.", assertionResults: [{ fullName: "hook a", status: "skipped", failureMessages: [] }] },
    { name: "/r/packages/ui/test/load.test.tsx", status: "failed", message: "Failed to load url ./missing", assertionResults: [] },
  ],
};

const rel = (p: string) => p.replace("/r/", "");

describe("test-rerun: timeouts apart from assertions", () => {
  it("knows Vitest's test and hook timeouts and nothing else", () => {
    expect(isTimeout("Error: Test timed out in 20000ms.")).toBe(true);
    expect(isTimeout("Hook timed out in 10000ms.")).toBe(true);
    expect(isTimeout("AssertionError: expected 'timed out' to be 'ok'")).toBe(false);
    expect(isTimeout("TimeoutError: page.waitForFunction: Timeout 30000ms exceeded.")).toBe(false);
  });

  it("sorts every failed file into timeouts and real failures", () => {
    const c = classify(report, rel);
    expect(c.files).toBe(5);
    expect(c.outsideFiles).toBe(false);
    expect(c.failed.map((f) => [f.file, f.timeouts.length, f.real.length])).toEqual([
      ["packages/app/test/slow.test.ts", 1, 0],
      ["packages/sim/test/broken.test.ts", 1, 1],
      ["packages/ui/test/hook.test.tsx", 1, 0],
      ["packages/ui/test/load.test.tsx", 0, 1],
    ]);
    expect(c.failed[1]!.real[0]).toEqual({ test: "broken hash", message: "AssertionError: expected 'a1' to be 'b2' // Object.is equality" });
  });

  it("runs again only the files with timeouts alone", () => {
    expect(rerunCandidates(classify(report, rel))).toEqual(["packages/app/test/slow.test.ts", "packages/ui/test/hook.test.tsx"]);
  });

  it("is red on an assertion even when every timeout passes alone", () => {
    const s = summary(classify(report, rel), [
      { file: "packages/app/test/slow.test.ts", after: null },
      { file: "packages/ui/test/hook.test.tsx", after: null },
    ]);
    expect(s.ok).toBe(false);
    expect(s.lines.filter((l) => l.startsWith("ASSERTION"))).toEqual([
      "ASSERTION packages/sim/test/broken.test.ts > broken hash: AssertionError: expected 'a1' to be 'b2' // Object.is equality",
      "ASSERTION packages/ui/test/load.test.tsx > (file): Failed to load url ./missing",
    ]);
    expect(s.lines.at(-1)).toBe("result: FAIL (2 files with assertions or errors, 0 still failing alone)");
  });

  it("is green when the only failures were timeouts that pass alone, red when one stays", () => {
    const timeoutsOnly: VitestReport = { success: false, numTotalTests: 3, testResults: report.testResults!.slice(0, 2) };
    const c = classify(timeoutsOnly, rel);
    expect(summary(c, [{ file: "packages/app/test/slow.test.ts", after: null }])).toEqual({
      ok: true,
      lines: ["first run: 2 files, 3 tests, 1 files failed: 0 with assertions or errors, 1 with timeouts only", "rerun packages/app/test/slow.test.ts (--maxWorkers=1): passed", "result: OK (1 files passed alone after timeouts)"],
    });
    const stays = summary(c, [{ file: "packages/app/test/slow.test.ts", after: c.failed[0]! }]);
    expect(stays.ok).toBe(false);
    expect(stays.lines).toContain("  TIMEOUT slow plays act 1: Error: Test timed out in 20000ms.");
  });

  it("is red on a failure outside the files", () => {
    const c = classify({ success: false, numTotalTests: 1, testResults: report.testResults!.slice(0, 1) }, rel);
    expect(c.outsideFiles).toBe(true);
    expect(summary(c, []).ok).toBe(false);
  });
});
