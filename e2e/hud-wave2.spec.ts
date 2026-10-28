import { expect, test } from "@playwright/test";
import { freeze, step, waitForGame } from "./helpers";

/**
 * Wave 2 HUD (ADR-0035) in the real page, driven through the debug API: the line map, the
 * ride, the radio, buffs and the disguise. Events the simulation does not send yet are put on
 * the bus by the test.
 */
test("metro, radio and the wave 2 badges from the debug API", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/?seed=7&models=off&audio=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await step(page, 1);

  // The kiosk's line map, left with Esc.
  await page.evaluate(() => window.__seki!.metro("shinsekai"));
  await expect(page.getByTestId("metro-map")).toBeVisible();
  await expect(page.getByTestId("metro-stop-shinsekai")).toContainText("Jesteś tutaj");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("metro-map")).toBeHidden();

  // The ride with an ink subtitle, until the train arrives.
  await page.evaluate(() => window.__seki!.emit("MetroDeparted", { from: "shinsekai", to: "doki", seconds: 6 }));
  await expect(page.getByTestId("metro-ride")).toContainText("Doki Tessen");
  await expect(page.getByTestId("metro-caption")).not.toBeEmpty();
  await page.evaluate(() => window.__seki!.emit("MetroArrived", { station: "doki" }));
  await expect(page.getByTestId("metro-ride")).toBeHidden();

  // B tunes the radio; the phone shows the station picked (the toast is gone in a few seconds).
  await page.keyboard.press("KeyB");
  await page.keyboard.press("KeyT");
  await expect(page.getByTestId("radio-drift")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("KeyT");
  await expect(page.getByTestId("phone")).toBeHidden();

  // Buffs, the disguise and a hook in the tracker.
  await page.evaluate(() => {
    const seki = window.__seki!;
    seki.emit("BuffApplied", { buffId: "regen", duration: 30 });
    seki.emit("DisguiseChanged", { role: "tessen_guard" });
  });
  await expect(page.getByTestId("buff-regen")).toBeVisible();
  await expect(page.getByTestId("disguise")).toContainText("ochrona Tessen");
  await page.evaluate(() => window.__seki!.emit("DisguiseBlown", { observerId: 1, role: "tessen_guard" }));
  await expect(page.getByTestId("disguise")).toContainText("Spalona przykrywka");
});
