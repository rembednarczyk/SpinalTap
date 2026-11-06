// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  AMMO_CATALOG,
  type AmmoId,
  CYBERWARE_CATALOG,
  GARMENT_CATALOG,
  type InstanceDefId,
  type InventoryState,
  type ItemDefId,
  MOD_CATALOG,
  RARITIES,
  type Rarity,
  SHOPS,
  STACKABLE_CATALOG,
  WEAPON_CATALOG,
  type WeaponId,
  addInstance,
  ammoIcon,
  createReputation,
  itemIcon,
  starterKit,
} from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, type UiIntents, type UiState, type UiStore, createUiStore, patchUi } from "../src";
import { ICON_PATHS } from "../src/icons/icon-paths";
import { ICON_BACKGROUNDS, RARITY_INK, SELECT_INK } from "../src/icons/rarity-ink";

/** Item icons in the bag, the slots, the pouch and on the counter (ADR-0073, stage 1). */

const WEAPONS = Object.keys(WEAPON_CATALOG) as WeaponId[];
const AMMO = Object.keys(AMMO_CATALOG) as AmmoId[];
/** Every catalog item that is not a weapon: still drawn as text in stage 1. */
const OTHERS = [...Object.keys(GARMENT_CATALOG), ...Object.keys(MOD_CATALOG), ...Object.keys(CYBERWARE_CATALOG), ...Object.keys(STACKABLE_CATALOG)] as ItemDefId[];

/**
 * Size budget of the drawings, in characters of path data (ADR-0073): on average per icon, so new
 * icons bring their own share, and for the largest one. Stage 1: 1790 for 12 icons, at most 248.
 */
const BUDGET_AVERAGE = 200;
const BUDGET_ICON = 320;

const intents = (): UiIntents => {
  const spies = new Map<PropertyKey, unknown>();
  return new Proxy({}, { get: (_, key) => spies.get(key) ?? spies.set(key, vi.fn()).get(key) }) as UiIntents;
};

/** The starter kit plus one piece of every instance kind (weapons in turn through the rarities) and one stack of each. */
const fullBag = () => {
  const { inventory, equipment, ammo } = starterKit();
  let inv: InventoryState = { ...inventory, capacity: 80 };
  const add = (def: InstanceDefId, rarity: Rarity) => {
    const r = addInstance(inv, equipment, def, rarity);
    if (!r.ok) throw new Error(`no room for ${def}`);
    inv = r.inventory;
  };
  WEAPONS.forEach((id, i) => add(id, RARITIES[i % RARITIES.length]!));
  for (const id of [...Object.keys(GARMENT_CATALOG), ...Object.keys(MOD_CATALOG), ...Object.keys(CYBERWARE_CATALOG)] as InstanceDefId[]) add(id, "common");
  const stacks = Object.fromEntries(Object.keys(STACKABLE_CATALOG).map((id) => [id, 1]));
  return { inventory: { ...inv, stacks }, equipment, ammo: { ...ammo, "44": 6, "12g": 4, "556": 20 } };
};

const mount = (state: Partial<UiState>): UiStore => {
  const store = createUiStore({ screen: "playing", ...fullBag(), eddies: 99999, ...state });
  render(<GameUi store={store} intents={intents()} />);
  return store;
};

const cells = (def: string) => screen.getAllByTestId("item-cell").filter((c) => c.getAttribute("data-def") === def);
const iconOf = (el: HTMLElement) => el.querySelector<HTMLElement>("[data-testid=item-icon]");

/** "#rrggbb" as jsdom writes a colour back: "rgb(r, g, b)". */
const rgb = (hex: string): string => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;

/** WCAG relative luminance and contrast of two #rrggbb colours. */
const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

afterEach(cleanup);

describe("the icon table", () => {
  it("draws every weapon and every ammo type of the catalogs", () => {
    for (const id of WEAPONS) expect(ICON_PATHS[itemIcon(id)!]?.body.length, id).toBeGreaterThan(0);
    for (const id of AMMO) expect(ICON_PATHS[ammoIcon(id)]?.body.length, id).toBeGreaterThan(0);
  });

  it("gives every other item the explicit stand-in: no icon, its text", () => {
    for (const id of OTHERS) expect(itemIcon(id), id).toBeNull();
  });

  it("stays within its size budget", () => {
    const sizes = Object.entries(ICON_PATHS).map(([key, d]) => [key, [...d.body, ...(d.line ?? [])].join("").length] as const);
    const total = sizes.reduce((s, [, n]) => s + n, 0);
    expect(total / sizes.length).toBeLessThanOrEqual(BUDGET_AVERAGE);
    for (const [key, n] of sizes) expect(n, key).toBeLessThanOrEqual(BUDGET_ICON);
  });

  it("rings a selection in a colour far from every rarity's frame, readable on the selected cell", () => {
    const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const distance = (a: string, b: string) => Math.hypot(...channels(a).map((c, i) => c - channels(b)[i]!));
    // Common has no coloured frame (the panel's edge), so only the coloured tiers count.
    for (const rarity of RARITIES.filter((r) => r !== "common")) expect(distance(SELECT_INK, RARITY_INK[rarity]), rarity).toBeGreaterThanOrEqual(100);
    expect(contrast(SELECT_INK, ICON_BACKGROUNDS.selected)).toBeGreaterThanOrEqual(3);
  });

  it("keeps every rarity's ink at 3:1 or more on a cell, a selected cell and a counter card", () => {
    for (const rarity of RARITIES) for (const [where, bg] of Object.entries(ICON_BACKGROUNDS)) expect(contrast(RARITY_INK[rarity], bg), `${rarity} on ${where}`).toBeGreaterThanOrEqual(3);
  });
});

describe("the bag", () => {
  it("shows each weapon with its icon in the colour and frame of its rarity, epic and legendary too", () => {
    mount({ characterTab: "inventory" });
    const seen = new Set<Rarity>();
    for (const id of WEAPONS) {
      for (const cell of cells(id)) {
        const icon = iconOf(cell)!;
        expect(icon, id).not.toBeNull();
        const rarity = icon.getAttribute("data-rarity") as Rarity;
        seen.add(rarity);
        expect(icon.getAttribute("data-icon")).toBe(itemIcon(id));
        expect(icon.getAttribute("aria-hidden")).toBe("true");
        expect(icon.style.color).not.toBe("");
        expect(cell.className).toContain("inv__cell--icon");
        if (rarity !== "common") {
          expect(cell.className).toContain(`rarity--${rarity}`);
          // The frame's colour comes inline: `.inv__cell` comes after `.rarity--*` in styles.css and wins.
          expect(cell.style.borderColor, id).toBe(rgb(RARITY_INK[rarity]));
        } else expect(cell.style.borderColor).toBe("");
      }
    }
    expect([...seen]).toEqual(expect.arrayContaining(["common", "uncommon", "rare", "epic", "legendary"]));
  });

  it("selects a cell with a ring inside its rarity frame, so the frame keeps its colour", () => {
    mount({ characterTab: "inventory" });
    const ring = `inset 0 0 0 2px ${SELECT_INK}`;
    WEAPONS.forEach((id, i) => {
      for (const cell of cells(id)) {
        const rarity = iconOf(cell)!.getAttribute("data-rarity") as Rarity;
        fireEvent.click(cell, { timeStamp: 10_000 * (i + 1) });
        const now = cells(id)[0]!;
        expect(now.getAttribute("aria-pressed"), id).toBe("true");
        expect(now.style.boxShadow, id).toBe(ring);
        expect(now.style.outline, id).toBe("none");
        expect(now.style.borderColor, id).toBe(rarity === "common" ? "" : rgb(RARITY_INK[rarity]));
        // Every other icon cell is unselected: no ring.
        for (const other of WEAPONS.filter((w) => w !== id)) for (const c of cells(other)) expect(c.style.boxShadow, other).toBe("");
      }
    });
  });

  it("selects a text cell with the same white ring, never the magenta of a rare frame", () => {
    mount({ characterTab: "inventory" });
    const ring = `inset 0 0 0 2px ${SELECT_INK}`;
    OTHERS.forEach((id, i) => {
      for (const cell of cells(id)) {
        fireEvent.click(cell, { timeStamp: 10_000 * (i + 1) });
        const now = cells(id)[0]!;
        expect(now.getAttribute("aria-pressed"), id).toBe("true");
        expect(now.style.boxShadow, id).toBe(ring);
        expect(now.style.outline, id).toBe("none");
      }
    });
  });

  it("keeps the text cell for the kinds without icons, and the same label everywhere", () => {
    mount({ characterTab: "inventory" });
    for (const id of OTHERS) {
      for (const cell of cells(id)) {
        expect(iconOf(cell), id).toBeNull();
        expect(cell.className).not.toContain("inv__cell--icon");
        expect(cell.textContent).not.toBe("");
      }
    }
    const legendary = cells("tessen_ar5")[0]!;
    expect(legendary.getAttribute("aria-label")).toBe("Tessen AR-5, legendary");
    expect(legendary.textContent).toBe("AR-5legend.");
  });

  it("draws the equipped weapons in their slots and the pouch with its rounds", () => {
    mount({ characterTab: "inventory" });
    const secondary = screen.getByTestId("slot-secondary");
    expect(iconOf(secondary)?.getAttribute("data-icon")).toBe("pistol");
    expect(secondary.getAttribute("aria-label")).toBe("Secondary: Unity-9");
    expect(iconOf(screen.getByTestId("slot-torso"))).toBeNull();
    const pouch = screen.getByTestId("ammo-pouch");
    expect(within(pouch).getAllByTestId("item-icon").map((i) => i.getAttribute("data-icon"))).toEqual(AMMO.map(ammoIcon));
  });
});

describe("the counter", () => {
  it("frames every weapon and ammo box on offer and leaves the rest as text", () => {
    mount({ shopOpen: true, shopId: "oyaji", reputation: createReputation(), level: 1 });
    for (const entry of SHOPS.oyaji.stock) {
      const offer = screen.getByTestId(`stock-${entry.item}`);
      const icon = iconOf(offer);
      if (entry.kind === "ammo") expect(icon?.getAttribute("data-icon"), entry.item).toBe(ammoIcon(entry.item));
      else if (entry.kind === "item" && itemIcon(entry.item)) {
        expect(icon?.getAttribute("data-icon"), entry.item).toBe(itemIcon(entry.item));
        expect(icon?.getAttribute("data-rarity")).toBe(entry.rarity);
        expect(icon?.className).toContain("item-icon--framed");
      } else expect(icon, entry.item).toBeNull();
    }
    expect(screen.getByTestId("stock-hebi_smg").className).toContain("rarity--uncommon");
  });

  it("shows epic and legendary pieces for sale with their icons", () => {
    const piece = (key: string, defId: WeaponId, rarity: Rarity) => ({ key, ref: { uid: key }, defId, name: `item.${defId}.name`, category: "weapon" as const, rarity, level: 12, qty: 1, condition: null, inUse: false });
    const store = mount({
      shopOpen: true,
      shopId: "oyaji",
      reputation: createReputation(),
      trade: { items: [piece("i8", "raijin12", "epic"), piece("i9", "kagero_dmr", "legendary")], capacity: 24, freeCells: 20, weaponParts: 0 },
    });
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    const lines = screen.getAllByTestId("shop-sell-line");
    expect(lines.map((l) => [iconOf(l)?.getAttribute("data-icon"), iconOf(l)?.getAttribute("data-rarity")])).toEqual([
      ["shotgun", "epic"],
      ["dmr", "legendary"],
    ]);
    expect(lines[1]!.className).toContain("rarity--legendary");
    act(() => patchUi(store, { settings: { ...store.getState().settings, locale: "pl" } }));
    expect(screen.getAllByTestId("shop-sell-line")[1]!.textContent).toMatch(/^Kagero DMRlegendarny · Poziom 12/);
  });
});
