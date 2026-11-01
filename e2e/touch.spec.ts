import { type Page, expect, test } from "@playwright/test";
import { gameState, place, teleportTo, waitForGame, waitForPlay } from "./helpers";

// Landscape phone: coarse pointer, touch events, notch insets ignored.
test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

/** Real touch events through CDP, so the pointer-event path and the mouse-emulation guard both run. */
const touch = async (page: Page) => {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  return {
    async drag(from: [number, number], to: [number, number], holdMs: number) {
      await send("touchStart", ...from);
      for (let i = 1; i <= 5; i++) await send("touchMove", from[0] + ((to[0] - from[0]) * i) / 5, from[1] + ((to[1] - from[1]) * i) / 5);
      await page.waitForTimeout(holdMs);
      await send("touchEnd", ...to);
    },
  };
};

test("phone: on-screen pad moves, looks and talks", async ({ page }) => {
  // A cold boot takes about a minute on a CI runner (SwiftShader) and streaming in a district
  // another 20 s: more than the default 90 s.
  test.setTimeout(180_000);
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "New Game" }).tap();
  await waitForPlay(page);
  await expect(page.getByTestId("touch-controls")).toBeVisible();
  const fingers = await touch(page);

  // Left stick up = walk forward while the real loop runs. A new game faces east across the
  // clinic (ADR-0045): forward is along the view, not +Z.
  const start = (await gameState(page)).player!;
  const facing = await page.evaluate(() => window.__seki!.session.sim.player()!.yaw);
  await fingers.drag([140, 300], [140, 230], 1500);
  const moved = (await gameState(page)).player!;
  const ahead = (moved.x - start.x) * Math.sin(facing) + (moved.z - start.z) * Math.cos(facing);
  const aside = (moved.x - start.x) * Math.cos(facing) - (moved.z - start.z) * Math.sin(facing);
  expect(ahead).toBeGreaterThan(1.5);
  expect(Math.abs(aside)).toBeLessThan(0.5);

  // Right side drag turns the view.
  const yaw = () => page.evaluate(() => window.__seki!.session.sim.player()!.yaw);
  const yaw0 = await yaw();
  await fingers.drag([600, 200], [700, 200], 200);
  expect(await yaw()).toBeGreaterThan(yaw0 + 0.3);

  // E lights up near Kaito and opens the dialogue; the pad hides during it.
  // Kaito waits at the Neon Koi counter from the start (G-034): stand 1.5 m in front of him.
  await teleportTo(page, await place(page, "koi", 11.25, 3.5), Math.PI);
  await expect(page.getByRole("button", { name: /^Interact/ })).toHaveClass(/touch__btn--hot/);
  await page.getByRole("button", { name: /^Interact/ }).tap();
  await expect(page.getByTestId("dialogue")).toBeVisible();
  await expect(page.getByTestId("touch-controls")).toBeHidden();
  await page.getByTestId("dialogue").getByRole("button").first().tap();
  await expect(page.getByTestId("dialogue")).toContainText("I fix things.");
});

test("phone in portrait asks to rotate", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await expect(page.getByText("Turn your phone sideways")).toBeVisible();
});
