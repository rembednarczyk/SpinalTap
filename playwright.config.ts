import { defineConfig, devices } from "@playwright/test";

/** Preview port; E2E_PORT moves it when 4173 is taken (another checkout running its own preview). */
const PORT = Number(process.env.E2E_PORT ?? 4173);

/**
 * CI runs the specs in two groups of about equal time (ADR-0046: two shards; the job limit is
 * 25 min). Playwright's own `--shard` splits by test count, which put every slow spec in shard 1
 * (23 min of 25 before the FPP hands spec, over the limit after it). Group 1 takes the specs
 * named here by their measured times (npr-perf 8.9, smoke 7.0, gpu-queue 2.9, models 1.2 min);
 * group 2 takes everything else, so a new spec always runs. Unset: all specs (local runs).
 */
const GROUP_ONE = /(npr-perf|smoke|gpu-queue|models)\.spec\.ts$/;
const group = process.env.E2E_GROUP;

export default defineConfig({
  testDir: "e2e",
  ...(group === "1" ? { testMatch: GROUP_ONE } : group === "2" ? { testIgnore: GROUP_ONE } : {}),
  timeout: 90_000,
  expect: { timeout: 20_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02, threshold: 0.2 } },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "reports/playwright" }]],
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } }],
  webServer: {
    command: `pnpm --filter @seki/app preview --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
