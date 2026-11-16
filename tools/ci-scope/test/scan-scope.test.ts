import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GLITCH_SCAN, importClosure } from "../src/imports.ts";
import { scope } from "../src/scope.ts";

/** Which part of the city a pull request's glitch scan compares (`scan-scope.ts`, decision of the user 16.11). */

const ROOT = join(__dirname, "../../..");
const READS = importClosure(ROOT, [GLITCH_SCAN]);
const reads = (f: string) => READS.has(f);
const TESTS = ["tools/glitch-scan/test/glitch-scan.test.ts", "packages/engine/test/city-kit.test.ts", "packages/ui/test/hud.test.tsx"];
const TABLE = (d: string) => `packages/sim/src/content/lublin/${d}.generated.ts`;

describe("the glitch scan's part of a pull request (ADR-0054)", () => {
  it("the tables of one district: its chunks", () => {
    const s = scope([TABLE("krakowskie")], TESTS, reads);
    expect(s).toMatchObject({ unit: "related", scan: "chunks", scanChunks: ["krakowskie"] });
    expect(s.reasons.join("\n")).toContain("glitch scan: the chunks of krakowskie and their neighbours");
  });

  it("the tables of several districts, with docs and a file the scan does not read: their chunks", () => {
    const s = scope([TABLE("stare-miasto"), TABLE("podzamcze"), "docs/backlog.md", "packages/ui/src/hud.tsx"], TESTS, reads);
    expect(s).toMatchObject({ scan: "chunks", scanChunks: ["podzamcze", "stare-miasto"] });
  });

  it("the generator, the scan's code or base, the furniture's shared table or the sources: the whole city", () => {
    for (const f of ["tools/osm-import/src/kerbside.ts", "tools/glitch-scan/test/kerb-jag.ts", "tools/glitch-scan/src/scan-keys.ts", "tools/glitch-scan/test/baseline/kerb-jag.txt", TABLE("props"), "packages/sim/src/content/lublin/sites.ts"]) {
      const s = scope([TABLE("krakowskie"), f], TESTS, reads);
      expect(s, f).toMatchObject({ scan: "full", scanChunks: [] });
      expect(s.reasons.join("\n"), f).toContain(`glitch scan: whole city (it reads ${f}`);
    }
    expect(scope(["data/osm/krakowskie.json"], TESTS, reads)).toMatchObject({ unit: "full", scan: "full" });
  });

  it("a part of the renderer the scan does not read, the UI or an e2e spec: no scan", () => {
    for (const f of ["packages/engine/src/renderer/babylon-renderer.ts", "packages/ui/src/hud.tsx", "e2e/smoke.spec.ts"]) expect(scope([f], TESTS, reads).scan, f).toBe("none");
  });

  it("a part of the renderer the scan imports (the map city's plans): the whole city", () => {
    expect(scope(["packages/engine/src/renderer/mapcity/facade-plan.ts"], TESTS, reads)).toMatchObject({ scan: "full" });
  });

  it("every unit test (the runner's settings, shared files, a file of no known area): the whole city, tables or not", () => {
    for (const f of ["vitest.config.ts", "pnpm-lock.yaml", "Dockerfile"]) expect(scope([TABLE("krakowskie"), f], TESTS, reads), f).toMatchObject({ unit: "full", scan: "full", scanChunks: [] });
  });

  it("follows the scan's imports into the workspace's packages and the import's code, not into the UI or the app", () => {
    for (const f of [GLITCH_SCAN, "tools/glitch-scan/src/scan-keys.ts", "tools/glitch-scan/src/scan-chunks.ts", "packages/core/src/index.ts", "packages/sim/src/content/lublin/index.ts", TABLE("krakowskie"), TABLE("props"), "tools/osm-import/src/kerbside.ts"])
      expect(READS.has(f), f).toBe(true);
    expect([...READS].filter((f) => /^packages\/(ui|app|narrative|persistence)\//.test(f))).toEqual([]);
  });
});
