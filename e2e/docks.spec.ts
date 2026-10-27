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

test("walks from Ulica Kanałowa into the docks without a reload and takes Genzō's job in the dialogue", async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=13&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await expect(page.getByTestId("hud")).toBeVisible();
  await freeze(page);
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));

  // On the street, south of the passage in its north row.
  await teleport(page, 27, 77, 0);
  await step(page, 1);
  expect((await gameState(page)).district).toBe("kanal");
  // Through the passage and up to Genzō's corner on foot.
  await sprint(page, 0, (p) => p.z >= 95);
  let s = await gameState(page);
  expect(s.district).toBe("doki");
  expect(s.loadedChunks).toContain("doki-yard");
  expect(s.loadedChunks).not.toContain("shinsekai-7");
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);

  // Genzō stands by his container office.
  await teleport(page, 20.9, 95.8, 0);
  await step(page, 1);
  await expect(page.getByTestId("prompt")).toContainText("Genzō");
  await step(page, 1, { interact: true });
  const dialogue = page.getByTestId("dialogue");
  await expect(dialogue).toContainText("Pływam nocą");
  await dialogue.getByRole("button", { name: /Kogo trzeba przeprowadzić/ }).click();
  await expect(dialogue).toContainText("Mika");
  await dialogue.getByRole("button", { name: /Zakończ rozmowę/ }).click();
  await expect(dialogue).toBeHidden();
  await step(page, 2);
  s = await gameState(page);
  expect(s.flags).toContain("met_genzo");
  await expect(page.getByText("Nowy kontrakt: Eskorta")).toBeVisible();
  await expect(page.getByTestId("minimap")).toBeVisible();
  expect(errors).toEqual([]);
});
