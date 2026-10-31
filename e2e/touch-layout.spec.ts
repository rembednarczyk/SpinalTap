import { type Page, expect, test } from "@playwright/test";
import { freeze, step, teleport, waitForGame } from "./helpers";

/**
 * A phone in landscape (ADR-0035): at 800x370 and 667x375 CSS px no key element of the HUD or
 * the pad overlaps another, everything stays on screen and every touch target is 44 px or more.
 * Checked with the contextual "Use" button up and with the "more" row unfolded.
 */
interface Box {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const boxes = async (page: Page): Promise<Box[]> => {
  const out: Box[] = [];
  const add = async (name: string, selector: string) => {
    const loc = page.locator(selector);
    for (let i = 0; i < (await loc.count()); i++) {
      const el = loc.nth(i);
      if (!(await el.isVisible())) continue;
      const b = await el.boundingBox();
      const label = (await el.getAttribute("aria-label")) ?? (await el.getAttribute("data-testid")) ?? `${name}#${i}`;
      if (b && b.width > 0 && b.height > 0) out.push({ name: `${name}:${label}`, ...b });
    }
  };
  await add("pad", "[data-testid=touch-controls] button");
  await add("hud", "[data-testid=minimap], [data-testid=eddies], [data-testid=clock], [data-testid=objective], [data-testid=identity], [data-testid=weapon-strip]");
  return out;
};

const overlap = (a: Box, b: Box) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

const check = async (page: Page, w: number, h: number) => {
  const all = await boxes(page);
  expect(all.length).toBeGreaterThan(8);
  for (const b of all) {
    expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= w + 0.5 && b.y + b.height <= h + 0.5, `${b.name} on screen`).toBe(true);
    if (b.name.startsWith("pad:")) expect(Math.min(b.width, b.height), `${b.name} at least 44 px`).toBeGreaterThanOrEqual(43.5);
  }
  const clashes: string[] = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (overlap(all[i]!, all[j]!)) clashes.push(`${all[i]!.name} × ${all[j]!.name}`);
  expect(clashes).toEqual([]);
};

for (const [w, h] of [
  [800, 370],
  [667, 375],
] as const) {
  test.describe(`phone ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });

    test(`nothing overlaps at ${w}x${h}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto("/?seed=7&models=off&audio=off&touch");
      await waitForGame(page);
      await page.getByRole("button", { name: "New Game" }).tap();
      await freeze(page);
      // A new game wakes in the clinic (ADR-0038); the bare layout is checked out on the deptak
      // in front of the clinic (ADR-0045).
      await teleport(page, 321.4, -80);
      await step(page, 1);
      await expect(page.getByTestId("touch-controls")).toBeVisible();
      // No key hints on a touch screen.
      await expect(page.getByTestId("objective")).not.toContainText("[E]");
      await expect(page.getByTestId("touch-use")).toHaveCount(0);
      await check(page, w, h);
      // The character menu replaces the pad; its box is where the canvas draws the 3D preview.
      await page.getByRole("button", { name: "Postać" }).tap();
      await expect(page.getByTestId("character-screen")).toBeVisible();
      await expect(page.getByTestId("touch-controls")).toBeHidden();
      const preview = (await page.getByTestId("character-preview").boundingBox())!;
      expect(preview.width).toBeGreaterThan(100);
      expect(preview.height).toBeGreaterThan(150);
      await page.getByRole("button", { name: "Close the character menu" }).tap();
      await expect(page.getByTestId("touch-controls")).toBeVisible();
      await page.evaluate(() => window.__seki!.emit("InteractionFocusChanged", { targetId: 1, prompt: "Porozmawiaj z Kaito" }));
      await expect(page.getByTestId("touch-use")).toContainText("Porozmawiaj z Kaito");
      await page.getByTestId("touch-more").tap();
      await expect(page.getByTestId("touch-more-actions")).toBeVisible();
      await check(page, w, h);
    });
  });
}
