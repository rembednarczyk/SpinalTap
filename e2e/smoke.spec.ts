import { expect, test } from "@playwright/test";
import { freeze, gameState, step, teleport, waitForGame } from "./helpers";

test.describe("M0 smoke", () => {
  test("title → new game → dialogue → quicksave/quickload → reload and load from IndexedDB", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?seed=7");
    await waitForGame(page);

    // Title screen with the scene rendering behind it.
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await expect(page.getByRole("button", { name: "Wczytaj" })).toBeDisabled();
    await page.getByRole("button", { name: "Nowa gra" }).click();
    await expect(page.getByTestId("hud")).toBeVisible();
    await freeze(page);
    expect((await gameState(page)).screen).toBe("playing");

    // Movement goes through the whole loop.
    const start = (await gameState(page)).player!;
    await step(page, 60, { moveZ: 1 });
    expect((await gameState(page)).player!.z).toBeGreaterThan(start.z + 3);

    // Talk to Kaito through the real dialogue UI.
    await teleport(page, 4.6, 1.5, Math.PI / 2);
    await step(page, 1);
    await expect(page.getByTestId("prompt")).toContainText("Kaito");
    await step(page, 1, { interact: true });
    const dialogue = page.getByTestId("dialogue");
    await expect(dialogue).toContainText("Chodzący trup");
    await dialogue.getByRole("button", { name: /Kim jesteś/ }).click();
    await dialogue.getByRole("button", { name: /Niech będzie/ }).click();
    await dialogue.getByRole("button", { name: /Zakończ rozmowę/ }).click();
    await expect(dialogue).toBeHidden();
    await step(page, 2);
    await expect(page.getByTestId("objective")).toContainText("kuriera Hebi");
    expect((await gameState(page)).alias).toBe("Seki Senshi");

    // Quicksave, move away, quickload: position and quest state come back.
    await page.keyboard.press("F5");
    await expect(page.getByText("Zapisano grę")).toBeVisible();
    const saved = await gameState(page);
    await step(page, 120, { moveZ: -1 });
    expect((await gameState(page)).player).not.toEqual(saved.player);
    await page.keyboard.press("F9");
    await expect(page.getByText("Wczytano grę")).toBeVisible();
    const loaded = await gameState(page);
    expect(loaded.player).toEqual(saved.player);
    expect(loaded.flags).toEqual(saved.flags);
    expect(loaded.objective).toBe(saved.objective);

    // The save lives in IndexedDB: it survives a page reload.
    await page.reload();
    await waitForGame(page);
    await page.getByRole("button", { name: "Wczytaj" }).click();
    await page.getByRole("button", { name: /Szybki zapis/ }).click();
    await expect(page.getByTestId("hud")).toBeVisible();
    await freeze(page);
    const restored = await gameState(page);
    expect(restored.alias).toBe("Seki Senshi");
    expect(restored.player).toEqual(saved.player);

    expect(errors).toEqual([]);
  });

  test("camera toggles between FPP and TPP", async ({ page }) => {
    await page.goto("/?seed=7");
    await waitForGame(page);
    await page.getByRole("button", { name: "Nowa gra" }).click();
    await freeze(page);
    await step(page, 1, { toggleCamera: true });
    await expect(page.getByText("TPP · [V]")).toBeVisible();
    expect((await gameState(page)).cameraMode).toBe("TPP");
    await step(page, 1, { toggleCamera: true });
    expect((await gameState(page)).cameraMode).toBe("FPP");
  });
});

test("ripperdoc clinic sells a medkit through the UI", async ({ page }) => {
  await page.goto("/?seed=7");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await teleport(page, -4.6, 2.4, -Math.PI / 2);
  await step(page, 1);
  await expect(page.getByTestId("prompt")).toContainText("Mori");
  await step(page, 1, { interact: true });
  const shop = page.getByTestId("shop");
  await expect(shop).toBeVisible();
  await expect(shop.getByRole("button", { name: /Wszczep · 650/ })).toBeDisabled();
  await shop.getByRole("button", { name: /Kup · 90/ }).click();
  await step(page, 1);
  await expect(page.getByTestId("gear")).toContainText("Apteczki × 2");
  expect((await gameState(page)).eddies).toBe(30);
  await shop.getByRole("button", { name: /Wyjdź z kliniki/ }).click();
  await expect(shop).toBeHidden();

  // The counter also leads to a conversation with Mori (ink knot "mori").
  await step(page, 1, { interact: true });
  await expect(shop).toBeVisible();
  await shop.getByRole("button", { name: "Porozmawiaj z Mori" }).click();
  await expect(shop).toBeHidden();
  const dialogue = page.getByTestId("dialogue");
  await expect(dialogue).toContainText("Coś boli?");
  await dialogue.getByRole("button", { name: /Zakończ rozmowę/ }).click();
  await expect(dialogue).toBeHidden();
  await step(page, 1);
  expect((await gameState(page)).dialogue).toBe(false);
});
