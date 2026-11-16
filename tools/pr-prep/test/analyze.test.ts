import { describe, expect, it } from "vitest";
import { against, globToRegExp, guardedIn, summaryLine } from "../src/analyze.ts";

describe("pr:prep's analysis", () => {
  it("matches the guarded files by glob", () => {
    expect(globToRegExp("packages/sim/src/content/lublin/*.generated.ts").test("packages/sim/src/content/lublin/podzamcze.generated.ts")).toBe(true);
    expect(globToRegExp("packages/sim/src/content/lublin/*.generated.ts").test("packages/sim/src/content/lublin/x/y.generated.ts")).toBe(false);
    expect(globToRegExp("e2e/__snapshots__/**").test("e2e/__snapshots__/npr-perf.spec.ts/reference-m0.png")).toBe(true);
    expect(globToRegExp("packages/*/src/**").test("packages/ui/src/hud/hud.tsx")).toBe(true);
    expect(guardedIn(["packages/sim/test/determinism.test.ts", "tools/glitch-scan/test/glitch-baseline.json", "README.md"])).toEqual({
      determinism: ["packages/sim/test/determinism.test.ts"],
      "glitch-baseline": ["tools/glitch-scan/test/glitch-baseline.json"],
    });
  });

  it("asks for CI again after a branch sharing a file or feeding a golden the other changes", () => {
    const mine = ["packages/engine/test/map-ground-golden.test.ts", "packages/engine/src/renderer/mapcity/ground-plan.ts"];
    expect(against(mine, "docs", ["docs/backlog.md"])).toEqual({ branch: "docs", shared: [], rerun: false, why: [] });
    const content = against(mine, "import", ["packages/sim/src/content/lublin/nabrzeze.generated.ts"]);
    expect(content.rerun).toBe(true);
    expect(content.why).toContain("map-ground-golden: ta gałąź go zmienia, tamta jego wejścia");
    // Not a golden of mine, but theirs: their ground-cut moves with my renderer's change.
    expect(against(mine, "cut", ["packages/engine/test/ground-cut.test.ts"]).why).toContain("ground-cut: tamta gałąź go zmienia, ta jego wejścia");
    expect(against(mine, "same", ["packages/engine/src/renderer/mapcity/ground-plan.ts"]).shared).toEqual(["packages/engine/src/renderer/mapcity/ground-plan.ts"]);
  });

  it("says it in one line", () => {
    const line = summaryLine({
      branch: "b",
      sha: "0123456789abcdef0123456789abcdef01234567",
      clean: false,
      conflicts: ["a.ts", "b.ts"],
      ahead: 3,
      behind: 1,
      guarded: { determinism: ["packages/sim/test/determinism.test.ts"] },
      others: [{ branch: "o", shared: ["a.ts"], rerun: true, why: ["wspólne pliki: 1"] }],
    });
    expect(line).toBe(
      "b 0123456789abcdef0123456789abcdef01234567 | KONFLIKT z origin/main (2: a.ts, b.ts) | +3/-1 wobec main | wygenerowane -, złote determinism, bazy - | wspólne pliki: o (1) | ponów CI po scaleniu: o",
    );
  });
});
