import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { freeze, step, teleport, newGame, waitForGame, waitForPlay } from "./helpers";

/**
 * Shots of places for the glitch hunters (ADR-0054): `SHOTS` is the directory the PNGs go to,
 * `GLITCH_SPOTS` a JSON list of [name, x, z, yaw, pitch, y?] (y: a floor over or under the ground,
 * the stairs of a metro pavilion; without it the ground), or the path of a .json file holding it.
 * Skipped without them, so the full suite in CI passes over it. Next to each `<name>.png` goes
 * `<name>.json` with the player, the camera and the frame's draw calls at the moment of the shot.
 * `SHOT_HOUR` (0-23) lets game time pass to that full hour before the first shot, e.g. 12 for
 * daylight; without it the game keeps its starting time (night). `SHOT_MODELS=on` takes them with
 * the character models (Seki's own hands in FPP among them), once every character in range is
 * dressed; without it the models are off.
 */
const listed = process.env.GLITCH_SPOTS ?? "[]";
const spots = JSON.parse(listed.endsWith(".json") ? readFileSync(listed, "utf8") : listed) as [string, number, number, number, number, number?][];

/** The camera stands at the player's eye, or this far behind it in TPP (2.2 m and the shoulder). */
const NEAR = 3;
/** Standing still, the camera looks exactly where the player does (no bob); a hundredth of a radian of slack. */
const TURNED = 0.01;

/** The character models on (`SHOT_MODELS=on`) or off, as the shots always were. */
const models = process.env.SHOT_MODELS === "on";

/** The hour of the shots, or null for the game's starting time. */
const hour = process.env.SHOT_HOUR === undefined ? null : Number(process.env.SHOT_HOUR);

/** Minutes from the clock "HH:MM" to the next full `target` hour, 1 to 1440. */
const minutesTo = (clock: string, target: number): number => {
  const [h, m] = clock.split(":").map(Number);
  const left = (target * 60 - (h! * 60 + m!) + 1440) % 1440;
  return left === 0 ? 1440 : left;
};

/** Shortest turn from `a` to `b`, radians. */
const turn = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));

test("shots of the hunters' places", async ({ page }) => {
  test.skip(!process.env.SHOTS || spots.length === 0, "SHOTS and GLITCH_SPOTS not set");
  test.setTimeout(60_000 + spots.length * 40_000);
  await page.goto(models ? "/?seed=7" : "/?seed=7&models=off");
  await waitForGame(page);
  await newGame(page);
  await waitForPlay(page);
  await freeze(page);
  if (models) await page.waitForFunction(() => window.__seki!.dressed() > 0 && window.__seki!.modelsLoading() === 0, null, { timeout: 90_000 });
  if (hour !== null) {
    expect(Number.isInteger(hour) && hour >= 0 && hour <= 23, "SHOT_HOUR is a full hour, 0-23").toBe(true);
    const clock = await page.evaluate(() => window.__seki!.state().clock);
    await page.evaluate((minutes) => window.__seki!.wait(minutes), minutesTo(clock, hour));
    await step(page, 1);
    const now = await page.evaluate(() => window.__seki!.state().clock);
    expect(Number(now.split(":")[0]), `clock ${now} after waiting for ${hour}:00`).toBe(hour);
  }
  for (const [name, x, z, yaw, pitch, y] of spots) {
    await teleport(page, x, z, yaw, pitch, y);
    await step(page, 5);
    // `citySettled()` and the camera are the renderer's last frame, which may still be the
    // previous view (G-013): wait for a frame drawn after the step, with the city round it built.
    const drawn = await page.evaluate(() => window.__seki!.frames!());
    await page.waitForFunction((n) => window.__seki!.frames!() > n && window.__seki!.citySettled(), drawn, { timeout: 30_000 });
    // The city may have settled in a frame the pacer skipped (G-031), leaving the canvas on the
    // frame before it (G-054): two more frames drawn after it, as `sampleNow` in the helpers (G-029).
    const settled = await page.evaluate(() => window.__seki!.frames!());
    await page.waitForFunction((n) => window.__seki!.frames!() >= n + 2, settled, { timeout: 30_000 });
    const shot = await page.evaluate(() => {
      const s = window.__seki!;
      const png = s.capture!();
      // The frame's draw calls, meshes and triangles, to set a change's cost beside its look.
      const { drawCalls, activeMeshes, activeTriangles, byName } = s.perf();
      return { png, player: s.state().player, camera: s.camera!(), perf: { drawCalls, activeMeshes, activeTriangles, byName } };
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
