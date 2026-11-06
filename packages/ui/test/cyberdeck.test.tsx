// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createCharacter, createReputation, addInstance, implantOffer, installCyberwareItem, itemIcon, priceWithTerms, shopTerms, starterKit } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, type TradeItemVm, type UiIntents, type UiState, type UiStore, createUiStore, patchUi } from "../src";
import { ICON_PATHS } from "../src/icons/icon-paths";

/** The cyberdeck implant on the item card and at Mori's clinic (decision of 6.11 after ADR-0059 stage 6), in both languages. */

const DECK = "kumo_cyberdeck" as const;

const intents = (): UiIntents => {
  const spies = new Map<PropertyKey, unknown>();
  return new Proxy({}, { get: (_, key) => spies.get(key) ?? spies.set(key, vi.fn()).get(key) }) as UiIntents;
};

/** Starter kit plus a rare cyberdeck of level 10. */
const bag = () => {
  const { inventory, equipment, ammo } = starterKit();
  const deck = addInstance(inventory, equipment, DECK, { rarity: "rare", level: 10 });
  if (!deck.ok) throw new Error("full");
  return { inventory: deck.inventory, equipment, ammo };
};

let spies: UiIntents = intents();

const mount = (state: Partial<UiState>) => {
  const store = createUiStore({ screen: "playing", ...bag(), eddies: 99999, ...state });
  spies = intents();
  render(<GameUi store={store} intents={spies} />);
  return store;
};

const polish = (store: UiStore) => act(() => patchUi(store, { settings: { ...store.getState().settings, locale: "pl" } }));

const cell = (def: string) => screen.getAllByTestId("item-cell").find((c) => c.getAttribute("data-def") === def)!;

afterEach(cleanup);

describe("the cyberdeck's card", () => {
  it("has an icon of its own, a tier, a level and what it does, in English and in Polish", () => {
    expect(itemIcon(DECK)).toBe("deck");
    expect(ICON_PATHS.deck.body.length).toBeGreaterThan(0);
    const store = mount({ characterTab: "inventory" });
    expect(cell(DECK).querySelector("svg")).not.toBeNull();
    fireEvent.click(cell(DECK), { timeStamp: 1000 });
    const detail = () => screen.getByTestId("item-detail");
    expect(detail().textContent).toContain("Kumo cyberdeck");
    expect(detail().textContent).toContain("rare");
    expect(screen.getByTestId("item-level").textContent).toBe("Level 10");
    expect(screen.getByTestId("deck-stats").textContent).toBe("RAM +3 · upload −12.6% · RAM recovery +15.8%");
    polish(store);
    expect(detail().textContent).toContain("Cyberdeck Kumo");
    expect(screen.getByTestId("item-level").textContent).toBe("Poziom 10");
    expect(screen.getByTestId("deck-stats").textContent).toBe("RAM +3 · wgrywanie −12,6% · odnowa RAM +15,8%");
  });

  it("shows no deck line for another implant", () => {
    const { inventory, equipment, ammo } = starterKit();
    const booster = addInstance(inventory, equipment, "synapse_booster", "common");
    if (!booster.ok) throw new Error("full");
    mount({ characterTab: "inventory", inventory: booster.inventory, equipment, ammo });
    fireEvent.click(cell("synapse_booster"), { timeStamp: 1000 });
    expect(screen.queryByTestId("deck-stats")).toBeNull();
    expect(screen.queryByTestId("item-level")).toBeNull();
  });
});

describe("the cyberdeck at the clinic", () => {
  it("offers a regular a better tier at the player's level, for the price the simulation charges", () => {
    const reputation = { ...createReputation(), clinic: 30 };
    const store = mount({ shopOpen: true, shopId: "clinic", reputation, level: 6 });
    const offer = () => screen.getByTestId(`implant-${DECK}`);
    expect(offer().querySelector(".shop__slot")?.textContent).toBe("Nervous system · uncommon · Level 6");
    expect(within(offer()).getByTestId("deck-stats").textContent).toMatch(/^RAM \+2 · upload −/);
    const price = priceWithTerms(implantOffer(DECK, "friendly", 6).listPrice, shopTerms(30));
    expect(within(offer()).getByRole("button").textContent).toBe(`Implant · ${price.toLocaleString("en")} €$`);
    fireEvent.click(within(offer()).getByRole("button"));
    expect(spies.buyCyberware).toHaveBeenCalledWith(DECK);
    polish(store);
    expect(offer().querySelector(".shop__slot")?.textContent).toBe("Układ nerwowy · niezwykły · Poziom 6");
  });

  it("says installed for the deck of the offered grade, and offers one of another grade", () => {
    const cyberware = { optics: "hitomi_optics_mk1", nervous: DECK } as const;
    const store = mount({ shopOpen: true, shopId: "clinic", reputation: createReputation(), level: 3, cyberware, implantGrades: { nervous: { rarity: "common", level: 3 } } });
    const button = () => within(screen.getByTestId(`implant-${DECK}`)).getByRole("button");
    expect(button().textContent).toBe("Installed");
    act(() => patchUi(store, { level: 4 }));
    expect(button().textContent).toMatch(/^Implant · /);
  });
});

describe("a cyberdeck from the bag at the clinic", () => {
  const LEGENDARY = { rarity: "legendary", level: 12 } as const;
  const deckIn = (grade: { readonly rarity: TradeItemVm["rarity"] & string; readonly level: number }): TradeItemVm => ({
    key: "i9",
    ref: { uid: "i9" },
    defId: DECK,
    name: "cyberware.kumo_cyberdeck.name",
    category: "cyberware",
    rarity: grade.rarity,
    level: grade.level,
    qty: 1,
    condition: null,
    inUse: false,
  });
  const open = (state: Partial<UiState>, grade: Parameters<typeof deckIn>[0] = LEGENDARY) => {
    mount({ shopOpen: true, shopId: "clinic", reputation: createReputation(), trade: { items: [deckIn(grade)], capacity: 24, freeCells: 10, weaponParts: 0 }, ...state });
    fireEvent.click(screen.getByTestId("shop-tab-implants"));
    return within(screen.getByTestId("shop-bag-implant")).getByRole("button");
  };

  it("asks the fee the simulation charges, with the deck's level", () => {
    const kit = bag();
    const looted = addInstance(kit.inventory, kit.equipment, DECK, LEGENDARY);
    if (!looted.ok) throw new Error("full");
    const fitted = installCyberwareItem({ eddies: 99999 }, createCharacter(), looted.inventory, kit.equipment, looted.item.uid, shopTerms(0));
    if (!fitted.ok) throw new Error(fitted.reason);
    const button = open({ eddies: fitted.fee });
    expect(button.textContent).toBe(`Fit · ${fitted.fee.toLocaleString("en")} €$`);
    expect(button.hasAttribute("disabled")).toBe(false);
    cleanup();
    expect(open({ eddies: fitted.fee - 1 }).hasAttribute("disabled")).toBe(true);
  });

  it("swaps for the installed deck of another grade, and says implanted for the same one", () => {
    const cyberware = { nervous: DECK } as const;
    const swap = open({ cyberware, implantGrades: { nervous: { rarity: "common", level: 1 } } });
    expect(swap.textContent).toMatch(/^Fit · /);
    expect(swap.hasAttribute("disabled")).toBe(false);
    fireEvent.click(swap);
    expect(spies.installCyberwareItem).toHaveBeenCalledWith("i9");
    cleanup();
    const same = open({ cyberware, implantGrades: { nervous: LEGENDARY } });
    expect(same.textContent).toBe("Already implanted");
    expect(same.hasAttribute("disabled")).toBe(true);
    cleanup();
    // A deck saved without a grade counts as common level 1.
    expect(open({ cyberware }, { rarity: "common", level: 1 }).textContent).toBe("Already implanted");
  });
});

describe("a deck offered at the clinic with a full bag", () => {
  const offer = (state: Partial<UiState>) =>
    mount({ shopOpen: true, shopId: "clinic", reputation: createReputation(), level: 1, trade: { items: [], capacity: 24, freeCells: 0, weaponParts: 0 }, ...state });
  const card = () => screen.getByTestId(`implant-${DECK}`);

  it("waits for a free cell rather than lose a graded deck, in English and in Polish", () => {
    const store = offer({ cyberware: { nervous: DECK }, implantGrades: { nervous: { rarity: "legendary", level: 20 } } });
    const button = () => within(card()).getByRole("button");
    expect(button().hasAttribute("disabled")).toBe(true);
    expect(button().textContent).toBe("No room");
    expect(card().textContent).toContain("free a cell first, or your current deck would be lost");
    polish(store);
    expect(button().textContent).toBe("Brak miejsca");
    expect(card().textContent).toContain("najpierw zwolnij pole, bo obecny deck by przepadł");
  });

  it("still sells over a plain implant or a common level-1 deck, with the old warning", () => {
    offer({ cyberware: { nervous: "synapse_booster" } });
    expect(within(card()).getByRole("button").hasAttribute("disabled")).toBe(false);
    expect(card().textContent).toContain("No room: the old implant will be lost");
    cleanup();
    offer({ cyberware: { nervous: DECK }, level: 2 });
    expect(within(card()).getByRole("button").hasAttribute("disabled")).toBe(false);
    expect(card().textContent).toContain("No room: the old implant will be lost");
  });
});
