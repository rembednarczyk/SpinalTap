import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { freeze, perf, step, waitForGame } from "./helpers";

const budgets = JSON.parse(readFileSync("tools/perf-budgets.json", "utf8")) as {
  scenes: Record<string, { drawCalls: number; activeMeshes: number }>;
  frameTimeMs: number;
};
const report: Record<string, unknown> = {};

test.afterAll(() => {
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/perf.json", JSON.stringify(report, null, 2));
});

test("NPR reference frame matches the approved snapshot", async ({ page }) => {
  await page.goto("/?reference");
  await waitForGame(page);
  await page.waitForTimeout(800);
  await expect(page.locator("#game-canvas")).toHaveScreenshot("reference-m0.png");
});

test("reference scene stays within the perf budget", async ({ page }) => {
  await page.goto("/?reference");
  await waitForGame(page);
  await page.waitForTimeout(1500);
  const sample = await perf(page);
  report.reference = sample;
  expect(sample.drawCalls).toBeLessThanOrEqual(budgets.scenes.reference!.drawCalls);
  expect(sample.activeMeshes).toBeLessThanOrEqual(budgets.scenes.reference!.activeMeshes);
  expect(sample.frameTimeMs).toBeLessThanOrEqual(budgets.frameTimeMs);
});

test("street view in TPP stays within the perf budget", async ({ page }) => {
  await page.goto("/?seed=3");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await step(page, 1, { toggleCamera: true });
  await step(page, 60, { moveZ: 1 });
  await page.waitForTimeout(1500);
  const sample = await perf(page);
  report["street-tpp"] = sample;
  expect(sample.drawCalls).toBeLessThanOrEqual(budgets.scenes["street-tpp"]!.drawCalls);
  expect(sample.activeMeshes).toBeLessThanOrEqual(budgets.scenes["street-tpp"]!.activeMeshes);
  expect(sample.frameTimeMs).toBeLessThanOrEqual(budgets.frameTimeMs);
});
