import { expect, test } from "@playwright/test";
import { freeze, gameState, place, step, teleportTo, newGame, waitForGame, waitForPlay } from "./helpers";

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
    await expect(page.getByRole("button", { name: "Load Game" })).toBeDisabled();
    // The new game starts behind the loading screen (ADR-0057): seen by the page itself, so a
    // short loading cannot slip between two polls.
    await page.evaluate(() => {
      const w = window as unknown as { __loadingSeen: boolean };
      w.__loadingSeen = false;
      new MutationObserver(() => {
        if (document.querySelector("[data-testid=loading-screen]")) w.__loadingSeen = true;
      }).observe(document.body, { childList: true, subtree: true });
    });
    await newGame(page);
    const startMs = await waitForPlay(page);
    test.info().annotations.push({ type: "start", description: `new game on screen ${startMs} ms after the click` });
    expect(await page.evaluate(() => (window as unknown as { __loadingSeen: boolean }).__loadingSeen)).toBe(true);
    await expect(page.getByTestId("hud")).toBeVisible();
    await freeze(page);
    expect((await gameState(page)).screen).toBe("playing");

    // Movement goes through the whole loop: off the chair, east across the clinic (ADR-0045).
    const start = (await gameState(page)).player!;
    await step(page, 60, { moveZ: 1 });
    const moved = (await gameState(page)).player!;
    expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(2.5);

    // Talk to Kaito through the real dialogue UI.
    // Kaito waits at the Neon Koi counter from the start (G-034): stand 1.5 m in front of him.
    await teleportTo(page, await place(page, "koi", 11.25, 3.5), Math.PI);
    await step(page, 1);
    await expect(page.getByTestId("prompt")).toContainText("Kaito");
    await step(page, 1, { interact: true });
    const dialogue = page.getByTestId("dialogue");
    await expect(dialogue).toContainText("walking corpse");
    await dialogue.getByRole("button", { name: /Who are you/ }).click();
    await dialogue.getByRole("button", { name: /Fine\. Seki Senshi/ }).click();
    await dialogue.getByRole("button", { name: /End conversation/ }).click();
    await expect(dialogue).toBeHidden();
    await step(page, 2);
    await expect(page.getByTestId("objective")).toContainText("Hebi courier");
    expect((await gameState(page)).alias).toBe("Seki Senshi");

    // Quicksave, move away, quickload: position and quest state come back.
    // The toast lives 4.5 s of the wall clock (`TOAST_MS`): on a busy machine a frame can outlast it
    // between two polls, so the page itself notes it, as with the loading screen above.
    await page.evaluate(() => {
      const w = window as unknown as { __savedSeen: boolean };
      w.__savedSeen = false;
      new MutationObserver(() => {
        if ([...document.querySelectorAll(".toast__title")].some((t) => t.textContent?.includes("Game saved"))) w.__savedSeen = true;
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    await page.keyboard.press("F5");
    await page.waitForFunction(() => (window as unknown as { __savedSeen: boolean }).__savedSeen, undefined, { timeout: 20_000 });
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
    await page.getByRole("button", { name: "Load Game" }).click();
    // The conversation that gave the job autosaved once it closed (P0 of the gap audit).
    await expect(page.getByRole("button", { name: /^Autosave/ })).toBeEnabled();
    await page.getByRole("button", { name: /^Quicksave/ }).click();
    await waitForPlay(page);
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
    await newGame(page);
    await waitForPlay(page);
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
  await newGame(page);
  await waitForPlay(page);
  await freeze(page);
  // Mori at his monitors behind the chair (ADR-0038).
  await teleportTo(page, await place(page, "clinic", -15.2, 5.2), 0);
  await step(page, 1);
  await expect(page.getByTestId("prompt")).toContainText("Mori");
  await step(page, 1, { interact: true });
  const shop = page.getByTestId("shop");
  await expect(shop).toBeVisible();
  await expect(shop.getByRole("button", { name: /Implant · 650/ })).toBeDisabled();
  await shop.getByRole("button", { name: /Buy · 90/ }).click();
  await step(page, 1);
  await expect(page.getByTestId("gear")).toContainText("Medkits × 2");
  expect((await gameState(page)).eddies).toBe(30);
  await shop.getByRole("button", { name: /Leave the clinic/ }).click();
  await expect(shop).toBeHidden();

  // The counter also leads to a conversation with Mori (ink knot "mori").
  await step(page, 1, { interact: true });
  await expect(shop).toBeVisible();
  await shop.getByRole("button", { name: "Talk to Mori" }).click();
  await expect(shop).toBeHidden();
  const dialogue = page.getByTestId("dialogue");
  // Before the first talk with Kaito, Mori sends Seki to him at Neon Koi (G-034).
  await expect(dialogue).toContainText("He's waiting for you at the Neon Koi");
  await dialogue.getByRole("button", { name: /End conversation/ }).click();
  await expect(dialogue).toBeHidden();
  await step(page, 1);
  expect((await gameState(page)).dialogue).toBe(false);
});

test("journal, minimap and settings", async ({ page }) => {
  // Two cold page loads; on a busy CI runner they alone can take a minute.
  test.slow();
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await newGame(page);
  await waitForPlay(page);
  await freeze(page);
  await step(page, 1);

  await expect(page.getByTestId("minimap")).toBeVisible();
  await expect(page.getByTestId("minimap-marker-fixer")).toHaveCount(1);
  await expect(page.getByTestId("minimap-marker-target")).toHaveCount(1);

  await page.keyboard.press("KeyJ");
  const journal = page.getByTestId("journal");
  await expect(journal).toBeVisible();
  await expect(journal).toContainText("First job");
  await expect(journal).toContainText("Talk to Kaito");
  await page.keyboard.press("KeyJ");
  await expect(journal).toBeHidden();

  // The character menu's box is where the canvas draws the 3D preview: a real part of the screen.
  await page.keyboard.press("KeyI");
  await expect(page.getByTestId("character-screen")).toBeVisible();
  const box = (await page.getByTestId("character-preview").boundingBox())!;
  expect(box.width).toBeGreaterThan(180);
  expect(box.height).toBeGreaterThan(300);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("character-screen")).toBeHidden();

  // Headless Chromium may hold the pointer lock, which swallows Esc; pause through the session.
  await page.evaluate(() => window.__seki!.session.pause());
  await expect(page.getByTestId("pause-menu")).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Low" }).click();
  await expect(page.getByTestId("settings-reload")).toBeVisible();
  await page.reload();
  await waitForGame(page);
  expect(await page.evaluate(() => (JSON.parse(localStorage.getItem("seki.settings.v1") ?? "{}") as { quality?: string }).quality)).toBe("low");
});
