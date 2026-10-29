import { expect, test } from "@playwright/test";
import { freeze, gameState, step, teleport, walk, waitForGame } from "./helpers";

/**
 * Plac Łokietka, Brama Krakowska, Bramowa, the Rynek, Grodzka under the footbridge, Brama
 * Grodzka, Zamkowa down to Plac Zamkowy and under the viaduct to the market (ADR-0045).
 */
const ROUTE = [
  [440, -100], [447, -95], [457, -95.6], [472, -91.4], [487, -87.2], [497, -79], [520, -63], [561, -40], [573, -28], [577, -23],
  [610, 14], [637, 47], [685, 112], [708, 134], [722, 147], [730, 155], [739, 174], [725, 193], [720, 203], [720, 267],
  [737, 286], [741, 327],
] as const;

test("walks from Krakowskie through the Old Town into the market without a reload; a save there loads back there", async ({ page }) => {
  // About 500 m of simulated walking, stepped in the page.
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=5&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  // Survives only if the page is never reloaded.
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));

  let s = await gameState(page);
  expect(s.district).toBe("shinsekai-7");
  expect(s.loadedChunks).toEqual(["krakowskie-2-0"]);

  // Out on the deptak by Plac Łokietka: the Old Town is already resident.
  await teleport(page, 400, -97, Math.PI / 2);
  await step(page, 1);
  expect(await walk(page, ROUTE.slice(0, 1))).toBe(1);
  expect((await gameState(page)).loadedChunks).toEqual(["krakowskie-2-0", "stare-miasto-0-0"]);
  expect(await walk(page, ROUTE.slice(1, 7))).toBe(6);
  expect((await gameState(page)).district).toBe("kanal");
  expect(await walk(page, ROUTE.slice(7))).toBe(ROUTE.length - 7);

  s = await gameState(page);
  expect(s.district).toBe("targ");
  expect(s.loadedChunks).not.toContain("krakowskie-2-0");
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);

  // Quicksave in the market, go home, quickload: back in the market with the same chunks.
  await page.keyboard.press("F5");
  await expect(page.getByText("Zapisano grę")).toBeVisible();
  const saved = await gameState(page);
  await teleport(page, 400, -97);
  await step(page, 2);
  expect((await gameState(page)).loadedChunks).toEqual(["krakowskie-2-0"]);
  // Toasts are short-lived and SwiftShader frames under load are not, so wait on state instead.
  await page.keyboard.press("F9");
  await expect.poll(async () => (await gameState(page)).player).toEqual(saved.player);
  const loaded = await gameState(page);
  expect(loaded.district).toBe("targ");
  expect(loaded.loadedChunks).toEqual(saved.loadedChunks);

  expect(errors).toEqual([]);
});
