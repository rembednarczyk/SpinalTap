import { join } from "node:path";
import { type Page, expect, test } from "@playwright/test";
import { freeze, newGame, sampleNow, step, teleport, waitForGame, waitForPlay } from "./helpers";

/**
 * The High effects' switches in the options (graphics toggles 14.11): each one off takes its
 * passes out of the post-process chain at once, which the frame's draw calls show, and on brings
 * them back. `SHOTS` keeps the options on a desktop and on a phone for review.
 */
const shot = (page: Page, name: string) => (process.env.SHOTS ? page.screenshot({ path: join(process.env.SHOTS, name) }) : Promise.resolve());

const openSettings = async (page: Page, how: "click" | "tap") => {
  await page.evaluate(() => window.__seki!.session.pause());
  await expect(page.getByTestId("pause-menu")).toBeVisible();
  const settings = page.getByTestId("pause-menu").getByRole("button", { name: "Settings" });
  await (how === "tap" ? settings.tap() : settings.click());
  await expect(page.getByTestId("graphics-effects-note")).toBeVisible();
};

const effect = (page: Page, name: "Contact shade" | "Bloom", value: "On" | "Off") => page.getByRole("radiogroup", { name }).getByRole("radio", { name: value });

/** The draw calls of a frame after the game resumed with the switches as they are. */
const drawCalls = async (page: Page) => {
  await page.evaluate(() => window.__seki!.session.resume());
  await step(page, 2);
  return (await sampleNow(page)).drawCalls;
};

test("desktop: contact shade and bloom switch off and on at once, without a reload", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/?seed=3&models=off");
  await waitForGame(page);
  await newGame(page);
  await waitForPlay(page);
  await freeze(page);
  await step(page, 1, { toggleCamera: true });
  await teleport(page, 270, -81, Math.PI / 2);
  await step(page, 30, { moveZ: 1 });
  const on = (await sampleNow(page)).drawCalls;

  await openSettings(page, "click");
  await expect(effect(page, "Contact shade", "On")).toHaveAttribute("aria-checked", "true");
  await expect(effect(page, "Bloom", "On")).toHaveAttribute("aria-checked", "true");
  await shot(page, "desktop-settings-on.png");
  await effect(page, "Contact shade", "Off").click();
  await expect(effect(page, "Contact shade", "Off")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("settings-reload")).toHaveCount(0);
  const noShade = await drawCalls(page);

  await openSettings(page, "click");
  await effect(page, "Bloom", "Off").click();
  await expect(effect(page, "Bloom", "Off")).toHaveAttribute("aria-checked", "true");
  await shot(page, "desktop-settings-off.png");
  const neither = await drawCalls(page);

  await openSettings(page, "click");
  await effect(page, "Contact shade", "On").click();
  await effect(page, "Bloom", "On").click();
  const back = await drawCalls(page);
  const calls = `on ${on}, no contact shade ${noShade}, neither ${neither}, back on ${back}`;
  test.info().annotations.push({ type: "draw calls", description: calls });
  console.log(`graphics toggles, draw calls: ${calls}`);
  // The contact shade's two passes and the bloom's own leave the chain; both come back.
  expect(noShade).toBeLessThanOrEqual(on - 2);
  expect(neither).toBeLessThan(noShade);
  expect(back).toBe(on);

  // The render resolution: half the share, half the canvas's drawing buffer, at once.
  const width = () => page.evaluate(() => document.querySelector("canvas")!.width);
  const full = await width();
  await openSettings(page, "click");
  const slider = page.getByRole("slider", { name: /^Render resolution/ });
  await expect(slider).toHaveValue("1");
  await slider.fill("0.5");
  await expect(slider).toHaveValue("0.5");
  await expect.poll(width).toBe(Math.round(full / 2));
  // The paused game keeps drawing: two frames at the new size before the picture is kept.
  const drawn = await page.evaluate(() => window.__seki!.frames!());
  await page.waitForFunction((n) => window.__seki!.frames!() >= n + 2, drawn, { timeout: 30_000 });
  await shot(page, "desktop-settings-resolution-50.png");
  await page.evaluate(() => window.__seki!.session.resume());
  await step(page, 2);
  await sampleNow(page);
  const widths = `100% ${full}, 50% ${await width()}`;
  test.info().annotations.push({ type: "canvas width", description: widths });
  console.log(`graphics toggles, canvas width: ${widths}`);
  expect(errors).toEqual([]);
});

test.describe("phone 844x390 graphics switches", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test("phone: the switches sit under the quality, inside the screen, and take a tap", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/?seed=7&models=off");
    await waitForGame(page);
    await newGame(page, "tap");
    await expect(page.getByTestId("hud")).toBeVisible();
    await openSettings(page, "tap");
    const off = effect(page, "Bloom", "Off");
    await off.scrollIntoViewIfNeeded();
    await shot(page, "phone-settings-on.png");
    for (const name of ["Contact shade", "Bloom"] as const) {
      const box = await page.getByRole("radiogroup", { name }).boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= 844 + 1).toBe(true);
    }
    const slider = await page.getByRole("slider", { name: /^Render resolution/ }).boundingBox();
    expect(slider && slider.x >= 0 && slider.x + slider.width <= 844 + 1).toBe(true);
    await off.tap();
    await expect(off).toHaveAttribute("aria-checked", "true");
    await shot(page, "phone-settings-off.png");
  });
});
