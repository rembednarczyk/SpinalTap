import { describe, expect, it } from "vitest";
import { makerInputs } from "./scan-cache";

/**
 * The key of the scan's kinds computed in a process of their own (`scan-cache.ts`). That the
 * process finds what the test's own process finds is the scan's to hold, on a chunk, beside the
 * kind's findings it awaits anyway (`glitch-scan.test.ts`): no second process of the city.
 */
describe("the scan's kinds from a process of their own (scan-cache.ts)", () => {
  it("keys the cache by the modules the maker loads and the data it reads", () => {
    const inputs = makerInputs();
    for (const f of [
      "tools/glitch-scan/test/scan-make.ts",
      "tools/glitch-scan/test/walk-blocked.ts",
      "tools/glitch-scan/test/walk-world.ts",
      "tools/glitch-scan/test/patrol-pieces.ts",
      "packages/engine/src/renderer/drones/patrol-pool.ts",
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
