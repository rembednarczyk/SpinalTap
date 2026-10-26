import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["packages/engine/**", "packages/app/**", "**/index.ts"],
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "reports/coverage",
      thresholds: {
        "packages/core/src/**": { statements: 95, branches: 90, functions: 95, lines: 95 },
        "packages/sim/src/**": { statements: 85, branches: 75, functions: 85, lines: 85 },
        "packages/persistence/src/**": { statements: 85, branches: 80, functions: 85, lines: 85 },
      },
    },
  },
});
