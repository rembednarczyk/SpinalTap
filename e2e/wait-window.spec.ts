import { type Page, expect, test } from "@playwright/test";
import { freeze, newGame, waitForGame, waitForPlay } from "./helpers";

/**
 * The wait window on screen: opened from the pause menu, on a computer by the keys and on a phone
 * held sideways by taps. Its card stays on screen and its touch targets are 44 px or more. The
 * logic (the end time, the refusals) is tested headless; this checks the drawing and the touch.
 */

const minutes = (clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return h! * 60 + m!;
};

const openFromPause = async (page: Page, how: "click" | "tap") => {
  await page.evaluate(() => window.__seki!.session.pause());
  const item = page.getByTestId("pause-menu").getByRole("button", { name: "Wait", exact: true });
  await expect(item).toBeEnabled();
  await (how === "tap" ? item.tap() : item.click());
  await expect(page.getByTestId("wait-window")).toBeVisible();
};

test("desktop: the wait window from the pause menu, three hours by the keys", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/?seed=7&models=off&audio=off");
  await waitForGame(page);
  await newGame(page);
  await waitForPlay(page);
  await freeze(page);
  const before = (await page.evaluate(() => window.__seki!.state())).clock;
  await openFromPause(page, "click");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("wait-hours")).toHaveText("3 hours");
  await page.screenshot({ path: test.info().outputPath("wait-desktop.png") });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("wait-window")).toBeHidden();
  const after = (await page.evaluate(() => window.__seki!.state())).clock;
  expect((minutes(after) - minutes(before) + 1440) % 1440).toBe(180);
  // The key binding opens it again, Esc closes it without time passing.
  await page.keyboard.press("KeyL");
  await expect(page.getByTestId("wait-window")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("wait-window")).toBeHidden();
  expect((await page.evaluate(() => window.__seki!.state())).clock).toBe(after);
});

for (const [w, h] of [
  [800, 370],
  [667, 375],
] as const) {
  test.describe(`phone ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });

    test(`phone: the wait window fits and takes taps at ${w}x${h}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto("/?seed=7&models=off&audio=off&touch");
      await waitForGame(page);
      await newGame(page, "tap");
      await waitForPlay(page);
      await freeze(page);
      const before = (await page.evaluate(() => window.__seki!.state())).clock;
      await openFromPause(page, "tap");
      const card = page.locator(".wait");
      const box = (await card.boundingBox())!;
      expect(box.x >= 0 && box.y >= 0 && box.x + box.width <= w + 0.5 && box.y + box.height <= h + 0.5, "card on screen").toBe(true);
      const buttons = page.getByTestId("wait-window").getByRole("button");
      for (let i = 0; i < (await buttons.count()); i++) {
        const b = (await buttons.nth(i).boundingBox())!;
        expect(Math.min(b.width, b.height), `button ${i} at least 44 px`).toBeGreaterThanOrEqual(43.5);
      }
      await page.getByRole("button", { name: "One hour more" }).tap();
      await expect(page.getByTestId("wait-hours")).toHaveText("2 hours");
      await page.screenshot({ path: test.info().outputPath(`wait-phone-${w}x${h}.png`) });
      await page.getByTestId("wait-window").getByRole("button", { name: "Wait", exact: true }).tap();
      await expect(page.getByTestId("wait-window")).toBeHidden();
      const after = (await page.evaluate(() => window.__seki!.state())).clock;
      expect((minutes(after) - minutes(before) + 1440) % 1440).toBe(120);
    });
  });
}
