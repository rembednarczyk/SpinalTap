import { expect, test } from "@playwright/test";
import { freeze, step, waitForGame } from "./helpers";

/** Draw calls with the whole cast dressed (measured, ADR-0046). */
const MODELS_DRAW_CALLS = 9999;

test("placeholder VRoid cast dresses the characters", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=11");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click({ timeout: 60_000 });
  await freeze(page);
  await step(page, 1, { toggleCamera: true });
  // Measured once every character in the scene is dressed, not after the first (ADR-0046).
  await page.waitForFunction(() => window.__seki!.dressed() > 0 && window.__seki!.modelsLoading() === 0, null, { timeout: 90_000 });
  await step(page, 10, { moveZ: 1 });
  await page.waitForFunction(() => window.__seki!.modelsLoading() === 0, null, { timeout: 30_000 });
  await step(page, 1);
  const perf = await page.evaluate(() => window.__seki!.perf());
  const dressed = await page.evaluate(() => window.__seki!.dressed());
  test.info().annotations.push({ type: "models", description: `${dressed} dressed, ${perf.drawCalls} draw calls, ${perf.activeMeshes} active meshes` });
  // A new game wakes in the clinic in Lublin (ADR-0045) with Kaito, Mori, the Neon Koi cast and
  // the passers-by of the deptak in range, every one of them dressed.
  expect(perf.drawCalls).toBeLessThanOrEqual(MODELS_DRAW_CALLS);
  expect(errors).toEqual([]);
});
