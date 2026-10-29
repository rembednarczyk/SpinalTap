import { expect, test } from "@playwright/test";
import { freeze, gameState, place, step, teleportTo, waitForGame } from "./helpers";

test.describe("M0 smoke", () => {
  test("title → new game → dialogue → quicksave/quickload → reload and load from IndexedDB", async ({ page }) => {
    // Two cold boots (the first load and the reload), each about a minute on a CI runner with
    // the VRoid cast and the city kit: more than the default 90 s.
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?seed=7&models=off");
    await waitForGame(page);

    // Title screen with the scene rendering behind it.
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await expect(page.getByRole("button", { name: "Wczytaj" })).toBeDisabled();
    await page.getByRole("button", { name: "Nowa gra" }).click();
    await expect(page.getByTestId("hud")).toBeVisible();
    await freeze(page);
    expect((await gameState(page)).screen).toBe("playing");

    // Movement goes through the whole loop: off the chair, east across the clinic (ADR-0045).
    const start = (await gameState(page)).player!;
    await step(page, 60, { moveZ: 1 });
    const moved = (await gameState(page)).player!;
    expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(2.5);

    // Talk to Kaito through the real dialogue UI.
    // Kaito waits by the chair in the clinic (ADR-0038), a tenement's room since ADR-0045.
    await teleportTo(page, await place(page, "clinic", -13.3, 4.7), Math.PI * 1.5);
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
    // Wait for the loaded state itself: under load the re-dressing hitch can outlast the toast.
    await expect.poll(async () => (await gameState(page)).player, { timeout: 30_000 }).toEqual(saved.player);
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
    await page.goto("/?seed=7&models=off");
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
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  // Mori at his monitors behind the chair (ADR-0038).
  await teleportTo(page, await place(page, "clinic", -15.2, 5.2), 0);
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

test("journal, minimap and settings", async ({ page }) => {
  // Two cold page loads; on a busy CI runner they alone can take a minute.
  test.slow();
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await step(page, 1);

  await expect(page.getByTestId("minimap")).toBeVisible();
  await expect(page.getByTestId("minimap-marker-fixer")).toHaveCount(1);
  await expect(page.getByTestId("minimap-marker-target")).toHaveCount(1);

  await page.keyboard.press("KeyJ");
  const journal = page.getByTestId("journal");
  await expect(journal).toBeVisible();
  await expect(journal).toContainText("Pierwsze zlecenie");
  await expect(journal).toContainText("Porozmawiaj z Kaito");
  await page.keyboard.press("KeyJ");
  await expect(journal).toBeHidden();

  // Headless Chromium may hold the pointer lock, which swallows Esc; pause through the session.
  await page.evaluate(() => window.__seki!.session.pause());
  await expect(page.getByTestId("pause-menu")).toBeVisible();
  await page.getByRole("button", { name: "Ustawienia" }).click();
  await page.getByRole("radio", { name: "Niska" }).click();
  await expect(page.getByTestId("settings-reload")).toBeVisible();
  await page.reload();
  await waitForGame(page);
  expect(await page.evaluate(() => (JSON.parse(localStorage.getItem("seki.settings.v1") ?? "{}") as { quality?: string }).quality)).toBe("low");
});

test("touch layout keeps the minimap off the pad", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?seed=7&touch&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await step(page, 1);
  const map = await page.getByTestId("minimap").boundingBox();
  expect(map).not.toBeNull();
  expect(map!.width).toBeLessThan(100);
  const pad = page.getByTestId("touch-controls").getByRole("button");
  const count = await pad.count();
  expect(count).toBeGreaterThan(4);
  for (let i = 0; i < count; i++) {
    const b = await pad.nth(i).boundingBox();
    if (!b) continue;
    const overlaps = map!.x < b.x + b.width && b.x < map!.x + map!.width && map!.y < b.y + b.height && b.y < map!.y + map!.height;
    expect(overlaps, `minimap overlaps ${await pad.nth(i).getAttribute("aria-label")}`).toBe(false);
  }
});

test("touch layout keeps the weapon strip off the pad and the minimap", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?seed=7&touch&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await freeze(page);
  await step(page, 1);
  const strip = await page.getByTestId("weapon-strip").boundingBox();
  expect(strip).not.toBeNull();
  const inside = strip!.x >= 0 && strip!.y >= 0 && strip!.x + strip!.width <= 844 && strip!.y + strip!.height <= 390;
  expect(inside, "weapon strip on screen").toBe(true);
  const overlap = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const map = await page.getByTestId("minimap").boundingBox();
  expect(overlap(strip!, map!), "weapon strip overlaps the minimap").toBe(false);
  const clock = await page.getByTestId("clock").boundingBox();
  expect(overlap(strip!, clock!), "weapon strip overlaps the clock").toBe(false);
  expect(overlap(clock!, map!), "clock overlaps the minimap").toBe(false);
  const pad = page.getByTestId("touch-controls").getByRole("button");
  const count = await pad.count();
  expect(count).toBeGreaterThan(4);
  for (let i = 0; i < count; i++) {
    const b = await pad.nth(i).boundingBox();
    if (!b) continue;
    expect(overlap(strip!, b), `weapon strip overlaps ${await pad.nth(i).getAttribute("aria-label")}`).toBe(false);
  }
  // The strip's slots are touch targets of at least 44 px.
  const slot = await page.getByRole("button", { name: /Boczna: Unity-9/ }).boundingBox();
  expect(slot!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("button", { name: "Przeładuj" })).toBeVisible();
});
