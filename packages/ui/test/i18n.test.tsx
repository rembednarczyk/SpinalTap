// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCALES } from "@seki/core";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, type UiState, createUiStore, formatMessage, isMessageKey, patchUi, translate, translator } from "../src";
import { en } from "../src/i18n/en";
import { pl } from "../src/i18n/pl";

/** Every intent a no-op spy; the menus raise only a few of them. */
const intents = (): UiIntents => {
  const spies = new Map<PropertyKey, unknown>();
  return new Proxy({}, { get: (_, key) => spies.get(key) ?? spies.set(key, vi.fn()).get(key) }) as UiIntents;
};

const mount = (state: Partial<UiState> = {}) => {
  const store = createUiStore(state);
  const i = intents();
  render(<GameUi store={store} intents={i} />);
  return { store, i };
};

afterEach(cleanup);

const forms = (m: string | Readonly<Record<string, string>>): string[] => (typeof m === "string" ? [m] : Object.values(m));
/** The parameters of one form, each once, sorted. */
const slotsOf = (f: string): string[] => [...new Set([...f.matchAll(/\{(\w+)\}/g)].map((x) => x[1]!))].sort();
/** The plural forms a language needs: English one and other, Polish also few and many (ADR-0059, stage 7). */
const PLURAL_FORMS = { en: ["one", "other"], pl: ["few", "many", "one", "other"] } as const;

describe("catalogs (ADR-0056)", () => {
  it("Polish has exactly the English keys, none empty, with the same parameters", () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
    for (const catalog of [en, pl]) for (const [key, m] of Object.entries(catalog)) for (const f of forms(m)) expect(f.trim(), key).not.toBe("");
    for (const key of Object.keys(en)) {
      if (!isMessageKey(key)) continue;
      const [e, p] = [en[key], pl[key]];
      // Plural in one language, plural in the other, each with all its forms.
      expect(typeof p, key).toBe(typeof e);
      if (typeof e !== "string" && typeof p !== "string") {
        expect(Object.keys(e).sort(), key).toEqual([...PLURAL_FORMS.en]);
        expect(Object.keys(p).sort(), key).toEqual([...PLURAL_FORMS.pl]);
      }
      // Every form of either language takes the same parameters as the English `other`.
      const want = slotsOf(typeof e === "string" ? e : e.other);
      for (const f of [...forms(e), ...forms(p)]) expect(slotsOf(f), key).toEqual(want);
    }
  });

  it("counts the points in both languages' plural forms (ADR-0059, stage 7)", () => {
    expect([1, 3, 5, 22].map((count) => translate("pl", "progress.unspent", { count }))).toEqual(["1 punkt do rozdania", "3 punkty do rozdania", "5 punktów do rozdania", "22 punkty do rozdania"]);
    expect([1, 3].map((count) => translate("en", "progress.unspent", { count }))).toEqual(["1 point to spend", "3 points to spend"]);
  });

  it("puts named parameters in and leaves unknown slots alone", () => {
    expect(translate("en", "slots.slot", { n: 2 })).toBe("Slot 2");
    expect(translate("pl", "settings.keys.reserved", { key: "P" })).toBe("Klawisz P jest zajęty przez menu gry.");
    expect(translate("en", "settings.keys.changeLabel")).toBe("Change key: {control}");
    expect(translator("pl")("title.newGame")).toBe("Nowa gra");
  });

  it("picks the plural form with Intl.PluralRules", () => {
    const shots = { one: "{count} shot", other: "{count} shots" };
    expect(formatMessage("en", shots, { count: 1 })).toBe("1 shot");
    expect(formatMessage("en", shots, { count: 5 })).toBe("5 shots");
    const strzaly = { one: "{count} strzał", few: "{count} strzały", many: "{count} strzałów", other: "{count} strzału" };
    expect([1, 2, 5, 22, 1.5].map((count) => formatMessage("pl", strzaly, { count }))).toEqual(["1 strzał", "2 strzały", "5 strzałów", "22 strzały", "1.5 strzału"]);
    // Without a count, or without the form, the other one.
    expect(formatMessage("pl", { other: "dużo" })).toBe("dużo");
  });

  it("knows which keys exist", () => {
    expect(isMessageKey("control.jump")).toBe(true);
    expect(isMessageKey("control.nothing")).toBe(false);
    expect(isMessageKey("toString")).toBe(false);
  });
});

describe("language of the menus", () => {
  it("is English by default", () => {
    expect(DEFAULT_SETTINGS.locale).toBe("en");
    mount();
    expect(screen.getByRole("button", { name: "New Game" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Load Game" })).toBeTruthy();
    expect(screen.queryByText("Nowa gra")).toBeNull();
  });

  it("switches at once when the setting changes, with no restart", () => {
    const { store } = mount();
    act(() => patchUi(store, { settings: { ...DEFAULT_SETTINGS, locale: "pl" } }));
    expect(screen.getByRole("button", { name: "Nowa gra" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Autorzy" })).toBeTruthy();
    act(() => patchUi(store, { settings: { ...DEFAULT_SETTINGS, locale: "en" } }));
    expect(screen.getByRole("button", { name: "New Game" })).toBeTruthy();
  });

  it("shows the pause menu and its slots in Polish when chosen", () => {
    mount({ screen: "paused", settings: { ...DEFAULT_SETTINGS, locale: "pl" }, slots: [{ slot: "quick", savedAtLabel: "x", objective: "y" }] });
    expect(screen.getByText("Pauza")).toBeTruthy();
    fireEvent.click(screen.getByText("Wczytaj"));
    expect(screen.getByText("Szybki zapis")).toBeTruthy();
    expect(screen.getAllByText("pusty").length).toBeGreaterThan(0);
  });

  it("rounds the sensitivity values as before and changes only the separator", () => {
    const { store } = mount({ screen: "paused", settings: { ...DEFAULT_SETTINGS, touchSensitivity: 0.35, locale: "pl" } });
    fireEvent.click(screen.getByText("Ustawienia"));
    fireEvent.click(screen.getByRole("tab", { name: "Dotyk i pad" }));
    expect(screen.getByText("0,3×")).toBeTruthy();
    act(() => patchUi(store, { settings: { ...store.getState().settings, locale: "en" } }));
    expect(screen.getByText("0.3×")).toBeTruthy();
  });

  it("offers both languages under their own names in the options and sends the choice", () => {
    const { store, i } = mount({ screen: "paused" });
    fireEvent.click(screen.getByText("Settings"));
    const language = screen.getByRole("radiogroup", { name: "Language / Język" });
    const options = within(language).getAllByRole("radio");
    expect(options.map((o) => o.textContent)).toEqual(["English", "Polski"]);
    expect(LOCALES).toHaveLength(options.length);
    expect(within(language).getByRole("radio", { name: "English" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(language).getByRole("radio", { name: "Polski" }));
    expect(i.changeSettings).toHaveBeenCalledWith({ locale: "pl" });
    // The app saves it and puts it in the store; the panel follows in place.
    act(() => patchUi(store, { settings: { ...store.getState().settings, locale: "pl" } }));
    expect(screen.getByRole("tab", { name: "Ogólne" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Language / Język" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Dotyk i pad" }));
    expect(screen.getAllByText("1,0×").length).toBeGreaterThan(0);
  });
});
