import { expect, test } from "@playwright/test";
import { freeze, step, waitForGame } from "./helpers";

/**
 * Wave 1 HUD (ADR-0028) in the real page, driven through the debug API: the simulation does
 * not send these events yet, so the test puts them on the bus itself.
 */
test("phone, debrief card and breach from the debug API", async ({ page }) => {
  // The game loads slowly on software WebGL; the HUD part itself takes seconds.
  test.setTimeout(240_000);
  await page.goto("/?seed=7&models=off&audio=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await step(page, 1);

  // A contract text lands as a notification and in the inbox; T opens the phone.
  await page.evaluate(() => window.__seki!.emit("PhoneMessage", { from: "oyaji", kind: "text", knot: "oyaji_closed", priority: "contract" }));
  await expect(page.getByTestId("phone-notice")).toContainText("Oyaji");
  await page.keyboard.press("KeyT");
  await expect(page.getByTestId("phone")).toBeVisible();
  await expect(page.getByTestId("phone-thread")).toContainText("Wróć po ósmej");
  await page.keyboard.press("KeyT");
  await expect(page.getByTestId("phone")).toBeHidden();

  // The debrief card after a paid contract.
  await page.evaluate(() => {
    const seki = window.__seki!;
    seki.emit("ContractCompleted", { contract: { id: "c9", kind: "infiltrate", siteId: "car_wash", targets: 2, reward: 1200, status: "cleared" }, reward: 1200 } as never);
    seki.emit("ContractDebrief", { contractId: "c9", badges: ["ghost", "no_alarm", "untouched", "netrunner"], rank: "S", reward: 1200, bonus: 300, styleBonus: 150, seconds: 254 });
  });
  await expect(page.getByTestId("debrief")).toContainText("Infiltracja");
  await expect(page.getByTestId("debrief-rank")).toContainText("S");
  await expect(page.getByTestId("debrief-total")).toContainText("1650");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("debrief")).toBeHidden();

  // The breach minigame: auto-solve sends one daemon and gives the controls back.
  await page.evaluate(() => window.__seki!.breach("crane"));
  await expect(page.getByTestId("breach")).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(25);
  await page.getByRole("button", { name: "Autorozwiązanie (1 demon)" }).click();
  await expect(page.getByTestId("breach")).toBeHidden();
});
