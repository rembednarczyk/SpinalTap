import { expect, test } from "@playwright/test";
import { freeze, gameState, step, teleport, waitForGame } from "./helpers";

/** Act II (ADR-0023): the key conversation, Kurosawa's offer on the overpass, through the dialogue UI. */
test("Kurosawa's deal on the overpass ends act II and Kagami's copy plays", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=11");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await expect(page.getByTestId("hud")).toBeVisible();
  await freeze(page);

  // Straight to the last step of act II, after the "aya" ending, Kaito's job taken.
  await page.evaluate(() =>
    window.__seki!.jump({
      quests: { m0_first_contract: { status: "completed" }, m3_echo: { status: "completed" }, m3_lustro: { status: "active", stepIndex: 3 } },
      story: { choices: { case: "opened", name: "spoken", crash: "wheel", rooftop: "together", job: "taken", voice: "listened" }, ending: "aya", act2Ending: null },
      flags: ["act1_ending", "ending:aya", "kagami_job", "met_fixer", "met_ren", "recalled:last_call", "recalled:rooftop", "ren_trail", "reported_back", "seen:act2_opening"],
    }),
  );
  expect((await gameState(page)).objective).toContain("Kurosawa z Kagami czeka na estakadzie");

  // On the overpass deck, next to him; one step streams the market in.
  await teleport(page, 98.5, 92, Math.PI / 2, 0, 9.9);
  await step(page, 2);
  await expect(page.getByTestId("prompt")).toContainText("Kurosawą");
  await step(page, 1, { interact: true });
  const dialogue = page.getByTestId("dialogue");
  await expect(dialogue).toContainText("dział odzysku");
  await expect(dialogue).toContainText("przyjęła pani zlecenie");
  await dialogue.getByRole("button", { name: /Bierzcie Rena i archiwum/ }).click();
  await expect(dialogue).toContainText("chip w białym etui");
  await dialogue.getByRole("button", { name: /Zakończ rozmowę/ }).click();
  await step(page, 2);

  await expect(page.getByText("Koniec aktu II: Lustro")).toBeVisible();
  const state = await gameState(page);
  expect(state.flags).toEqual(expect.arrayContaining(["act2_ending", "ending:kagami"]));
  // The recording from Kagami plays on its own as a flashback.
  await expect(dialogue).toContainText("Wszystko się zgadza.");
  expect(errors).toEqual([]);
});
