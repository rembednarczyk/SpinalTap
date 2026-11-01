import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { type Page, expect, test } from "@playwright/test";
import { type Frame, freeze, gameState, perf, place, step, teleport, teleportTo, waitForGame, waitForPlay } from "./helpers";

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
  // `citySettled()` is the renderer's last frame, which may still be before the step (G-013): its
  // new district and chunk dressing set the wet probe off only in the next one (G-114). The frame
  // count and the probe's renders as of the frame the city settled in, read together.
  const stepped = await page.evaluate(() => window.__seki!.frames!());
  const settled = await page.waitForFunction(
    (n) => window.__seki!.frames!() > n && window.__seki!.citySettled() && [window.__seki!.frames!(), window.__seki!.probeRenders!()],
    stepped,
    { timeout: 60_000 },
  );
  const [drawn, probed] = (await settled.jsonValue()) as [number, number | null];
  // Two frames drawn after it: an animation frame may skip the draw while the GPU catches up (G-029).
  await page.waitForFunction((n) => window.__seki!.frames!() >= n + 2, drawn, { timeout: 30_000 });
  const sample = await perf(page);
  // A wet-probe render after the city settled puts its six faces, some hundred draw calls, into
  // the sampled frame (G-114): settled includes the probe, so none may come after it.
  expect(await page.evaluate(() => window.__seki!.probeRenders!())).toBe(probed);
  return sample;
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
const tppAt = async (page: Page, at: { frame?: Frame; x: number; z: number; yaw: number; walk: number }, query = "/?seed=3&models=off") => {
  await page.goto(query);
  await waitForGame(page);
  await page.getByRole("button", { name: "New Game" }).click();
  await waitForPlay(page);
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
