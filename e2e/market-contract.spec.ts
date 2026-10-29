import { expect, test } from "@playwright/test";
import { freeze, gameState, step, teleport, waitForGame } from "./helpers";

test("Hana on the market hands out a job through the dialogue UI", async ({ page }) => {
  // A cold boot takes about a minute on a CI runner (SwiftShader) and streaming in a district
  // another 20 s: more than the default 90 s.
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=11");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await expect(page.getByTestId("hud")).toBeVisible();
  await freeze(page);

  // Next to Hana's cart; one step streams the market in.
  await teleport(page, 90.5, 74, Math.PI / 2);
  await step(page, 1);
  expect((await gameState(page)).district).toBe("targ");
  await expect(page.getByTestId("prompt")).toContainText("Haną");
  await step(page, 1, { interact: true });
  const dialogue = page.getByTestId("dialogue");
  await expect(dialogue).toContainText("Jestem Hana");
  await dialogue.getByRole("button", { name: /Co trzeba odzyskać/ }).click();
  await expect(dialogue).toContainText("skrzynkę z towarem");
  await dialogue.getByRole("button", { name: /Zakończ rozmowę/ }).click();
  await expect(dialogue).toBeHidden();
  await step(page, 2);
  expect((await gameState(page)).flags).toContain("met_hana");

  // The HUD names the giver once the main quest steps aside for free work; here it still
  // leads with the first quest, so check the toast instead.
  await expect(page.getByText("Nowy kontrakt: Odzyskanie")).toBeVisible();
  expect(errors).toEqual([]);
});
