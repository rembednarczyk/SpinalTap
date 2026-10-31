// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import {
  AMMO_CATALOG,
  GARMENT_CATALOG,
  MOD_CATALOG,
  RARITY,
  SHOPS,
  STACKABLE_CATALOG,
  WEAPON_CATALOG,
  starterKit,
  stockEntry,
  stockName,
  shopItemDescription,
  textRef,
} from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, createUiStore, isMessageKey, translateText } from "../src";

/**
 * The game data of `packages/core` in both languages (ADR-0056, stage 3): core hands over keys,
 * the catalogs hold the words, English by default and the former Polish texts when chosen.
 */

const intents = (): UiIntents => {
  const spies = new Map<PropertyKey, unknown>();
  return new Proxy({}, { get: (_, key) => spies.get(key) ?? spies.set(key, vi.fn()).get(key) }) as UiIntents;
};

/** Every key the core catalogs hand over. */
const coreKeys = (): string[] => [
  ...Object.values(STACKABLE_CATALOG).flatMap((d) => [d.name, d.description]),
  ...Object.values(AMMO_CATALOG).map((d) => d.name),
  ...Object.values(GARMENT_CATALOG).flatMap((d) => [d.name, d.description]),
  ...Object.values(MOD_CATALOG).flatMap((d) => [d.name, d.description]),
  ...Object.values(WEAPON_CATALOG).flatMap((d) => [d.name, d.description]),
  ...Object.values(RARITY).map((r) => r.label),
  ...Object.values(SHOPS).map((s) => s.name),
];

afterEach(cleanup);

describe("domain texts (ADR-0056, stage 3)", () => {
  it("every key core hands over is in the catalogs", () => {
    expect(coreKeys().filter((k) => !isMessageKey(k))).toEqual([]);
  });

  it("translates a key, a key with parameters and the texts inside them; a non-key stays as it is", () => {
    expect(translateText("en", "item.medkit.name")).toBe("Medkit");
    expect(translateText("pl", "item.medkit.name")).toBe("Apteczka");
    const box = textRef("shop.stock.ammo", { ammo: textRef("ammo.12g"), qty: 8 });
    expect(translateText("en", box)).toBe("12 gauge × 8");
    expect(translateText("pl", box)).toBe("Śrut 12 × 8");
    expect(translateText("pl", "Stragan Oyajiego")).toBe("Stragan Oyajiego");
    expect(translateText("en", textRef("no.such.key"))).toBe("no.such.key");
  });

  it("names the shop's stock and its counter text in the chosen language", () => {
    const box = stockEntry("oyaji", "9mm")!;
    expect(translateText("en", stockName(box))).toBe("9 mm × 24");
    expect(translateText("en", shopItemDescription("556"))).toBe("A box of 5.56 mm rounds, straight into the pouch.");
    expect(translateText("pl", shopItemDescription("556"))).toBe("Pudełko nabojów 5,56 mm, prosto do ładownicy.");
    expect(translateText("pl", shopItemDescription("suppressor"))).toBe("Strzał słychać tylko z bliska (alarm 8 m zamiast 22 m). Obrażenia ×0,95.");
  });

  it("shows items in the inventory in English by default and in Polish when chosen", () => {
    const kit = starterKit();
    const mount = (locale: "en" | "pl") => {
      const store = createUiStore({ screen: "playing", characterTab: "inventory", ...kit, settings: { ...DEFAULT_SETTINGS, locale } });
      render(<GameUi store={store} intents={intents()} />);
    };
    mount("en");
    expect(screen.getByTestId("slot-torso").textContent).toContain("Seki's jacket");
    expect(screen.getByTestId("ammo-pouch").textContent).toContain("9 mm");
    cleanup();
    mount("pl");
    expect(screen.getByTestId("slot-torso").textContent).toContain("Kurtka Seki");
  });
});
