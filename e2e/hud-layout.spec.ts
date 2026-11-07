import { type Page, expect, test } from "@playwright/test";
import { freeze, newGame, step, teleport, waitForGame, waitForPlay } from "./helpers";

/**
 * The HUD on a computer (ADR-0059, stage 7): the health block grows by the level, the XP bar and
 * the points to spend, and is pinned from the bottom; the minimap above it stands still. At the
 * usual desktop sizes the block, at its tallest, stays under the minimap and the buffs' column.
 */
const SIZES = [
  [1280, 720],
  [1366, 768],
  [1920, 1080],
  [1024, 600],
] as const;

const box = async (page: Page, testId: string) => {
  const b = await page.getByTestId(testId).boundingBox();
  expect(b, `${testId} on screen`).not.toBeNull();
  return b!;
};

test("desktop: the health block with its XP row stays under the minimap", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/?seed=7&models=off&audio=off");
  await waitForGame(page);
  await newGame(page);
  await waitForPlay(page);
  await freeze(page);
  await teleport(page, 321.4, -80);
  // The block at its tallest: always on, with the level, the bar and the points' mark.
  await page.evaluate(() => {
    window.__seki!.session.intents.changeSettings({ hudAlwaysShow: true });
    for (const flag of ["met_fixer", "killed:hebi_courier", "reported_back"]) window.__seki!.session.sim.enqueue({ type: "set-flag", flag } as never);
  });
  await step(page, 2);
  await expect(page.getByTestId("hud-points")).toBeVisible();
  await expect(page.getByTestId("identity")).not.toHaveClass(/hud__identity--calm/);
  const gaps: string[] = [];
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    const identity = await box(page, "identity");
    const minimap = await box(page, "minimap");
    expect(identity.y + identity.height, `identity on screen at ${w}x${h}`).toBeLessThanOrEqual(h + 0.5);
    const gap = identity.y - (minimap.y + minimap.height);
    gaps.push(`${w}x${h}: ${gap.toFixed(1)} px`);
    expect.soft(gap, `health block clear of the minimap at ${w}x${h}`).toBeGreaterThanOrEqual(0);
  }
  test.info().annotations.push({ type: "gaps", description: gaps.join(", ") });
});
