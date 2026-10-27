import { type Page, expect, test } from "@playwright/test";
import { freeze, gameState, step, teleport, waitForGame } from "./helpers";

const wait = (page: Page, minutes: number) => page.evaluate((m) => window.__seki!.wait(m), minutes);

test("by day Oyaji's stall buys a medkit through the Sprzedaj tab", async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=5");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);

  // To the market, then on to noon of the next day: the stall is up and Oyaji stands behind it.
  await teleport(page, 40, 78);
  await step(page, 1);
  await wait(page, 15 * 60);
  await step(page, 2);
  expect((await gameState(page)).clock).toMatch(/^12:0\d$/);
  const oyaji = await page.evaluate(() => {
    const e = [...window.__seki!.session.sim.world].find((x) => x.key === "oyaji")!;
    return { x: e.position.x, z: e.position.z };
  });
  await teleport(page, oyaji.x, oyaji.z - 1.4);
  await step(page, 1);
  await expect(page.getByTestId("prompt")).toContainText("Stragan Oyajiego");
  await step(page, 1, { interact: true });

  const shop = page.getByTestId("shop");
  await expect(shop).toBeVisible();
  await expect(shop).toContainText("Oyaji");
  const before = (await gameState(page)).eddies;
  await shop.getByRole("tab", { name: "Sprzedaj" }).click();
  const medkit = shop.getByTestId("shop-sell-line").filter({ hasText: "Apteczka" });
  await expect(medkit).toBeVisible();
  await medkit.getByRole("button", { name: /Sprzedaj · 22 €\$/ }).click();
  await step(page, 1);
  expect((await gameState(page)).eddies).toBe(before + 22);
  await expect(page.getByTestId("gear")).not.toContainText("Apteczki × 1");
  await expect(shop.getByTestId("shop-sell-line").filter({ hasText: "Apteczka" })).toHaveCount(0);

  await shop.getByRole("button", { name: /Odejdź od straganu/ }).click();
  await expect(shop).toBeHidden();
  await step(page, 1);
  expect((await gameState(page)).dialogue).toBe(false);
  expect(errors).toEqual([]);
});
