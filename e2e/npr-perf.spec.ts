import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { type Page, expect, test } from "@playwright/test";
import { type Frame, freeze, gameState, perf, place, step, teleport, teleportTo, waitForGame } from "./helpers";

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

/** Checks a sample against its scene's budget and keeps it for the report. */
const within = (scene: string, sample: Awaited<ReturnType<typeof perf>>) => {
  report[scene] = sample;
  const budget = budgets.scenes[scene]!;
  expect(sample.drawCalls).toBeLessThanOrEqual(budget.drawCalls);
  expect(sample.activeMeshes).toBeLessThanOrEqual(budget.activeMeshes);
  expect(sample.frameTimeMs).toBeLessThanOrEqual(budgets.frameTimeMs);
};

/** A new game in TPP, the player put at a spot of Lublin (ADR-0045) and walked a little. */
const tppAt = async (page: Page, at: { frame?: Frame; x: number; z: number; yaw: number; walk: number }, query = "/?seed=3&models=off") => {
  await page.goto(query);
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await step(page, 1, { toggleCamera: true });
  if (at.frame) await teleportTo(page, await place(page, at.frame, at.x, at.z), at.yaw);
  else await teleport(page, at.x, at.z, at.yaw);
  await step(page, at.walk, { moveZ: 1 });
};

test("Krakowskie Przedmieście in TPP stays within the perf budget", async ({ page }) => {
  // The deptak west of the clinic and Neon Koi, walking east between the tenements.
  await tppAt(page, { x: 270, z: -81, yaw: Math.PI / 2, walk: 60 });
  expect((await gameState(page)).district).toBe("shinsekai-7");
  within("krakowskie-tpp", await settledPerf(page));
});

test("the Rynek in TPP stays within the perf budget", async ({ page }) => {
  // Up Bramowa from Brama Krakowska onto the Rynek, the Trybunał ahead.
  await tppAt(page, { x: 520, z: -63, yaw: Math.atan2(41, 23), walk: 60 });
  expect((await gameState(page)).district).toBe("kanal");
  within("rynek-tpp", await settledPerf(page));
});

test("the market under the viaduct in TPP stays within the perf budget", async ({ page }) => {
  // East end of the market, looking back west over the stalls, under the deck towards the gate.
  await tppAt(page, { frame: "market", x: 106, z: 79, yaw: -Math.PI / 2, walk: 30 });
  expect((await gameState(page)).loadedChunks).not.toContain("krakowskie-2-0");
  within("podzamcze-tpp", await settledPerf(page));
});

test("Nabrzeże Bystrzycy at night in TPP stays within the perf budget", async ({ page }) => {
  // East end of the quay, looking west along the fence: water and mist, the crane, the office.
  await tppAt(page, { frame: "docks", x: 27, z: 145, yaw: -Math.PI / 2, walk: 30 });
  expect((await gameState(page)).loadedChunks).toEqual(["nabrzeze-1-1"]);
  within("nabrzeze", await settledPerf(page));
});

test("a phone (low quality, 800x370) on the deptak stays within the perf budget", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 370 });
  await tppAt(page, { x: 270, z: -81, yaw: Math.PI / 2, walk: 60 }, "/?seed=3&models=off&quality=low&touch");
  within("phone-low", await settledPerf(page));
});
