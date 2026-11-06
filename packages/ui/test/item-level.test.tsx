// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { type InventoryState, addInstance, createReputation, shopTerms, starterKit, stockEntry, stockPrice } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, type UiIntents, type UiState, type UiStore, createUiStore, patchUi } from "../src";

/** The item card and the counter with item levels, tiers and traits (ADR-0059, stage 4), in both languages. */

const intents = (): UiIntents => {
  const spies = new Map<PropertyKey, unknown>();
  return new Proxy({}, { get: (_, key) => spies.get(key) ?? spies.set(key, vi.fn()).get(key) }) as UiIntents;
};

/** Starter kit plus a legendary SMG of level 12 with two traits, an epic jacket and a plain holo sight. */
const bag = () => {
  const { inventory, equipment, ammo } = starterKit();
  let inv: InventoryState = inventory;
  const smg = addInstance(inv, equipment, "hebi_smg", { rarity: "legendary", level: 12, traits: ["hot_loads", "silenced"] });
  if (!smg.ok) throw new Error("full");
  inv = smg.inventory;
  const jacket = addInstance(inv, equipment, "hebi_jacket", { rarity: "epic", level: 3, traits: ["padded"] });
  if (!jacket.ok) throw new Error("full");
  inv = jacket.inventory;
  const sight = addInstance(inv, equipment, "holo_sight", "common");
  if (!sight.ok) throw new Error("full");
  return { inventory: sight.inventory, equipment, ammo };
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

describe("the item card", () => {
  it("shows the tier, the level and the traits, in English and in Polish", () => {
    const store = mount({ characterTab: "inventory" });
    fireEvent.click(cell("hebi_smg"), { timeStamp: 1000 });
    const detail = () => screen.getByTestId("item-detail");
    expect(detail().className).toContain("rarity-text--legendary");
    expect(detail().textContent).toContain("legendary");
    expect(screen.getByTestId("item-level").textContent).toBe("Level 12");
    const traits = screen.getByTestId("item-traits");
    expect(traits.getAttribute("aria-label")).toBe("Traits");
    expect(within(traits).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Hot loads Damage ×1.1.",
      "Built-in suppressor A shot alerts at most 10 m around, with no loss of damage.",
    ]);
    polish(store);
    expect(detail().textContent).toContain("legendarny");
    expect(screen.getByTestId("item-level").textContent).toBe("Poziom 12");
    expect(within(screen.getByTestId("item-traits")).getAllByRole("listitem")[0]!.textContent).toBe("Mocna amunicja Obrażenia ×1,1.");
  });

  it("has no level or traits on a mod", () => {
    mount({ characterTab: "inventory" });
    fireEvent.click(cell("holo_sight"), { timeStamp: 1000 });
    expect(screen.getByTestId("item-detail").textContent).toContain("Holo sight");
    expect(screen.queryByTestId("item-level")).toBeNull();
    expect(screen.queryByTestId("item-traits")).toBeNull();
  });
});

describe("dropping a piece", () => {
  it("asks first for an epic or legendary piece, as for a rare one, and drops a common one at once", () => {
    mount({ characterTab: "inventory" });
    for (const [def, at] of [
      ["hebi_smg", 1000],
      ["hebi_jacket", 3000],
    ] as const) {
      fireEvent.click(cell(def), { timeStamp: at });
      fireEvent.click(screen.getByRole("button", { name: /Drop/ }));
      expect(screen.getByTestId("confirm-drop").textContent).toContain("won't easily find one like it again");
      fireEvent.click(within(screen.getByTestId("confirm-drop")).getByRole("button", { name: "Keep" }));
    }
    expect(spies.dropItem).not.toHaveBeenCalled();
    fireEvent.click(cell("holo_sight"), { timeStamp: 5000 });
    fireEvent.click(screen.getByRole("button", { name: /Drop/ }));
    expect(spies.dropItem).toHaveBeenCalledTimes(1);
  });
});

describe("the counter", () => {
  it("offers a regular a better tier at the player's level, for the price the simulation charges", () => {
    const reputation = { ...createReputation(), civilians: 30 };
    const store = mount({ shopOpen: true, shopId: "oyaji", reputation, level: 10 });
    const offer = () => screen.getByTestId("stock-oni44");
    expect(offer().className).toContain("rarity--uncommon");
    expect(offer().querySelector(".shop__slot")?.textContent).toBe("Weapon · uncommon · Level 10");
    const price = stockPrice(stockEntry("oyaji", "oni44")!, shopTerms(30), 10);
    expect(within(offer()).getByRole("button").textContent).toBe(`Buy · ${price.toLocaleString("en")} €$`);
    // A mod has no level.
    expect(screen.getByTestId("stock-suppressor").querySelector(".shop__slot")?.textContent).toBe("Mod · uncommon");
    polish(store);
    expect(offer().querySelector(".shop__slot")?.textContent).toBe("Broń · niezwykły · Poziom 10");
  });

  it("writes the level of a piece offered for sale", () => {
    const piece = { key: "i9", ref: { uid: "i9" }, defId: "oni44" as const, name: "item.oni44.name", category: "weapon" as const, rarity: "rare" as const, level: 7, qty: 1, condition: null, inUse: false };
    mount({ shopOpen: true, shopId: "oyaji", reputation: createReputation(), trade: { items: [piece], capacity: 24, freeCells: 20, weaponParts: 0 } });
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    expect(screen.getByTestId("shop-sell-line").textContent).toMatch(/^Oni \.44rare · Level 7Sell · [\d,]+ €\$$/);
  });
});
