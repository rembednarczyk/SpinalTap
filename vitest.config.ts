import { configDefaults, defineConfig } from "vitest/config";

// G-376: CI runs the suite in shards (`--shard`, blob reports) and checks the thresholds once,
// on the merged coverage (`--merge-reports`). A shard covers only part of the code, so it
// skips the thresholds; locally and in the merge they apply as before.
const shard = process.env.VITEST_COVERAGE_SHARD === "1";

// Without isolation a worker keeps its module cache from file to file: the city tables
// (`content/lublin/*.generated.ts`) are evaluated once a worker, not again for every file, which
// cost 5-6 s a file under coverage (docs/plany/czas-testow.md). Only for packages whose tests
// leave nothing behind for the next file, checked by shuffled runs; Vitest still restores mocks
// between files. The rest, and any new package, stays isolated: ui and app (jsdom, React) and
// narrative (its `vi.mock` of inkjs counts compilations that a shared worker's cache already holds).
const SHARED = ["core", "sim", "engine", "persistence"].map((p) => `packages/${p}/test/**/*.test.{ts,tsx}`);

export default defineConfig({
  test: {
    projects: [
      { extends: true, test: { name: "shared", include: [...SHARED, "tools/*/test/**/*.test.ts"], isolate: false } },
      { extends: true, test: { name: "isolated", include: ["packages/*/test/**/*.test.{ts,tsx}"], exclude: [...configDefaults.exclude, ...SHARED] } },
    ],
    environment: "node",
    // The app and sim loop tests play whole acts and contracts: well under a second on a free
    // machine, but past the default 5 s when other test runs share the CPU. A real hang still fails.
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["packages/engine/**", "packages/app/**", "**/index.ts"],
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "reports/coverage",
      thresholds: shard ? undefined : {
        "packages/core/src/**": { statements: 95, branches: 90, functions: 95, lines: 95 },
        // Items are pure rules with many edge cases (plan E1): every branch is tested.
        "packages/core/src/items/**": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "packages/sim/src/**": { statements: 85, branches: 75, functions: 85, lines: 85 },
        "packages/persistence/src/**": { statements: 85, branches: 80, functions: 85, lines: 85 },
      },
    },
  },
});
