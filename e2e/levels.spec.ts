import { type Page, expect, test } from "@playwright/test";
import { freeze, gameState, place, step, teleport, waitForGame } from "./helpers";

const EAST = Math.PI / 2;
const NORTH = 0;

/** Walks forward in chunks until `done` holds for the player's position. */
const walkUntil = async (page: Page, done: (p: { x: number; y: number; z: number }) => boolean, chunks = 20) => {
  for (let i = 0; i < chunks; i++) {
    const p = (await gameState(page)).player!;
    if (done(p)) return p;
    await step(page, 30, { moveZ: 1 });
  }
  return (await gameState(page)).player!;
};

test("stairs up to the overpass and the freight lift down (ADR-0020)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=11&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await expect(page.getByTestId("hud")).toBeVisible();
  await freeze(page);

  // The market keeps its own coordinates, moved under the viaduct (ADR-0045): O is its origin.
  const O = await place(page, "market", 0, 0);
  // Foot of the stairs on the north edge of the deck; one step streams the market in.
  await teleport(page, O.x + 69.4, O.z + 98.1, EAST);
  await step(page, 1);
  const top = await walkUntil(page, (p) => p.x > O.x + 87);
  expect(top.y - O.y).toBeCloseTo(9.9, 3);

  // Along the deck to the lift gate, then call the platform up with the button.
  await page.evaluate((o) => {
    const p = window.__seki!.session.sim.player()!;
    p.position = { x: o.x + 108, y: o.y + 9.9, z: o.z + 89 };
    p.prevPosition = p.position;
    p.yaw = Math.PI;
  }, O);
  await step(page, 1);
  await expect(page.getByTestId("prompt")).toContainText("Winda");
  await step(page, 1, { interact: true });
  await step(page, 300);
  // Onto the platform and down.
  await walkUntil(page, (p) => p.z < O.z + 85.8);
  await step(page, 1, { interact: true });
  await step(page, 300);
  const down = (await gameState(page)).player!;
  expect(down.y - O.y).toBeLessThan(0.3);
  // Off the platform northwards, under the deck.
  await page.evaluate((yaw) => {
    window.__seki!.session.sim.player()!.yaw = yaw;
  }, NORTH);
  const below = await walkUntil(page, (p) => p.z > O.z + 90);
  expect(below.y).toBeCloseTo(O.y, 3);
  expect(errors).toEqual([]);
});

test("jump onto a stall counter and the fire escape onto the roof (ADR-0021)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=11&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await expect(page.getByTestId("hud")).toBeVisible();
  // A new game wakes on the clinic chair (ADR-0038): jump from the deptak in front of it (ADR-0045).
  await teleport(page, 321.4, -80);
  const O = await place(page, "market", 0, 0);

  // The real Space key jumps while the loop runs (after a click into the canvas gives it the
  // keys). Done on the deptak at the start: the light scene keeps the real loop ticking even on
  // a slow SwiftShader runner, where the first frames after streaming in the market can take
  // seconds. The market part below is stepped from the test.
  await page.mouse.click(640, 360);
  const before = (await gameState(page)).tick;
  await expect.poll(async () => (await gameState(page)).tick, { timeout: 60_000 }).toBeGreaterThan(before + 10);
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
  await freeze(page);
  await step(page, 90);
  expect((await gameState(page)).player!.y).toBeCloseTo(base, 2);

  // A 1 m counter: walking only bumps into it, a jump lands on top.
  await teleport(page, O.x + 96.7, O.z + 69.2, Math.PI);
  await step(page, 1);
  await step(page, 1, { moveZ: 1, jump: true });
  for (let i = 0; i < 60 && (await gameState(page)).airborne; i++) await step(page, 1, { moveZ: 1 });
  const top = (await gameState(page)).player!;
  expect(top.y - O.y).toBeCloseTo(1, 3);

  // Fire escape: into the foot of the first ladder, up onto the balcony.
  await teleport(page, O.x + 73.2, O.z + 65.6, Math.PI);
  await step(page, 1);
  await walkUntil(page, () => false, 1);
  await expect.poll(async () => (await gameState(page)).climbing).toBe("targ-escape-1");
  await walkUntil(page, (p) => p.y - O.y > 4.4, 10);
  // From the balcony, the interact key on the second ladder, then up onto the roof.
  await page.evaluate((o) => {
    const p = window.__seki!.session.sim.player()!;
    p.position = { x: o.x + 69.2, y: o.y + 4.5, z: o.z + 64.6 };
    p.prevPosition = p.position;
    p.yaw = Math.PI;
  }, O);
  await step(page, 1);
  await expect(page.getByTestId("prompt")).toContainText("Wspinaj się");
  await step(page, 1, { interact: true });
  expect((await gameState(page)).climbing).toBe("targ-escape-2");
  const roof = await walkUntil(page, (p) => p.z < O.z + 64 && (p.y - O.y > 9 || p.y - O.y < 0.1), 12);
  expect(roof.y - O.y).toBeGreaterThan(8);
  expect((await gameState(page)).climbing).toBeNull();
  // The minimap says the player is up on a level.
  await step(page, 1);
  await expect(page.getByTestId("minimap-level")).toContainText("m");
  expect(errors).toEqual([]);
});
