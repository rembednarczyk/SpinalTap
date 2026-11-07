import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { freeze, sampleNow, step, newGame, waitForGame, waitForPlay } from "./helpers";

/** The whole cast dressed (ADR-0046): its budget sits with the scenes' in `tools/perf-budgets.json`. */
const budget = (JSON.parse(readFileSync("tools/perf-budgets.json", "utf8")) as { scenes: Record<string, { drawCalls: number; activeMeshes: number }> }).scenes["models"]!;

test("placeholder VRoid cast dresses the characters", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=11");
  await waitForGame(page);
  await newGame(page, "click", 60_000);
  await waitForPlay(page);
  await freeze(page);
  await step(page, 1, { toggleCamera: true });
  // Measured once every character in the scene is dressed, not after the first (ADR-0046).
  await page.waitForFunction(() => window.__seki!.dressed() > 0 && window.__seki!.modelsLoading() === 0, null, { timeout: 90_000 });
  await step(page, 10, { moveZ: 1 });
  await page.waitForFunction(() => window.__seki!.modelsLoading() === 0, null, { timeout: 30_000 });
  await step(page, 1);
  // A frame drawn after the steps (G-495): the last one drawn before them may be the start's,
  // with no active meshes, and read at once it passed any draw-call budget.
  const perf = await sampleNow(page);
  const dressed = await page.evaluate(() => window.__seki!.dressed());
  test.info().annotations.push({ type: "models", description: `${dressed} dressed, ${perf.drawCalls} draw calls, ${perf.activeMeshes} active meshes` });
  // A new game wakes in the clinic in Lublin (ADR-0045) with Kaito, Mori, the Neon Koi cast and
  // the passers-by of the deptak in range, every one of them dressed.
  expect(perf.activeMeshes).toBeGreaterThan(0);
  expect(perf.drawCalls).toBeLessThanOrEqual(budget.drawCalls);
  expect(perf.activeMeshes).toBeLessThanOrEqual(budget.activeMeshes);
  expect(errors).toEqual([]);
});
