// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { type InventoryState, addInstance, addStack, createReputation, starterKit } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type CharacterStatsVm, DEFAULT_SETTINGS, GameUi, type TradeItemVm, type UiIntents, type UiState, type UiStore, createUiStore, patchUi } from "../src";

/**
 * Inventory, shops, bags and the character sheet in both languages (ADR-0056, stage 2a):
 * English by default, and the Polish setting shows exactly the texts the panels had before.
 */

const intents = (): UiIntents => {
  const spies = new Map<PropertyKey, unknown>();
  return new Proxy({}, { get: (_, key) => spies.get(key) ?? spies.set(key, vi.fn()).get(key) }) as UiIntents;
};

const STATS: CharacterStatsVm = { hp: 86, maxHp: 100, armor: { head: 2, torso: 3, arm: 3, leg: 3 }, critChance: 0.08, critMultiplier: 1.8, spread: 1.1, moveSpeed: 4.2 };

/** Starter kit plus an uncommon SMG, a rare revolver and scrap. */
const bag = () => {
  const { inventory, equipment, ammo } = starterKit();
  let inv: InventoryState = inventory;
  for (const [def, rarity] of [
    ["hebi_smg", "uncommon"],
    ["oni44", "rare"],
  ] as const) {
    const r = addInstance(inv, equipment, def, rarity);
    if (!r.ok) throw new Error("full");
    inv = r.inventory;
  }
  return { inventory: addStack(inv, equipment, "scrap", 3).inventory, equipment, ammo };
};

const piece = (key: string, defId: TradeItemVm["defId"], name: string, patch: Partial<TradeItemVm> = {}): TradeItemVm => ({
  key,
  ref: { uid: key },
  defId,
  name,
  category: "weapon",
  rarity: "common",
  qty: 1,
  condition: null,
  inUse: false,
  ...patch,
});

const TRADE = {
  items: [
    piece("i1", "unity9", "Unity-9", { inUse: true }),
    piece("i2", "seki_jacket", "Kurtka Seki", { category: "garment", condition: 40, inUse: true }),
    piece("i4", "hebi_smg", "Hebi SMG", { rarity: "uncommon" }),
  ],
  capacity: 24,
  freeCells: 19,
  weaponParts: 1,
};

const mount = (state: Partial<UiState>) => {
  const store = createUiStore({ screen: "playing", ...bag(), characterStats: STATS, eddies: 12345, trade: TRADE, ...state });
  render(<GameUi store={store} intents={intents()} />);
  return store;
};

const polish = (store: UiStore) => act(() => patchUi(store, { settings: { ...store.getState().settings, locale: "pl" } }));

const cell = (def: string) => screen.getAllByTestId("item-cell").find((c) => c.getAttribute("data-def") === def)!;

afterEach(cleanup);

describe("inventory and character screen in both languages", () => {
  it("is English by default and Polish as before once chosen, numbers included", () => {
    expect(DEFAULT_SETTINGS.locale).toBe("en");
    const store = mount({ characterTab: "inventory" });
    expect(screen.getAllByRole("tab").slice(0, 4).map((t) => t.textContent)).toEqual(["InventoryI", "SheetTab", "JournalJ", "MapM"]);
    expect(screen.getByTestId("menu-eddies").textContent).toBe("€$ 12,345");
    expect(screen.getByRole("button", { name: /Sort: category/ })).toBeTruthy();
    fireEvent.click(cell("oni44"), { timeStamp: 1000 });
    expect(screen.getByTestId("delta-damage").textContent).toBe("▲ +33.7");
    expect(screen.getByTestId("item-detail").textContent).toContain("Revolver · secondary");
    expect(screen.getByTestId("stats-panel").textContent).toContain("H2 T3 A3 L3");

    polish(store);
    expect(screen.getAllByRole("tab").slice(0, 4).map((t) => t.textContent)).toEqual(["EkwipunekI", "KartaTab", "DziennikJ", "MapaM"]);
    expect(screen.getByTestId("menu-eddies").textContent).toBe("€$ 12 345");
    expect(screen.getByRole("button", { name: /Sortuj: kategoria/ })).toBeTruthy();
    expect(screen.getAllByRole("tab", { name: "Broń" })).toHaveLength(1);
    const detail = screen.getByTestId("item-detail");
    expect(detail.textContent).toContain("rzadki");
    expect(detail.textContent).toContain("Rewolwer · boczna");
    expect(within(screen.getByTestId("item-compare")).getByText("Obrażenia")).toBeTruthy();
    expect(screen.getByTestId("delta-damage").textContent).toBe("▲ +33,7");
    expect(screen.getByRole("button", { name: /Załóż/ })).toBeTruthy();
    expect(screen.getByTestId("stats-panel").textContent).toBe("HP86/100PancerzG2 T3 R3 N3Kryt8% ×1,8Rozrzut1,1°");
    fireEvent.click(cell("hebi_smg"), { timeStamp: 3000 });
    expect(screen.getByTestId("item-detail").textContent).toContain("(slot główny pusty)");
    fireEvent.click(cell("scrap"), { timeStamp: 5000 });
    fireEvent.click(screen.getByRole("button", { name: /Wyrzuć/ }));
    expect(screen.getByTestId("quantity-picker").textContent).toContain("Ile wyrzucić? Złom elektroniczny, masz 3.");
    expect(screen.getByRole("button", { name: "Wyrzuć × 1" })).toBeTruthy();
  });

  it("writes the sheet in Polish as before", () => {
    const reputation = { fixers: 20, hebi: -60, civilians: 0, clinic: 0, kagami: 0, tessen: 0 };
    const store = mount({ characterTab: "sheet", alias: null, reputation });
    const sheet = () => screen.getByTestId("character-panel").textContent;
    expect(sheet()).toContain("UnknownContracts done: 0");
    expect(sheet()).toContain("-60 · hostilityThey hunt you");
    polish(store);
    expect(sheet()).toContain("NieznanaWykonane kontrakty: 0");
    expect(sheet()).toContain("Optykapusty slotUkład nerwowypusty slot");
    expect(sheet()).toContain("Pustka. Na razie.");
    expect(sheet()).toContain("+20 · sympatiaKaito płaci więcej");
    expect(sheet()).toContain("-60 · wrogośćPolują na ciebie");
    expect(sheet()).toContain("Tab zamknij · I ekwipunek · J dziennik");
    expect(screen.getByRole("dialog", { name: "Postać" })).toBeTruthy();
  });
});

describe("shops and bags in both languages", () => {
  it("Oyaji's stall: English by default, the former Polish once chosen", () => {
    const store = mount({ shopOpen: true, shopId: "oyaji", reputation: { ...createReputation(), civilians: -30 } });
    const shop = screen.getByTestId("shop");
    expect(shop.getAttribute("aria-label")).toBe("Oyaji's stall");
    expect(screen.getByTestId("shop-terms").textContent).toBe("Oyaji doesn't trust you · 25% surcharge");
    expect(within(shop).getByTestId("shop-backpack").textContent).toContain("Backpack · 24 slots");
    polish(store);
    expect(shop.getAttribute("aria-label")).toBe("Stragan Oyajiego");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Kup", "Sprzedaj", "Naprawa"]);
    expect(screen.getByTestId("shop-terms").textContent).toBe("Oyaji ci nie ufa · dopłata 25%");
    expect(shop.querySelector(".shop__wallet")?.textContent).toBe("€$ 12 345");
    expect(within(shop).getByTestId("shop-backpack").textContent).toBe("Plecak · 24 miejscWiększy plecakSześć miejsc więcej. Oyaji ma dwa rozmiary, potem już tylko walizki.Kup · 600 €$");
    expect(within(shop).getAllByRole("button", { name: /^Kup · \d+ €\$$/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Porozmawiaj z Oyajim" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "E Odejdź od straganu" })).toBeTruthy();
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    const lines = screen.getAllByTestId("shop-sell-line").map((l) => l.textContent);
    expect(lines[0]).toBe("Unity-9zwykłyW użyciu");
    expect(lines[1]).toBe("Kurtka Sekizwykły · stan 40%W użyciu");
    expect(lines[2]).toMatch(/^Hebi SMGniezwykłySprzedaj · \d+ €\$$/);
    fireEvent.click(screen.getByTestId("shop-tab-repair"));
    expect(screen.getByText("Użyj części broni (masz 1, każda −25 €$)", { exact: false })).toBeTruthy();
    expect(screen.getByTestId("shop-repair-line").textContent).toMatch(/^Kurtka Sekistan 40% · części: 1Napraw · \d+ €\$$/);
  });

  it("the clinic in Polish, with Polish thousands", () => {
    const store = mount({ shopOpen: true, shopId: "clinic", eddies: 700, cyberware: { nervous: "synapse_booster" }, capacity: { used: 5, max: 9 } });
    expect(screen.getByRole("button", { name: /Implant · 1,100 €\$/ })).toBeTruthy();
    polish(store);
    const shop = screen.getByTestId("shop");
    expect(shop.textContent).toContain("Klinika · Krakowskie PrzedmieścieDoktor Mori„Płacisz z góry. Znieczulenie wliczone, gwarancja nie.”");
    expect(screen.getByRole("button", { name: /Wszczep · 1100 €\$/ })).toBeTruthy();
    expect(screen.getAllByText("Zastąpi: Wzmacniacz synaps").length).toBeGreaterThan(0);
    expect(screen.getByTestId("capacity").textContent).toBe("Pojemność cyberware5 / 9");
    expect(screen.getAllByTestId("capacity-over")[0]!.textContent).toMatch(/^Za mało pojemności: \d+ \/ 9$/);
    expect(screen.getAllByRole("button", { name: "Ponad limit" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("shop-tab-implants"));
    expect(screen.getByText("Z plecaka")).toBeTruthy();
    expect(screen.getByText("W plecaku nie masz żadnego wszczepu.")).toBeTruthy();
    expect(within(screen.getByTestId("shop-installed")).getByRole("button", { name: "Wymontuj · za darmo" })).toBeTruthy();
  });

  it("a bag: English by default, the former Polish once chosen", () => {
    const loot = {
      key: "loot:guard",
      owner: "ganger" as const,
      lines: [
        { index: 0, kind: "ammo" as const, label: "9 mm", qty: 9, rarity: null },
        { index: 1, kind: "item" as const, label: "Hebi SMG", qty: 1, rarity: "rare" as const },
      ],
    };
    const store = mount({ loot });
    const panel = screen.getByTestId("loot");
    expect(panel.textContent).toBe("BagGanger's bag9 mm ammo× 9TakeHebi SMGrareTakeLeaveE Take all");
    polish(store);
    expect(panel.getAttribute("aria-label")).toBe("Zawartość torby");
    expect(panel.textContent).toBe("TorbaTorba gangeraAmunicja 9 mm× 9WeźHebi SMGrzadkiWeźZostawE Weź wszystko");
    act(() => patchUi(store, { loot: { ...loot, owner: "own", lines: [] } }));
    expect(panel.textContent).toBe("TorbaTwoja torbaPusto.ZostawE Weź wszystko");
  });
});
