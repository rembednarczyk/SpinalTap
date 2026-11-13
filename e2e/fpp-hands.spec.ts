import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Page, expect, test } from "@playwright/test";
import { freeze, newGame, sampleNow, step, teleport, waitForGame, waitForPlay } from "./helpers";

/**
 * Seki's own forearms and hands in first person (user's wish of 13.11), with the models on: the
 * pistol and the rifle from the hip and aimed, the DMR aimed, the baton, on a desktop and on a
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

/** A rifle in the primary slot and a baton in the melee one, besides the starting pistol; a DMR and a sword in the bag. */
const arm = (page: Page) =>
  page.evaluate(() => {
    const s = window.__seki!;
    const { inventory: inv, equipment } = s.session.saves.snapshot().domain;
    const weapon = (uid: string, def: string, loaded: number) => ({ uid, def, rarity: "common", level: 1, loaded, mods: {} });
    const items = [...inv.items, weapon("i90", "tessen_ar5", 30), weapon("i91", "baton", 0), weapon("i92", "shirasaya", 0), weapon("i93", "kagero_dmr", 6)];
    s.jump({ inventory: { ...inv, items: items as unknown as typeof inv.items, nextUid: 94 }, equipment: { ...equipment, primary: "i90", melee: "i91" } });
  });

/** Another weapon of the bag in a slot, as the inventory does it (the DMR as the primary, the sword as the melee one). */
const equip = async (page: Page, slot: "primary" | "melee", uid: string): Promise<void> => {
  await page.evaluate(([k, id]) => window.__seki!.session.sim.enqueue({ type: "equip-item", uid: id, slot: k }), [slot, uid] as const);
  await step(page, 1);
};

/**
 * What a leak of model instances would leave in the scene, and the page's JS heap after a
 * collection (`performance.memory` is coarse without a flag, so the DevTools protocol's).
 */
const census = async (page: Page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  const { usedSize } = (await cdp.send("Runtime.getHeapUsage")) as { usedSize: number };
  await cdp.detach();
  const p = await page.evaluate(() => window.__seki!.perf());
  return { meshes: p.totalMeshes, materials: p.materials, textures: p.textures, skeletons: p.skeletons, nodes: p.nodes, heapMB: Math.round(usedSize / 2 ** 20) };
};

/** Every weapon of the slots in hand once, from the hip: the primary, the pistol, the melee one. */
const cycle = async (page: Page): Promise<void> => {
  for (const slot of [1, 2, 3]) await step(page, 20, { weaponSlot: slot });
};

/** The rifle and the sword, then the DMR and the baton, in their slots and in hand. */
const swap = async (page: Page): Promise<void> => {
  await equip(page, "primary", "i90");
  await equip(page, "melee", "i92");
  await cycle(page);
  await equip(page, "primary", "i93");
  await equip(page, "melee", "i91");
  await cycle(page);
};

/**
 * The pistol from the hip and aimed, the rifle from the hip and aimed, the DMR aimed (its zoom
 * 0.38), the baton; then the weapons changed over and over, which leaves nothing behind.
 */
const poses = async (page: Page, prefix: string): Promise<void> => {
  await arm(page);
  await step(page, 5);
  await step(page, 30, { weaponSlot: 2 });
  await shoot(page, `${prefix}-pistol-hip`);
  await step(page, 30, { aim: true });
  await shoot(page, `${prefix}-pistol-aim`);
  // The rifle comes up in 0.7 s.
  await step(page, 50, { weaponSlot: 1 });
  await shoot(page, `${prefix}-rifle-hip`);
  await step(page, 40, { aim: true });
  await shoot(page, `${prefix}-rifle-aim`);
  // The DMR comes up slower (0.85 s) and zooms the view to 0.38.
  await equip(page, "primary", "i93");
  await step(page, 70, { aim: true });
  await shoot(page, `${prefix}-dmr-aim`);
  await step(page, 30, { weaponSlot: 3 });
  await shoot(page, `${prefix}-baton`);
  // Every weapon has been in hand once: its model is in.
  await swap(page);
  const first = await census(page);
  for (let i = 0; i < 3; i++) await swap(page);
  const after = await census(page);
  const dir = process.env.SHOTS ?? test.info().outputPath();
  writeFileSync(join(dir, `${prefix}-census.json`), `${JSON.stringify({ first, after }, null, 2)}\n`);
  // Changing weapons makes nothing new: the arms, the weapon models and their materials are there
  // once (13.11 the run grew to some 6 GB: the scene and the heap stay; the rest is the browser's).
  expect({ ...after, heapMB: 0 }).toEqual({ ...first, heapMB: 0 });
  expect(after.heapMB - first.heapMB).toBeLessThan(30);
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
