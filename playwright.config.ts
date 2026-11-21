import { defineConfig, devices } from "@playwright/test";

/** Preview port; E2E_PORT moves it when 4173 is taken (another checkout running its own preview). */
const PORT = Number(process.env.E2E_PORT ?? 4173);

/**
 * CI runs the specs in three groups of about equal time (ADR-0046; the job limit is 25 min).
 * Playwright's own `--shard` splits by test count, which put every slow spec in one shard.
 * Six green runs of main on 17.11 (minutes, fastest-slowest runner; runners differ up to 1.8x):
 * group 1 npr-perf 9.2-12.7, gpu-queue 2.2-3.4, models 0.9-1.5, together 12.4-17.6; group 2
 * smoke 4.2-7.7, fpp-hands 3.3-6.0, together 7.5-13.6; group 3 13.8-23.5, and 24.5 on #663, where
 * the job ran out of time: touch-layout 3.5-6.7, ui-scale 3.4-4.7, graphics-toggles 1.9-3.8,
 * wait-window 1.4-2.8, touch 1.5-2.6, dialogue-fit 0.9-1.8, hud-layout 0.6-0.9. Since 17.11
 * ui-scale runs in group 2: the slowest runner then takes 17.6, 18.4 and 18.8 min, a median one
 * about 15. Group 3 takes everything else, so a new spec always runs. Unset: all specs (local).
 *
 * Four since 21.11: npr-perf grew from 7 scenes to 14 (Alchemia's T1, T2, P-1, P-2, Zielona, W-3
 * twice, the phones), and on a slow runner group 1 ran past the 25 min (main after #856: the TPP
 * scenes 1.4-1.5 min each, gpu-queue 3.6, models 1.8). Group 4 takes the later npr-perf scenes
 * (P-2, Zielona, both W-3, both phones) and gpu-queue; group 1 keeps the reference frame, the
 * first seven scenes and models. On the slow runner of #847 that is about 15 and 12 min.
 */
const GROUP_ONE = /(npr-perf|gpu-queue|models)\.spec\.ts$/;
const GROUP_TWO = /(smoke|fpp-hands|ui-scale)\.spec\.ts$/;
/** The npr-perf scenes and gpu-queue tests of group 4, by title. */
const GROUP_FOUR = /P-2|Zielona|W-3|phone|GPU|WebGL/;
const group = process.env.E2E_GROUP;
const groups =
  group === "1"
    ? { testMatch: GROUP_ONE, grepInvert: GROUP_FOUR }
    : group === "4"
      ? { testMatch: GROUP_ONE, grep: GROUP_FOUR }
      : group === "2"
        ? { testMatch: GROUP_TWO }
        : group === "3"
          ? { testIgnore: [GROUP_ONE, GROUP_TWO] }
          : {};

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
