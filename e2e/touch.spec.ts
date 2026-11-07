import { join } from "node:path";
import { type Page, expect, test } from "@playwright/test";
import { gameState, place, teleportTo, newGame, waitForGame, waitForPlay } from "./helpers";

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
  await newGame(page, "tap");
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

/**
 * One thumb fires from the sights (ADR-0072): by default holding ● aims and fires; with "Fires
 * only" a tap on ◎ latches the sights, lights ◎ and rings the crosshair. SHOTS=<dir> keeps a
 * screenshot of each state.
 */
test("phone: the fire button aims, or a tap on aim holds the sights", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await newGame(page, "tap");
  await waitForPlay(page);
  const cdp = await page.context().newCDPSession(page);
  const finger = (type: "touchStart" | "touchEnd", at: { x: number; y: number }) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: at.x, y: at.y, id: 2 }] });
  const centre = async (name: RegExp | string) => {
    const box = (await page.getByRole("button", { name }).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const aiming = () => page.evaluate(() => window.__seki!.session.sim.player()!.posture!.aiming);
  const shot = async (name: string) => {
    if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, `${name}.png`) });
  };
  await shot("touch-hip");

  // A: ● held aims and fires; letting go ends both.
  const fire = await centre(/^Fire/);
  await finger("touchStart", fire);
  await expect.poll(aiming).toBe(true);
  await expect(page.getByTestId("crosshair")).toHaveClass(/crosshair--aiming/);
  await shot("touch-a-fire-held");
  await finger("touchEnd", fire);
  await expect.poll(aiming).toBe(false);

  // B: a tap on ◎ holds the sights, lit and ringed; a second tap lets go.
  await page.evaluate(() => window.__seki!.session.intents.changeSettings({ touchFire: "separate", aimMode: "toggle" }));
  await page.getByTestId("touch-aim").tap();
  await expect.poll(aiming).toBe(true);
  await expect(page.getByTestId("touch-aim")).toHaveClass(/touch__btn--on/);
  await expect(page.getByTestId("ads-ring")).toBeVisible();
  await shot("touch-b-latched");
  await page.getByTestId("touch-aim").tap();
  await expect.poll(aiming).toBe(false);
  await expect(page.getByTestId("ads-ring")).toBeHidden();
});

test("phone in portrait asks to rotate", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await expect(page.getByText("Turn your phone sideways")).toBeVisible();
});
