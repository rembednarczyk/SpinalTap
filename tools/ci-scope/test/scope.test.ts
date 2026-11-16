import { describe, expect, it } from "vitest";
import { fullScope, isFull, pushScope, scope } from "../src/scope.ts";

/** What a pull request runs (ADR-0046): changed files in, scope out; the test files are a fixed list. */

const TESTS = [
  "packages/app/test/model-manifest.test.ts",
  "packages/engine/test/city-kit.test.ts",
  "packages/sim/test/determinism.test.ts",
  "tools/code-health/test/god-objects.test.ts",
  "tools/glitch-scan/test/glitch-scan.test.ts",
  "tools/glitch-scan/test/cut-on-road.test.ts",
  "tools/i18n-scan/test/i18n-scan.test.ts",
  "tools/osm-import/test/fingerprint.test.ts",
];
const SCANS = ["tools/code-health/test/god-objects.test.ts", "tools/i18n-scan/test/i18n-scan.test.ts"];

describe("CI scope of a pull request (ADR-0046)", () => {
  it("a change of the renderer runs its related unit tests and e2e, not the map tables", () => {
    const s = scope(["packages/engine/src/renderer/arm-mesh.ts"], TESTS);
    expect(s).toMatchObject({ code: true, tables: false, e2e: true, unit: "related" });
    expect(s.unitFiles).toEqual(["packages/engine/src/renderer/arm-mesh.ts", ...SCANS]);
  });

  it("a change of the simulation runs its related unit tests, no e2e", () => {
    const s = scope(["packages/sim/src/systems/body-system.ts", "packages/sim/test/body-system.test.ts"], TESTS);
    expect(s).toMatchObject({ code: true, tables: false, e2e: false, unit: "related" });
    expect(s.unitFiles).toEqual(["packages/sim/src/systems/body-system.ts", "packages/sim/test/body-system.test.ts", ...SCANS]);
  });

  it("a kerb rule of the OSM import without new tables runs the tables' job and its unit tests, no e2e", () => {
    const s = scope(["tools/osm-import/src/kerbside.ts"], TESTS);
    expect(s).toMatchObject({ code: true, tables: true, e2e: false, unit: "related" });
    expect(s.unitFiles).toEqual([...SCANS, "tools/osm-import/src/kerbside.ts"].sort());
  });

  it("a kerb rule with the tables it generates runs e2e too", () => {
    const s = scope(["tools/osm-import/src/kerbside.ts", "packages/sim/src/content/lublin/krakowskie.generated.ts", "packages/sim/src/content/lublin/props.generated.ts"], TESTS);
    expect(s).toMatchObject({ code: true, tables: true, e2e: true, unit: "related" });
    expect(s.unitFiles).toContain("packages/sim/src/content/lublin/krakowskie.generated.ts");
    expect(s.reasons.join("\n")).toContain("e2e: packages/sim/src/content/lublin/krakowskie.generated.ts");
  });

  it("a hand-written file of the map's content is the simulation's: tables and unit tests, no e2e", () => {
    expect(scope(["packages/sim/src/content/lublin/roads.ts"], TESTS)).toMatchObject({ tables: true, e2e: false, unit: "related" });
  });

  it("a change of a workflow, a package.json, the lockfile or a tsconfig runs everything", () => {
    for (const f of [".github/workflows/ci.yml", "package.json", "packages/sim/package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json", "packages/ui/tsconfig.json"]) {
      const s = scope(["packages/sim/src/systems/body-system.ts", f], TESTS);
      expect(s, f).toMatchObject({ code: true, e2e: true, unit: "full", unitFiles: [] });
      expect(s.reasons[0], f).toContain(f);
    }
    expect(scope([".github/workflows/ci.yml"], TESTS).tables).toBe(false);
  });

  it("the test runner's settings, the CI's own tools and data/ run every unit test, e2e only when drawn", () => {
    expect(scope(["vitest.config.ts"], TESTS)).toMatchObject({ unit: "full", e2e: false, tables: false });
    expect(scope(["tools/test-time/src/reporter.ts"], TESTS)).toMatchObject({ unit: "full", e2e: false });
    expect(scope(["tools/ci-scope/src/scope.ts"], TESTS)).toMatchObject({ unit: "full", e2e: false });
    expect(scope(["data/osm/lublin.json"], TESTS)).toMatchObject({ unit: "full", e2e: false, tables: true });
    expect(scope(["data/osm/lublin.json", "packages/ui/src/hud.tsx"], TESTS)).toMatchObject({ unit: "full", e2e: true });
  });

  it("a change of docs alone runs nothing", () => {
    expect(scope(["docs/adr/0046-strategia-testow-e2e.md", "changelog.d/x.md", "packages/ui/src/icons/README.md"], TESTS)).toMatchObject({ code: false, tables: false, e2e: false, unit: "none", scan: "none" });
  });

  it("the JSON in docs/ is data tests read (the coverage register, the furniture's list): every unit test and the whole scan", () => {
    for (const f of ["docs/mapa-pokrycie.json", "docs/world/lublin-props.todo.json"]) expect(scope([f], TESTS), f).toMatchObject({ code: true, unit: "full", scan: "full", scanChunks: [] });
  });

  it("an e2e spec or the Playwright settings run e2e and the checks, no unit test", () => {
    const s = scope(["e2e/smoke.spec.ts", "playwright.config.ts", "packages/sim/src/systems/notes.md"], TESTS);
    expect(s).toMatchObject({ code: true, tables: false, e2e: true, unit: "none", unitFiles: [] });
  });

  it("a file tests read from disk runs the tests of its package; a model runs the app's and the engine's", () => {
    expect(scope(["tools/glitch-scan/test/baseline/cut-on-road.txt"], TESTS).unitFiles).toEqual([...SCANS, "tools/glitch-scan/test/cut-on-road.test.ts", "tools/glitch-scan/test/glitch-scan.test.ts"].sort());
    const model = scope(["packages/app/public/city/city-kit.glb"], TESTS);
    expect(model).toMatchObject({ e2e: true, unit: "related" });
    expect(model.unitFiles).toEqual(["packages/app/test/model-manifest.test.ts", "packages/engine/test/city-kit.test.ts", ...SCANS]);
    expect(scope(["tools/assets/sources.json"], TESTS)).toMatchObject({ e2e: true, unitFiles: ["packages/app/test/model-manifest.test.ts", "packages/engine/test/city-kit.test.ts", ...SCANS] });
    expect(scope(["tools/city_kit.py"], TESTS)).toMatchObject({ e2e: false, unitFiles: ["packages/app/test/model-manifest.test.ts", "packages/engine/test/city-kit.test.ts"] });
  });

  it("a file of no known area runs everything", () => {
    expect(scope(["Dockerfile"], TESTS)).toMatchObject({ code: true, e2e: true, unit: "full" });
  });

  it("main, the nightly run and a run by hand run everything; a push of docs alone runs nothing", () => {
    expect(fullScope("nightly")).toEqual({ code: true, tables: true, e2e: true, unit: "full", unitFiles: [], reasons: ["nightly"], scan: "full", scanChunks: [] });
    expect(pushScope(["packages/sim/src/systems/body-system.ts", "docs/backlog.md"])).toMatchObject({ code: true, tables: true, e2e: true, unit: "full" });
    expect(pushScope(["docs/backlog.md"])).toMatchObject({ code: false, e2e: false, unit: "none" });
  });

  it("only a pull request's run with every unit test and every e2e group stands for main's", () => {
    expect(isFull(scope([".github/workflows/ci.yml"], TESTS))).toBe(true);
    expect(isFull(scope(["vitest.config.ts"], TESTS))).toBe(false); // every unit test, no e2e
    expect(isFull(scope(["packages/engine/src/renderer/arm-mesh.ts"], TESTS))).toBe(false); // e2e, related unit tests
    expect(isFull(pushScope(["packages/sim/src/systems/body-system.ts"]))).toBe(true);
  });
});
