import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { freeze, step, teleport, newGame, waitForGame, waitForPlay } from "./helpers";

/**
 * Shots of places for the glitch hunters (ADR-0054): `SHOTS` is the directory the PNGs go to,
 * `GLITCH_SPOTS` a JSON list of [name, x, z, yaw, pitch]. Skipped without them, so the full suite
 * in CI passes over it. Next to each `<name>.png` goes `<name>.json` with the player and the
 * camera at the moment of the shot.
 */
const spots = JSON.parse(process.env.GLITCH_SPOTS ?? "[]") as [string, number, number, number, number][];

/** The camera stands at the player's eye, or this far behind it in TPP (2.2 m and the shoulder). */
const NEAR = 3;
/** Standing still, the camera looks exactly where the player does (no bob); a hundredth of a radian of slack. */
const TURNED = 0.01;

/** Shortest turn from `a` to `b`, radians. */
const turn = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));

test("shots of the hunters' places", async ({ page }) => {
  test.skip(!process.env.SHOTS || spots.length === 0, "SHOTS and GLITCH_SPOTS not set");
  test.setTimeout(60_000 + spots.length * 40_000);
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await newGame(page);
  await waitForPlay(page);
  await freeze(page);
  for (const [name, x, z, yaw, pitch] of spots) {
    await teleport(page, x, z, yaw, pitch);
    await step(page, 5);
    // `citySettled()` and the camera are the renderer's last frame, which may still be the
    // previous view (G-013): wait for a frame drawn after the step, with the city round it built.
    const drawn = await page.evaluate(() => window.__seki!.frames!());
    await page.waitForFunction((n) => window.__seki!.frames!() > n && window.__seki!.citySettled(), drawn, { timeout: 30_000 });
    // The city may have settled in a frame the pacer skipped (G-031), leaving the canvas on the
    // frame before it (G-054): two more frames drawn after it, as `sampleNow` in npr-perf (G-029).
    const settled = await page.evaluate(() => window.__seki!.frames!());
    await page.waitForFunction((n) => window.__seki!.frames!() >= n + 2, settled, { timeout: 30_000 });
    const shot = await page.evaluate(() => {
      const s = window.__seki!;
      const png = s.capture!();
      return { png, player: s.state().player, camera: s.camera!() };
    });
    const { png, ...where } = shot;
    writeFileSync(join(process.env.SHOTS!, `${name}.png`), Buffer.from(png.slice(png.indexOf(",") + 1), "base64"));
    writeFileSync(join(process.env.SHOTS!, `${name}.json`), `${JSON.stringify({ name, spot: { x, z, yaw, pitch }, ...where }, null, 2)}\n`);
    // The shot shows the view asked for: the camera it was drawn from stands there and looks that way.
    expect(Math.hypot(where.camera.x - x, where.camera.z - z), `${name}: camera away from the spot`).toBeLessThan(NEAR);
    expect(Math.abs(turn(where.camera.yaw, yaw)), `${name}: camera yaw`).toBeLessThan(TURNED);
    expect(Math.abs(where.camera.pitch - pitch), `${name}: camera pitch`).toBeLessThan(TURNED);
  }
});
