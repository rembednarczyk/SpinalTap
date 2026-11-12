/**
 * The ground measurement of ADR-0078, run by hand (`pnpm --filter @seki/osm-import bench:ground`):
 * it generates a district twice and is not part of `pnpm test`.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL("../../..", import.meta.url)),
  test: { include: ["tools/osm-import/bench/**/*.measure.ts"], environment: "node", testTimeout: 600_000 },
});
