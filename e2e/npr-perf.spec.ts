import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { type Page, expect, test } from "@playwright/test";
import { freeze, gameState, perf, step, teleport, waitForGame } from "./helpers";

const budgets = JSON.parse(readFileSync("tools/perf-budgets.json", "utf8")) as {
  scenes: Record<string, { drawCalls: number; activeMeshes: number }>;
  frameTimeMs: number;
};
const report: Record<string, unknown> = {};

/**
 * A sample once the scene has settled: frame time is a one-second average, and the first frames
 * after streaming in a district (kit models, shader compiles) can take seconds on a SwiftShader
 * runner. Waits up to 15 s for it to drop to the budget, so only a lasting overrun fails.
 */
const settledPerf = async (page: Page) => {
  await page.waitForTimeout(1500);
  const deadline = Date.now() + 15_000;
  let sample = await perf(page);
  while (sample.frameTimeMs > budgets.frameTimeMs && Date.now() < deadline) {
    await page.waitForTimeout(500);
    sample = await perf(page);
  }
  return sample;
};

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
  const sample = await settledPerf(page);
  report.reference = sample;
  expect(sample.drawCalls).toBeLessThanOrEqual(budgets.scenes.reference!.drawCalls);
  expect(sample.activeMeshes).toBeLessThanOrEqual(budgets.scenes.reference!.activeMeshes);
  expect(sample.frameTimeMs).toBeLessThanOrEqual(budgets.frameTimeMs);
});

test("street view in TPP stays within the perf budget", async ({ page }) => {
  await page.goto("/?seed=3&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await step(page, 1, { toggleCamera: true });
  // Out on the street where a new game started before ADR-0038 (it now wakes up in the clinic).
  await teleport(page, 0, -28, 0);
  await step(page, 60, { moveZ: 1 });
  const sample = await settledPerf(page);
  report["street-tpp"] = sample;
  expect(sample.drawCalls).toBeLessThanOrEqual(budgets.scenes["street-tpp"]!.drawCalls);
  expect(sample.activeMeshes).toBeLessThanOrEqual(budgets.scenes["street-tpp"]!.activeMeshes);
  expect(sample.frameTimeMs).toBeLessThanOrEqual(budgets.frameTimeMs);
});

test("market under the overpass in TPP stays within the perf budget", async ({ page }) => {
  await page.goto("/?seed=3&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await step(page, 1, { toggleCamera: true });
  // East end of the market, looking back west over the stalls, under the deck towards the gate.
  await teleport(page, 106, 79, -Math.PI / 2);
  await step(page, 30, { moveZ: 1 });
  expect((await gameState(page)).loadedChunks).not.toContain("shinsekai-7");
  const sample = await settledPerf(page);
  report["market-tpp"] = sample;
  expect(sample.drawCalls).toBeLessThanOrEqual(budgets.scenes["market-tpp"]!.drawCalls);
  expect(sample.activeMeshes).toBeLessThanOrEqual(budgets.scenes["market-tpp"]!.activeMeshes);
  expect(sample.frameTimeMs).toBeLessThanOrEqual(budgets.frameTimeMs);
});

test("docks at night in TPP stay within the perf budget", async ({ page }) => {
  await page.goto("/?seed=3&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await step(page, 1, { toggleCamera: true });
  // East end of the quay, looking west along the fence: water and mist, the crane, the office.
  await teleport(page, 27, 145, -Math.PI / 2);
  await step(page, 30, { moveZ: 1 });
  const loaded = (await gameState(page)).loadedChunks;
  expect(loaded).toEqual(["doki-yard", "doki-quay"]);
  const sample = await settledPerf(page);
  report.docks = sample;
  expect(sample.drawCalls).toBeLessThanOrEqual(budgets.scenes.docks!.drawCalls);
  expect(sample.activeMeshes).toBeLessThanOrEqual(budgets.scenes.docks!.activeMeshes);
  expect(sample.frameTimeMs).toBeLessThanOrEqual(budgets.frameTimeMs);
});
