import { describe, expect, it } from "vitest";
import { madeFindings, makerInputs } from "./scan-cache";

// The process starts before this one loads the city's modules, cold as in CI, and runs meanwhile.
const CHUNK = "podzamcze-1-0";
const made = madeFindings("walk-blocked", CHUNK);
made.catch(() => undefined);
const { SCAN_MAKERS } = await import("./scan-makers");

/**
 * The scan's kinds computed in a process of their own (`scan-cache.ts`) find what the test's own
 * process finds: the same modules loaded by Node through `node-resolve.ts` and its transform of
 * types, not Vite's, and the findings back through `node:v8`. On one chunk, a slope by the steps of
 * Podzamcze with 11 findings (the whole city's are in the scan, `glitch-scan.test.ts`).
 */
describe("the scan's kinds from a process of their own (scan-cache.ts)", () => {
  it("finds the walk-blocked of a chunk the test's process finds", async () => {
    const own = SCAN_MAKERS["walk-blocked"](CHUNK);
    expect(own.length).toBeGreaterThan(0);
    expect(await made).toEqual(own);
  });

  it("keys the cache by the modules the maker loads and the data it reads", () => {
    const inputs = makerInputs();
    for (const f of [
      "tools/glitch-scan/test/scan-make.ts",
      "tools/glitch-scan/test/walk-blocked.ts",
      "tools/glitch-scan/test/walk-world.ts",
      "packages/sim/src/world/walk.ts",
      "packages/sim/src/content/lublin/podzamcze.generated.ts",
      "packages/core/src/index.ts",
      "tools/osm-import/src/features.ts",
      "data/osm/podzamcze.json",
    ])
      expect(inputs, f).toContain(f);
    expect(inputs.filter((f) => f.startsWith("node_modules/"))).toEqual([]);
  });
});
