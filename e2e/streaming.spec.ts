import { type Page, expect, test } from "@playwright/test";
import { freeze, gameState, step, teleport, waitForGame } from "./helpers";

/** Sprints along `yaw` from the current position until `done` holds (or gives up). */
const sprint = async (page: Page, yaw: number, done: (p: { x: number; z: number }) => boolean) => {
  let p = (await gameState(page)).player!;
  await teleport(page, p.x, p.z, yaw);
  for (let i = 0; i < 40 && !done(p); i++) {
    await step(page, 15, { moveZ: 1, sprint: true });
    p = (await gameState(page)).player!;
  }
  expect(done(p)).toBe(true);
};

test("walks from Shinsekai into the market without a reload; a save there loads back there", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=5");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  // Survives only if the page is never reloaded.
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));

  let s = await gameState(page);
  expect(s.district).toBe("shinsekai-7");
  expect(s.loadedChunks).toEqual(["shinsekai-7"]);

  // Through the passage behind the car wash: the street is already resident.
  await teleport(page, 7, 45, 0);
  await step(page, 1);
  expect((await gameState(page)).loadedChunks).toEqual(["shinsekai-7", "kanal"]);
  await sprint(page, 0, (p) => p.z >= 79);
  expect((await gameState(page)).district).toBe("kanal");
  await sprint(page, Math.PI / 2, (p) => p.x >= 69.5);
  await sprint(page, 0, (p) => p.z >= 85);
  await sprint(page, Math.PI / 2, (p) => p.x >= 88);

  s = await gameState(page);
  expect(s.district).toBe("targ");
  expect(s.loadedChunks).toEqual(["kanal", "targ-south", "targ-north"]);
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);

  // Quicksave in the market, go home, quickload: back in the market with the same chunks.
  await page.keyboard.press("F5");
  await expect(page.getByText("Zapisano grę")).toBeVisible();
  const saved = await gameState(page);
  await teleport(page, 0, 0);
  await step(page, 2);
  expect((await gameState(page)).loadedChunks).toEqual(["shinsekai-7"]);
  // Toasts are short-lived and SwiftShader frames under load are not, so wait on state instead.
  await page.keyboard.press("F9");
  await expect.poll(async () => (await gameState(page)).player).toEqual(saved.player);
  const loaded = await gameState(page);
  expect(loaded.district).toBe("targ");
  expect(loaded.loadedChunks).toEqual(saved.loadedChunks);

  expect(errors).toEqual([]);
});
