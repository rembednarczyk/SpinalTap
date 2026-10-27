import { type Page, expect, test } from "@playwright/test";
import { freeze, gameState, step, teleport, waitForGame } from "./helpers";

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

  // Foot of the stairs on the north edge of the deck; one step streams the market in.
  await teleport(page, 69.4, 98.1, EAST);
  await step(page, 1);
  const top = await walkUntil(page, (p) => p.x > 87);
  expect(top.y).toBeCloseTo(9.9, 3);

  // Along the deck to the lift gate, then call the platform up with the button.
  await page.evaluate(() => {
    const p = window.__seki!.session.sim.player()!;
    p.position = { x: 108, y: 9.9, z: 89 };
    p.prevPosition = p.position;
    p.yaw = Math.PI;
  });
  await step(page, 1);
  await expect(page.getByTestId("prompt")).toContainText("Winda");
  await step(page, 1, { interact: true });
  await step(page, 300);
  // Onto the platform and down.
  await walkUntil(page, (p) => p.z < 85.8);
  await step(page, 1, { interact: true });
  await step(page, 300);
  const down = (await gameState(page)).player!;
  expect(down.y).toBeLessThan(0.3);
  // Off the platform northwards, under the deck.
  await page.evaluate((yaw) => {
    window.__seki!.session.sim.player()!.yaw = yaw;
  }, NORTH);
  const below = await walkUntil(page, (p) => p.z > 90);
  expect(below.y).toBe(0);
  expect(errors).toEqual([]);
});
