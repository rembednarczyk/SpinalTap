import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { type Page, expect, test } from "@playwright/test";
import { type Frame, freeze, gameState, perf, place, sampleNow, step, teleport, teleportTo, newGame, waitForGame, waitForPlay } from "./helpers";

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

test("NPR reference frame matches the approved snapshot", async ({ page }) => {
  await page.goto("/?reference");
  await waitForGame(page);
  // The reference frame stops rendering once Lublin round it is built in detail (ADR-0045).
  await page.waitForFunction(() => window.__seki!.still, null, { timeout: 60_000 });
  // Pixels straight from the canvas (ADR-0046): an element screenshot waits for the compositor,
  // which under SwiftShader in CI did not settle within the expect timeout.
  const png = await page.evaluate(() => window.__seki!.capture!());
  expect(Buffer.from(png.slice(png.indexOf(",") + 1), "base64")).toMatchSnapshot("reference-m0.png", { maxDiffPixelRatio: 0.02, threshold: 0.2 });
});

test("reference scene stays within the perf budget", async ({ page }) => {
  await page.goto("/?reference");
  await waitForGame(page);
  // The reference frame draws only its still (G-001): the sample is of the snapshot's frame.
  await page.waitForFunction(() => window.__seki!.still, null, { timeout: 60_000 });
  within("reference", await perf(page));
});

/** Checks a sample against its scene's budget and keeps it for the report. */
function within(scene: string, sample: Awaited<ReturnType<typeof perf>>) {
  record(scene, sample);
  const budget = budgets.scenes[scene]!;
  expect(sample.drawCalls).toBeLessThanOrEqual(budget.drawCalls);
  expect(sample.activeMeshes).toBeLessThanOrEqual(budget.activeMeshes);
}

/** A new game in TPP, the player put at a spot of Lublin (ADR-0045) and walked a little. */
const tppAt = async (page: Page, at: { frame?: Frame; x: number; z: number; y?: number; yaw: number; walk: number }, query = "/?seed=3&models=off") => {
  await page.goto(query);
  await waitForGame(page);
  await newGame(page);
  await waitForPlay(page);
  await freeze(page);
  await step(page, 1, { toggleCamera: true });
  if (at.frame) await teleportTo(page, await place(page, at.frame, at.x, at.z), at.yaw);
  else if (at.y !== undefined) await teleportTo(page, { x: at.x, y: at.y, z: at.z }, at.yaw);
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

test("Aleja Tysiąclecia on Podzamcze in TPP stays within the perf budget", async ({ page }) => {
  // Where the market stood until ADR-0063 moved it to Alchemia: on the avenue, looking west towards Plac Zamkowy.
  await tppAt(page, { x: 795, z: 339, yaw: -Math.PI / 2, walk: 30 });
  expect((await gameState(page)).loadedChunks).not.toContain("krakowskie-2-0");
  within("podzamcze-tpp", await sampleNow(page));
});

test("Alchemia's T1 in TPP stays within the perf budget", async ({ page }) => {
  // On T1 north of the food hall (ADR-0074 stage 1), walking south to its lit front and the way in: the hall in the frame.
  await tppAt(page, { x: 418, z: 78, yaw: Math.PI, walk: 20 });
  expect((await gameState(page)).loadedChunks).toContain("krakowskie-2-1");
  within("alchemia-tpp", await sampleNow(page));
});

test("Alchemia's stairs down to T2 in TPP stays within the perf budget", async ({ page }) => {
  // On the stairs from T1 down to T2 (ADR-0074 stage 2), walking down north-north-east: T2, the Arkady's arches and their upper floor in the frame.
  await tppAt(page, { x: 429.5, z: 79, yaw: 0.25, walk: 20 });
  expect((await gameState(page)).loadedChunks).toContain("krakowskie-2-1");
  within("alchemia-t2-tpp", await sampleNow(page));
});

test("Alchemia's car park P-1 in TPP stays within the perf budget", async ({ page }) => {
  // On P-1 under the car park (ADR-0074 stage 4), on the apron by the ramp's foot walking north-west to the hand-over cabins: the cabins, the deck and the ramp in the frame.
  await tppAt(page, { x: 410, z: 22.5, y: -6.4, yaw: -Math.PI / 4, walk: 12 });
  const s = await gameState(page);
  expect(s.loadedChunks).toContain("krakowskie-2-1");
  within("alchemia-p1", await sampleNow(page));
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
