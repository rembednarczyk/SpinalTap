import { expect, test } from "@playwright/test";
import { freeze, gameState, step, teleport, waitForGame } from "./helpers";

const wait = (page: import("@playwright/test").Page, minutes: number) => page.evaluate((m) => window.__seki!.wait(m), minutes);

test("the HUD clock follows game time; Oyaji's stall is closed at night and open by day", async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=5");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);

  const clock = page.getByTestId("clock");
  await expect(clock).toContainText("Dzień 1");
  await expect(clock).toContainText("noc");
  await expect(clock).toContainText(/21:0\d/);

  // Walk up to the market (streams it in), then let the evening pass to after closing time.
  await teleport(page, 40, 78);
  await step(page, 1);
  await wait(page, 90);
  await step(page, 60 * 5);
  const s = await gameState(page);
  expect(s.clock).toMatch(/^22:3\d$/);
  await teleport(page, 74.5, 65.4);
  await step(page, 2);
  await expect(page.getByTestId("prompt")).toContainText("zamknięte");

  // A morning later the closed sign is gone and the clock reads day.
  await wait(page, 10 * 60);
  await step(page, 2);
  await expect(clock).toContainText("dzień");
  await expect(clock).toContainText("Dzień 2");
  await expect(page.getByTestId("prompt")).toHaveCount(0);

  expect(errors).toEqual([]);
});
