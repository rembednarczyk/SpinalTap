import { expect, test } from "@playwright/test";
import { freeze, gameState, place, step, teleport, teleportTo, waitForGame } from "./helpers";

test("rides the metro from Plac Zamkowy to Nabrzeże Bystrzycy without a reload and takes Genzō's job in the dialogue", async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=13&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await expect(page.getByTestId("hud")).toBeVisible();
  await freeze(page);
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));

  // Plac Zamkowy below the castle: the docks are reached by the metro only (ADR-0045).
  await teleport(page, 717.5, 296, 0);
  await step(page, 1);
  expect((await gameState(page)).district).toBe("targ");
  // In front of the station's kiosk, facing it.
  const front = await page.evaluate(() => {
    const k = [...window.__seki!.session.sim.world].find((e) => e.interactable?.kind === "metro" && e.interactable.station === "targ")!;
    return { x: k.position.x + Math.sin(k.yaw), z: k.position.z + Math.cos(k.yaw), yaw: k.yaw + Math.PI };
  });
  await teleport(page, front.x, front.z, front.yaw);
  await step(page, 1);
  await expect(page.getByTestId("prompt")).toContainText("Bilet");
  await step(page, 1, { interact: true });
  await expect(page.getByTestId("metro-map")).toBeVisible();
  await page.getByRole("button", { name: /Bilet do: Nabrzeże Bystrzycy/ }).click();
  await expect.poll(async () => {
    await step(page, 60);
    return (await gameState(page)).district;
  }, { timeout: 60_000 }).toBe("doki");
  let s = await gameState(page);
  expect(s.loadedChunks).toContain("nabrzeze-1-1");
  expect(s.loadedChunks).not.toContain("krakowskie-2-0");
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);

  // Genzō stands by his container office.
  await teleportTo(page, await place(page, "docks", 20.9, 95.8), 0);
  await step(page, 1);
  await expect(page.getByTestId("prompt")).toContainText("Genzō");
  await step(page, 1, { interact: true });
  const dialogue = page.getByTestId("dialogue");
  await expect(dialogue).toContainText("Pływam nocą");
  await dialogue.getByRole("button", { name: /Kogo trzeba przeprowadzić/ }).click();
  await expect(dialogue).toContainText("Mika");
  await dialogue.getByRole("button", { name: /Zakończ rozmowę/ }).click();
  await expect(dialogue).toBeHidden();
  await step(page, 2);
  s = await gameState(page);
  expect(s.flags).toContain("met_genzo");
  await expect(page.getByText("Nowy kontrakt: Eskorta")).toBeVisible();
  await expect(page.getByTestId("minimap")).toBeVisible();
  expect(errors).toEqual([]);
});
