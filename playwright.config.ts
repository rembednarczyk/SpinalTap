import { defineConfig, devices } from "@playwright/test";

/** Preview port; E2E_PORT moves it when 4173 is taken (another checkout running its own preview). */
const PORT = Number(process.env.E2E_PORT ?? 4173);

/**
 * CI runs the specs in three groups of about equal time (ADR-0046; the job limit is 25 min).
 * Playwright's own `--shard` splits by test count, which put every slow spec in one shard. Two
 * groups were not enough on 15.11: with the FPP hands spec in group 1 it took 24.7 min (npr-perf,
 * smoke, gpu-queue, models, fpp-hands) against 14.7 in group 2, and the job ran out of time.
 * Group 1: npr-perf 9.0, gpu-queue 2.9, models 1.2 min. Group 2: smoke 5.6, fpp-hands 4.3-5.0 min.
 * Group 3 takes everything else (14.7 min), so a new spec always runs. Unset: all specs (local).
 */
const GROUP_ONE = /(npr-perf|gpu-queue|models)\.spec\.ts$/;
const GROUP_TWO = /(smoke|fpp-hands)\.spec\.ts$/;
const group = process.env.E2E_GROUP;
const groups = group === "1" ? { testMatch: GROUP_ONE } : group === "2" ? { testMatch: GROUP_TWO } : group === "3" ? { testIgnore: [GROUP_ONE, GROUP_TWO] } : {};

export default defineConfig({
  testDir: "e2e",
  ...groups,
  timeout: 90_000,
  expect: { timeout: 20_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02, threshold: 0.2 } },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // On CI the github reporter adds each failure as a short annotation on the check run.
  reporter: [["list"], ["html", { open: "never", outputFolder: "reports/playwright" }], ...(process.env.CI ? ([["github"]] as const) : [])],
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
