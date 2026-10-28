import { expect, test } from "@playwright/test";
import { freeze, gameState, step, teleport, waitForGame } from "./helpers";

test("the weapon strip counts rounds down and the pistol reloads on R", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=7");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await step(page, 1);

  const ammo = page.getByTestId("weapon-ammo");
  await expect(ammo).toContainText("12 / 48");
  await expect(page.getByTestId("weapon-strip")).toContainText("Unity-9");
  // About five shots at 0.28 s each.
  await step(page, 80, { fire: true });
  await expect(ammo).not.toContainText("12 / 48");
  await step(page, 1, { reload: true });
  await expect(ammo).toContainText("przeładowanie");
  await step(page, 90);
  await expect(ammo).toContainText(/12 \/ (4[0-4])/);
  expect(errors).toEqual([]);
});

test("a killed ganger leaves a bag; E opens it and Weź wszystko empties it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=7");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await step(page, 1);

  // Down the guard in the alley and walk up to its bag.
  await page.evaluate(() => {
    const guard = [...window.__seki!.session.sim.world].find((e) => e.key === "guard")!;
    guard.health = { current: 0, max: guard.health!.max };
  });
  await step(page, 2);
  // The street's stashes (ADR-0026) are containers too: pick the guard's bag by key.
  const bag = await page.evaluate(() => window.__seki!.session.sim.domain.loot.containers.find((c) => c.key === "loot:guard") ?? null);
  expect(bag?.key).toBe("loot:guard");
  const before = (await gameState(page)).eddies;
  await teleport(page, bag!.position.x, bag!.position.z - 1);
  await step(page, 1);
  await expect(page.getByTestId("prompt")).toContainText("Przeszukaj");
  await step(page, 1, { interact: true });

  const panel = page.getByTestId("loot");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Torba gangera");
  await expect(panel.getByTestId("loot-line").first()).toContainText("€$");
  await panel.getByTestId("loot-take-all").click();
  await step(page, 2);
  await expect(panel).toBeHidden();
  expect((await gameState(page)).eddies).toBeGreaterThan(before);
  expect(await page.evaluate(() => window.__seki!.session.sim.domain.loot.containers.some((c) => c.key === "loot:guard"))).toBe(false);
  expect((await gameState(page)).dialogue).toBe(false);
  expect(errors).toEqual([]);
});
