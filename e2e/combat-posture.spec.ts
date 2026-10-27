import { expect, test } from "@playwright/test";
import { freeze, step, waitForGame } from "./helpers";

test("crouching lowers the view and pulls the crosshair in; running spreads it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=7");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await expect(page.getByTestId("hud")).toBeVisible();
  await freeze(page);
  await step(page, 2);

  const crosshair = page.getByTestId("crosshair");
  const spread = async () => Number(await crosshair.getAttribute("data-spread"));
  const standing = await spread();
  expect(standing).toBeGreaterThan(0);
  const cameraY = () => page.evaluate(() => window.__seki!.cameraY());
  const eyeStanding = await cameraY();

  // Crouch held: the sim eases down, the camera and the HUD follow.
  await step(page, 20, { crouch: true });
  await expect(crosshair).toHaveClass(/crosshair--crouched/);
  expect(await spread()).toBeLessThan(standing * 0.6);
  await expect.poll(async () => eyeStanding - (await cameraY())).toBeGreaterThan(0.35);

  await step(page, 20, { moveZ: 1, sprint: true });
  await expect(crosshair).not.toHaveClass(/crosshair--crouched/);
  expect(await spread()).toBeGreaterThan(standing);

  expect(errors).toEqual([]);
});
