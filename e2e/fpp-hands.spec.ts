import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Page, expect, test } from "@playwright/test";
import { freeze, newGame, sampleNow, step, teleport, waitForGame, waitForPlay } from "./helpers";

/**
 * Seki's own forearms and hands in first person (user's wish of 13.11), with the models on: the
 * pistol and the rifle from the hip and aimed, the baton and the sword, on a desktop and on a
 * phone, for a look (`SHOTS` keeps them; without it they go to the test's output). The logic of the arms (shown in FPP, hidden
 * in TPP, the stand-in without models, the grip in the hand) is the engine's `fpp-hands.test.ts`.
 */

/** Shots of `poses`, each a settled frame of its own (up to ~35 s under load), and the start before them. */
const SHOTS = 6;
const TIMEOUT = 120_000 + SHOTS * 35_000;

/** The deptak west of the clinic at midday, looking east along it. */
const SPOT = { x: 270, z: -81, yaw: Math.PI / 2 } as const;

const shoot = async (page: Page, name: string): Promise<void> => {
  const perf = await sampleNow(page);
  const png = await page.evaluate(() => window.__seki!.capture!());
  const dir = process.env.SHOTS ?? test.info().outputPath();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.png`), Buffer.from(png.slice(png.indexOf(",") + 1), "base64"));
  writeFileSync(join(dir, `${name}.json`), `${JSON.stringify({ name, drawCalls: perf.drawCalls, activeMeshes: perf.activeMeshes }, null, 2)}\n`);
  test.info().annotations.push({ type: name, description: `${perf.drawCalls} draw calls, ${perf.activeMeshes} active meshes` });
};

const play = async (page: Page, query: string, how: "click" | "tap"): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(query);
  await waitForGame(page);
  await newGame(page, how, 60_000);
  await waitForPlay(page);
  await freeze(page);
  const clock = await page.evaluate(() => window.__seki!.state().clock);
  const [h, m] = clock.split(":").map(Number);
  await page.evaluate((minutes) => window.__seki!.wait(minutes), (12 * 60 - (h! * 60 + m!) + 1440) % 1440 || 1440);
  await teleport(page, SPOT.x, SPOT.z, SPOT.yaw, 0);
  await step(page, 5);
  await page.waitForFunction(() => window.__seki!.dressed() > 0 && window.__seki!.modelsLoading() === 0, null, { timeout: 90_000 });
  expect(await page.evaluate(() => window.__seki!.state().cameraMode)).toBe("FPP");
  return errors;
};

/** A rifle in the primary slot and a baton in the melee one, besides the starting pistol; a sword in the bag. */
const arm = (page: Page) =>
  page.evaluate(() => {
    const s = window.__seki!;
    const { inventory: inv, equipment } = s.session.saves.snapshot().domain;
    const weapon = (uid: string, def: string, loaded: number) => ({ uid, def, rarity: "common", level: 1, loaded, mods: {} });
    const items = [...inv.items, weapon("i90", "tessen_ar5", 30), weapon("i91", "baton", 0), weapon("i92", "shirasaya", 0)] as unknown as typeof inv.items;
    s.jump({ inventory: { ...inv, items, nextUid: 93 }, equipment: { ...equipment, primary: "i90", melee: "i91" } });
  });

/** The sword (shirasaya) in the melee slot instead of the baton. */
const sword = (page: Page) =>
  page.evaluate(() => {
    const s = window.__seki!;
    const { equipment } = s.session.saves.snapshot().domain;
    s.jump({ equipment: { ...equipment, melee: "i92" } });
  });

/** The pistol from the hip and aimed, the rifle from the hip and aimed, the baton and the sword. */
const poses = async (page: Page, prefix: string): Promise<void> => {
  await arm(page);
  await step(page, 5);
  await step(page, 30, { weaponSlot: 2 });
  await shoot(page, `${prefix}-pistol-hip`);
  await step(page, 30, { aim: true });
  await shoot(page, `${prefix}-pistol-aim`);
  await step(page, 30, { weaponSlot: 1 });
  await shoot(page, `${prefix}-rifle-hip`);
  await step(page, 30, { aim: true });
  await shoot(page, `${prefix}-rifle-aim`);
  await step(page, 30, { weaponSlot: 3 });
  await shoot(page, `${prefix}-baton`);
  await sword(page);
  await step(page, 30, { weaponSlot: 3 });
  await shoot(page, `${prefix}-blade`);
};

test("desktop: Seki's own hands hold the weapon in FPP", async ({ page }) => {
  test.setTimeout(TIMEOUT);
  const errors = await play(page, "/?seed=7&audio=off", "click");
  await poses(page, "desktop");
  expect(errors).toEqual([]);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test("phone: Seki's own hands hold the weapon in FPP", async ({ page }) => {
    test.setTimeout(TIMEOUT);
    const errors = await play(page, "/?seed=7&audio=off&touch", "tap");
    await poses(page, "phone");
    expect(errors).toEqual([]);
  });
});
