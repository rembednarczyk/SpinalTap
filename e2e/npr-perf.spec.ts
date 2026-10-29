import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { type Page, expect, test } from "@playwright/test";
import { type Frame, freeze, gameState, perf, place, step, teleport, teleportTo, waitForGame } from "./helpers";

const budgets = JSON.parse(readFileSync("tools/perf-budgets.json", "utf8")) as {
  scenes: Record<string, { drawCalls: number; activeMeshes: number }>;
};

/**
 * Keeps a sample in reports/perf.json at once, so a failed test (which restarts the worker)
 * does not lose the others'. Frame time is reported, not checked: under SwiftShader it measures
 * the runner, not the game (ADR-0046).
 */
const record = (scene: string, sample: unknown) => {
  mkdirSync("reports", { recursive: true });
  const file = "reports/perf.json";
  const report = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) : {};
  writeFileSync(file, JSON.stringify({ ...report, [scene]: sample }, null, 2));
};

/** The draw calls and meshes of the frame just drawn, after the test stepped the game and the city settled. */
const sampleNow = async (page: Page) => {
  await page.waitForFunction(() => window.__seki!.citySettled(), null, { timeout: 60_000 });
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  return perf(page);
};

test("NPR reference frame matches the approved snapshot", async ({ page }) => {
  await page.goto("/?reference");
  await waitForGame(page);
  // The reference frame stops rendering once Lublin round it is built in detail (ADR-0045).
  await page.waitForFunction(() => window.__seki!.still, null, { timeout: 60_000 });
  await expect(page.locator("#game-canvas")).toHaveScreenshot("reference-m0.png");
});

test("reference scene stays within the perf budget", async ({ page }) => {
  await page.goto("/?reference");
  await waitForGame(page);
  within("reference", await sampleNow(page));
});

/** Checks a sample against its scene's budget and keeps it for the report. */
function within(scene: string, sample: Awaited<ReturnType<typeof perf>>) {
  record(scene, sample);
  const budget = budgets.scenes[scene]!;
  expect(sample.drawCalls).toBeLessThanOrEqual(budget.drawCalls);
  expect(sample.activeMeshes).toBeLessThanOrEqual(budget.activeMeshes);
}

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
  within("krakowskie-tpp", await sampleNow(page));
});

test("the Rynek in TPP stays within the perf budget", async ({ page }) => {
  // Up Bramowa from Brama Krakowska onto the Rynek, the Trybunał ahead.
  await tppAt(page, { x: 520, z: -63, yaw: Math.atan2(41, 23), walk: 60 });
  expect((await gameState(page)).district).toBe("kanal");
  within("rynek-tpp", await sampleNow(page));
});

test("the market under the viaduct in TPP stays within the perf budget", async ({ page }) => {
  // East end of the market, looking back west over the stalls, under the deck towards the gate.
  await tppAt(page, { frame: "market", x: 106, z: 79, yaw: -Math.PI / 2, walk: 30 });
  expect((await gameState(page)).loadedChunks).not.toContain("krakowskie-2-0");
  within("podzamcze-tpp", await sampleNow(page));
});

test("Nabrzeże Bystrzycy at night in TPP stays within the perf budget", async ({ page }) => {
  // East end of the quay, looking west along the fence: water and mist, the crane, the office.
  await tppAt(page, { frame: "docks", x: 27, z: 145, yaw: -Math.PI / 2, walk: 30 });
  expect((await gameState(page)).loadedChunks).toEqual(["nabrzeze-1-1"]);
  within("nabrzeze", await sampleNow(page));
});

test("a phone (low quality, 800x370) on the deptak stays within the perf budget", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 370 });
  await tppAt(page, { x: 270, z: -81, yaw: Math.PI / 2, walk: 60 }, "/?seed=3&models=off&quality=low&touch");
  within("phone-low", await sampleNow(page));
});
