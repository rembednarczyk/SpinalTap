import { expect, test } from "@playwright/test";
import { freeze, gameState, step, teleport, newGame, waitForGame, waitForPlay } from "./helpers";

/*
 * The smoke of play out of `smoke.spec.ts` (26.11, the user's decision to split the heaviest files): the real
 * input path and the touch layout's two checks, about 3 min on a CI runner. `smoke.spec.ts` runs in the e2e
 * group 2 (`playwright.config.ts`), which took 20.4 min of the job's 25 on main; this file runs in group 3.
 */

/**
 * The one check of the real input path (ADR-0046): mouse and keyboard events on the page reach
 * the simulation through BrowserInput and the running loop. What the buttons do is tested
 * without a browser (app/test/posture-ui, levels-ui; engine/test/keymap, browser-input).
 */
test("real input: the right mouse button aims and Space jumps in the running loop", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await newGame(page);
  await waitForPlay(page);
  await expect(page.getByTestId("hud")).toBeVisible();
  // A light spot of Podzamcze (about 1.2 million triangles drawn): the real loop keeps ticking even on a slow
  // SwiftShader runner. The deptak before the clinic (321.4, -80) was light once; with the city's props it draws over
  // 5 million now and a frame there took seconds (22.11, `graphics-toggles.spec.ts` the same).
  await teleport(page, 520, -330);
  // Into the canvas, so the mouse and the keys drive the game (pointer lock or its fallback).
  await page.mouse.click(640, 360);
  const before = (await gameState(page)).tick;
  await expect.poll(async () => (await gameState(page)).tick, { timeout: 60_000 }).toBeGreaterThan(before + 10);

  const crosshair = page.getByTestId("crosshair");
  await page.mouse.down({ button: "right" });
  await expect(crosshair).toHaveClass(/crosshair--aiming/);
  await expect.poll(() => page.evaluate(() => window.__seki!.session.sim.player()!.posture!.aim)).toBe(1);
  await page.mouse.up({ button: "right" });
  await expect(crosshair).not.toHaveClass(/crosshair--aiming/);

  // The jump lasts 0.7 s, shorter than a few slow frames: record the highest point every frame
  // instead of polling for it, and tap again if a press landed in a hitch.
  const base = (await gameState(page)).player!.y;
  await page.evaluate(() => {
    const w = window as unknown as { __peakY: number };
    w.__peakY = -Infinity;
    const sample = () => {
      w.__peakY = Math.max(w.__peakY, window.__seki!.state().player!.y);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const peak = () => page.evaluate(() => (window as unknown as { __peakY: number }).__peakY);
  for (let i = 0; i < 4 && (await peak()) - base <= 0.3; i++) {
    await page.keyboard.down("Space");
    await page.waitForTimeout(150);
    await page.keyboard.up("Space");
    await expect.poll(peak, { timeout: 8000 }).toBeGreaterThan(base + 0.3).catch(() => undefined);
  }
  expect(await peak()).toBeGreaterThan(base + 0.3);
  expect(errors).toEqual([]);
});

test("touch layout keeps the minimap off the pad", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?seed=7&touch&models=off");
  await waitForGame(page);
  await newGame(page);
  await waitForPlay(page);
  await freeze(page);
  await step(page, 1);
  const map = await page.getByTestId("minimap").boundingBox();
  expect(map).not.toBeNull();
  expect(map!.width).toBeLessThan(100);
  const pad = page.getByTestId("touch-controls").getByRole("button");
  const count = await pad.count();
  expect(count).toBeGreaterThan(4);
  for (let i = 0; i < count; i++) {
    const b = await pad.nth(i).boundingBox();
    if (!b) continue;
    const overlaps = map!.x < b.x + b.width && b.x < map!.x + map!.width && map!.y < b.y + b.height && b.y < map!.y + map!.height;
    expect(overlaps, `minimap overlaps ${await pad.nth(i).getAttribute("aria-label")}`).toBe(false);
  }
});

test("touch layout keeps the weapon strip off the pad and the minimap", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?seed=7&touch&models=off");
  await waitForGame(page);
  await newGame(page);
  await waitForPlay(page);
  await freeze(page);
  await step(page, 1);
  const strip = await page.getByTestId("weapon-strip").boundingBox();
  expect(strip).not.toBeNull();
  const inside = strip!.x >= 0 && strip!.y >= 0 && strip!.x + strip!.width <= 844 && strip!.y + strip!.height <= 390;
  expect(inside, "weapon strip on screen").toBe(true);
  const overlap = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const map = await page.getByTestId("minimap").boundingBox();
  expect(overlap(strip!, map!), "weapon strip overlaps the minimap").toBe(false);
  const clock = await page.getByTestId("clock").boundingBox();
  expect(overlap(strip!, clock!), "weapon strip overlaps the clock").toBe(false);
  expect(overlap(clock!, map!), "clock overlaps the minimap").toBe(false);
  const pad = page.getByTestId("touch-controls").getByRole("button");
  const count = await pad.count();
  expect(count).toBeGreaterThan(4);
  for (let i = 0; i < count; i++) {
    const b = await pad.nth(i).boundingBox();
    if (!b) continue;
    expect(overlap(strip!, b), `weapon strip overlaps ${await pad.nth(i).getAttribute("aria-label")}`).toBe(false);
  }
  // The strip's slots are touch targets of at least 44 px.
  const slot = await page.getByRole("button", { name: /Secondary: Unity-9/ }).boundingBox();
  expect(slot!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
});
