import { type Page, expect, test } from "@playwright/test";
import type { DomainState } from "@seki/core";
import { waitForGame } from "./helpers";

const start = async (page: Page, errors: string[]) => {
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await expect(page.getByTestId("hud")).toBeVisible();
  // Into the canvas, so the mouse drives the game (pointer lock or its fallback).
  await page.mouse.click(640, 360);
};

test("holding the right mouse button aims down sights: the crosshair pulls in, letting go restores it", async ({ page }) => {
  const errors: string[] = [];
  await start(page, errors);
  const crosshair = page.getByTestId("crosshair");
  const spread = async () => Number(await crosshair.getAttribute("data-spread"));
  await expect.poll(spread).toBeGreaterThan(0);
  const hip = await spread();

  await page.mouse.down({ button: "right" });
  await expect(crosshair).toHaveClass(/crosshair--aiming/);
  await expect.poll(spread).toBeLessThan(hip * 0.7);
  await expect.poll(() => page.evaluate(() => window.__seki!.session.sim.player()!.posture!.aim)).toBe(1);

  await page.mouse.up({ button: "right" });
  await expect(crosshair).not.toHaveClass(/crosshair--aiming/);
  await expect.poll(spread).toBeCloseTo(hip, 2);
  expect(errors).toEqual([]);
});

test("with the baton the right mouse button guards and the left one swings", async ({ page }) => {
  const errors: string[] = [];
  await start(page, errors);
  // Put a baton into the melee slot (quicker than buying one at the market).
  await page.evaluate(() => {
    const sim = window.__seki!.session.sim as unknown as { holder: { domain: DomainState } };
    const d = sim.holder.domain;
    sim.holder.domain = {
      ...d,
      inventory: { ...d.inventory, items: [...d.inventory.items, { uid: "e2e-baton", def: "baton", rarity: "common" }] },
      equipment: { ...d.equipment, melee: "e2e-baton" },
    };
  });
  await page.keyboard.press("Digit3");
  await expect(page.getByTestId("weapon-strip")).toContainText("Pałka");
  const crosshair = page.getByTestId("crosshair");
  const melee = () => page.evaluate(() => ({ ...window.__seki!.session.sim.player()!.melee! }));

  await page.mouse.down({ button: "right" });
  await expect(crosshair).toHaveClass(/crosshair--guard/);
  expect((await melee()).guard).toBe(true);
  await page.mouse.up({ button: "right" });
  await expect(crosshair).not.toHaveClass(/crosshair--guard/);

  await page.mouse.down({ button: "left" });
  await expect.poll(async () => (await melee()).phase).not.toBe("idle");
  await page.mouse.up({ button: "left" });
  await expect.poll(async () => (await melee()).phase).toBe("idle");
  expect(errors).toEqual([]);
});
