import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { freeze, step, teleport, waitForGame } from "./helpers";

/**
 * Shots of places for the glitch hunters (ADR-0054): `SHOTS` is the directory the PNGs go to,
 * `GLITCH_SPOTS` a JSON list of [name, x, z, yaw, pitch]. Skipped without them, so the full suite
 * in CI passes over it.
 */
const spots = JSON.parse(process.env.GLITCH_SPOTS ?? "[]") as [string, number, number, number, number][];

test("shots of the hunters' places", async ({ page }) => {
  test.skip(!process.env.SHOTS || spots.length === 0, "SHOTS and GLITCH_SPOTS not set");
  test.setTimeout(60_000 + spots.length * 40_000);
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  for (const [name, x, z, yaw, pitch] of spots) {
    await teleport(page, x, z, yaw, pitch);
    await step(page, 5);
    // The city streams round the new place and the renderer builds its cells.
    await page.waitForFunction(() => window.__seki!.citySettled(), null, { timeout: 30_000 });
    const png = await page.evaluate(() => window.__seki!.capture!());
    writeFileSync(join(process.env.SHOTS!, `${name}.png`), Buffer.from(png.slice(png.indexOf(",") + 1), "base64"));
  }
});
