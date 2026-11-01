import { describe, expect, it } from "vitest";
import type { Locale } from "@seki/core";
import { MemorySaveStore } from "@seki/persistence";
import { patchUi } from "@seki/ui";
import { slotDateLabel } from "../src/controllers/save-controller";
import { saveLabel } from "../src/objective";
import { type Ui, setup } from "./story-helpers";

/** Saving in both languages (ADR-0056, stage 2b): the toasts, and the slot's date as en-GB or pl-PL. */

const speak = (ui: Ui, locale: Locale) => patchUi(ui, { settings: { ...ui.getState().settings, locale } });
const titles = (ui: Ui) => ui.getState().toasts.map((t) => t.title);

describe("slot date", () => {
  it("is en-GB in English and, in Polish, exactly the label the game always wrote", () => {
    const at = new Date(2026, 9, 27, 21, 5);
    expect(slotDateLabel(at, "en")).toBe("27/10, 21:05");
    expect(slotDateLabel(at, "pl")).toBe("27.10, 21:05");
    expect(slotDateLabel(at, "pl")).toBe(saveLabel(at));
  });
});

describe("saving and loading in the session", () => {
  it("says it in English by default, with the slot dated en-GB", async () => {
    const store = new MemorySaveStore();
    const { session, ui } = setup(store);
    session.newGame();
    expect(await session.saves.saveAsync("quick")).toBe(true);
    expect(ui.getState().toasts.at(-1)).toMatchObject({ title: "Game saved", text: "Quicksave" });
    expect(ui.getState().slots.find((s) => s.slot === "quick")?.savedAtLabel).toBe("27/10, 00:00");
    expect(await session.saves.loadAsync("slot-2")).toBe(false);
    expect(ui.getState().toasts.at(-1)).toMatchObject({ title: "Empty slot", text: "slot-2" });
    expect(await session.saves.loadAsync("quick")).toBe(true);
    expect(titles(ui)).toContain("Game loaded");
  });

  it("says it in Polish as before once chosen, the slot dated as before", async () => {
    const store = new MemorySaveStore();
    const { session, ui } = setup(store);
    session.newGame();
    speak(ui, "pl");
    expect(await session.saves.saveAsync("quick")).toBe(true);
    expect(ui.getState().toasts.at(-1)).toMatchObject({ title: "Zapisano grę", text: "Szybki zapis" });
    expect(ui.getState().slots.find((s) => s.slot === "quick")?.savedAtLabel).toBe("27.10, 00:00");
    await store.put("slot-3", "{corrupt");
    expect(await session.saves.loadAsync("slot-3")).toBe(false);
    expect(ui.getState().toasts.at(-1)).toMatchObject({ title: "Nie udało się wczytać", text: "Plik zapisu jest uszkodzony." });
    // The corrupt slot is a code the slot list says in the player's language.
    await session.saves.saveAsync("slot-1");
    expect(ui.getState().slots.find((s) => s.slot === "slot-3")).toEqual({ slot: "slot-3", savedAtLabel: "—", objective: "save.corrupt" });
  });
});
