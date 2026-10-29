import { type Page, expect, test } from "@playwright/test";
import { gameState, place, teleportTo, waitForGame } from "./helpers";

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
  await page.goto("/?seed=7");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).tap();
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
  // Kaito waits by the chair in the clinic (ADR-0038), a tenement's room since ADR-0045.
  await teleportTo(page, await place(page, "clinic", -13.3, 4.7), Math.PI * 1.5);
  await expect(page.getByRole("button", { name: "Interakcja" })).toHaveClass(/touch__btn--hot/);
  await page.getByRole("button", { name: "Interakcja" }).tap();
  await expect(page.getByTestId("dialogue")).toBeVisible();
  await expect(page.getByTestId("touch-controls")).toBeHidden();
  await page.getByTestId("dialogue").getByRole("button").first().tap();
  await expect(page.getByTestId("dialogue")).toContainText("Kim ty jesteś?");
});

test("phone in portrait asks to rotate", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?seed=7");
  await waitForGame(page);
  await expect(page.getByText("Obróć telefon poziomo")).toBeVisible();
});
