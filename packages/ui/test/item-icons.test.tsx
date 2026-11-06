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
import { CREDITS, GameUi, type UiIntents, type UiState, type UiStore, type WeaponStripVm, createUiStore, patchUi } from "../src";
import { GAME_ICON_SOURCES } from "../src/icons/game-icon-paths";
import { ICON_PATHS } from "../src/icons/icon-paths";
import { ICON_BACKGROUNDS, RARITY_INK, SELECT_INK } from "../src/icons/rarity-ink";

/** Item icons in the bag, the slots, the pouch, on the counter and in the HUD (ADR-0073, stages 1 and 2). */

const WEAPONS = Object.keys(WEAPON_CATALOG) as WeaponId[];
const AMMO = Object.keys(AMMO_CATALOG) as AmmoId[];
/** Every catalog item that is not a weapon: garments, mods, implants and stacks, with icons since stage 2. */
const OTHERS = [...Object.keys(GARMENT_CATALOG), ...Object.keys(MOD_CATALOG), ...Object.keys(CYBERWARE_CATALOG), ...Object.keys(STACKABLE_CATALOG)] as ItemDefId[];

/**
 * Size budget of the drawings, in characters of path data (ADR-0073): on average per icon, so new
 * icons bring their own share, and for the largest one. Stage 1: 1790 for 12 icons, at most 248.
 * Stage 2 (garments, mods, junk drawn here; implants and consumables after game-icons.net): 6444
 * for 38 icons (169.6 on average), at most 308 (synapse); the budget stays as it was.
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

/** The window's size as the bag's cells see it (`useWideCells`): a desktop from 1100 × 620. */
const viewport = (width: number, height: number) => {
  Object.assign(window, { innerWidth: width, innerHeight: height });
  window.dispatchEvent(new Event("resize"));
};

afterEach(() => {
  cleanup();
  viewport(1024, 768);
});

describe("the icon table", () => {
  it("draws every item and every ammo type of the catalogs, and no drawing goes unused", () => {
    for (const id of [...WEAPONS, ...OTHERS]) expect(ICON_PATHS[itemIcon(id)]?.body.length, id).toBeGreaterThan(0);
    for (const id of AMMO) expect(ICON_PATHS[ammoIcon(id)]?.body.length, id).toBeGreaterThan(0);
    const used = new Set([...[...WEAPONS, ...OTHERS].map(itemIcon), ...AMMO.map(ammoIcon)]);
    expect(Object.keys(ICON_PATHS).filter((key) => !used.has(key as never))).toEqual([]);
  });

  it("names the source of every icon after game-icons.net and credits its author under CC BY 3.0", () => {
    const fromGameIcons = OTHERS.filter((id) => itemIcon(id) in GAME_ICON_SOURCES);
    // The decision of 6.11: implants and consumables, nothing else.
    expect(fromGameIcons.sort()).toEqual([...Object.keys(CYBERWARE_CATALOG), ...Object.keys(STACKABLE_CATALOG).filter((id) => STACKABLE_CATALOG[id as keyof typeof STACKABLE_CATALOG].category === "consumable")].sort());
    for (const { author, name } of Object.values(GAME_ICON_SOURCES)) {
      const credit = CREDITS.find((c) => c.section === "icons" && c.author === author);
      expect(credit?.license, author).toBe("CC-BY-3.0");
      expect(credit!.title.toLowerCase()).toContain(name.split("-").join(" "));
    }
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

  it("keeps every rarity's ink at 3:1 or more on a cell, a selected cell, a counter card and the HUD's strip", () => {
    for (const rarity of RARITIES) for (const [where, bg] of Object.entries(ICON_BACKGROUNDS)) expect(contrast(RARITY_INK[rarity], bg), `${rarity} on ${where}`).toBeGreaterThanOrEqual(3);
  });
});

describe("the bag", () => {
  it("shows every item with its icon in the colour and frame of its rarity, epic and legendary too", () => {
    mount({ characterTab: "inventory" });
    const seen = new Set<Rarity>();
    for (const id of [...WEAPONS, ...OTHERS]) {
      expect(cells(id).length, id).toBeGreaterThan(0);
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
    const all = [...WEAPONS, ...OTHERS];
    all.forEach((id, i) => {
      for (const cell of cells(id)) {
        const rarity = iconOf(cell)!.getAttribute("data-rarity") as Rarity;
        fireEvent.click(cell, { timeStamp: 10_000 * (i + 1) });
        const now = cells(id)[0]!;
        expect(now.getAttribute("aria-pressed"), id).toBe("true");
        expect(now.style.boxShadow, id).toBe(ring);
        expect(now.style.outline, id).toBe("none");
        expect(now.style.borderColor, id).toBe(rarity === "common" ? "" : rgb(RARITY_INK[rarity]));
        // Every other cell is unselected: no ring.
        for (const other of all.filter((w) => w !== id)) for (const c of cells(other)) expect(c.style.boxShadow, other).toBe("");
      }
    });
  });

  it("on a desktop screen writes the short name under the icon", () => {
    viewport(1280, 720);
    mount({ characterTab: "inventory" });
    for (const id of [...WEAPONS, ...OTHERS]) for (const cell of cells(id)) expect(cell.querySelector(".inv__cell-name")?.textContent, id).not.toBe("");
    const legendary = cells("tessen_ar5")[0]!;
    expect(legendary.className).not.toContain("inv__cell--bare");
    expect(legendary.getAttribute("aria-label")).toBe("Tessen AR-5, legendary");
    expect(legendary.textContent).toBe("AR-5legend.");
  });

  it("on a phone shows only the icon, says the name to a screen reader and in the details after a tap", () => {
    viewport(800, 370);
    mount({ characterTab: "inventory" });
    for (const id of [...WEAPONS, ...OTHERS]) {
      for (const cell of cells(id)) {
        expect(cell.className, id).toContain("inv__cell--bare");
        expect(cell.querySelector(".inv__cell-name"), id).toBeNull();
        expect(iconOf(cell), id).not.toBeNull();
        expect(cell.getAttribute("aria-label"), id).not.toBe("");
      }
    }
    // The tier stays written in the corner and the stack count beside it: colour is never alone.
    const legendary = cells("tessen_ar5")[0]!;
    expect(legendary.getAttribute("aria-label")).toBe("Tessen AR-5, legendary");
    expect(legendary.textContent).toBe("legend.");
    expect(cells("medkit")[0]!.getAttribute("aria-label")).toMatch(/^Medkit × \d+$/);
    fireEvent.click(cells("synth_coffee")[0]!, { timeStamp: 50_000 });
    expect(screen.getByTestId("item-detail").querySelector(".inv__detail-name")!.textContent).toBe("Synth coffee");
    // Turned to a desktop-sized window, the names come back.
    act(() => viewport(1280, 720));
    expect(cells("tessen_ar5")[0]!.textContent).toBe("AR-5legend.");
  });

  it("draws the equipped weapons in their slots and the pouch with its rounds", () => {
    mount({ characterTab: "inventory" });
    const secondary = screen.getByTestId("slot-secondary");
    expect(iconOf(secondary)?.getAttribute("data-icon")).toBe("pistol");
    expect(secondary.getAttribute("aria-label")).toBe("Secondary: Unity-9");
    // The garment column beside the preview keeps its names (ADR-0073: icons in the weapon slots).
    expect(iconOf(screen.getByTestId("slot-torso"))).toBeNull();
    const pouch = screen.getByTestId("ammo-pouch");
    expect(within(pouch).getAllByTestId("item-icon").map((i) => i.getAttribute("data-icon"))).toEqual(AMMO.map(ammoIcon));
  });
});

describe("the HUD's weapon strip", () => {
  const strip = (slots: WeaponStripVm["slots"]): WeaponStripVm => ({ slots, active: "secondary", loaded: 7, magazine: 12, reserve: 36, ammoName: "item.9mm.name", reloading: false, holstered: false });

  it("shows each weapon's icon in its rarity's colour beside the key and the name; an empty slot has none", () => {
    mount({
      weapons: strip([
        { slot: "primary", key: 1, name: "item.kagero_dmr.name", rarity: "legendary", icon: "dmr" },
        { slot: "secondary", key: 2, name: "item.unity9.name", rarity: "common", icon: "pistol" },
        { slot: "melee", key: 3, name: null, rarity: null, icon: null },
      ]),
    });
    const slots = screen.getByTestId("weapon-strip").querySelectorAll<HTMLElement>(".weapon-strip__slot");
    expect([...slots].map((s) => iconOf(s)?.getAttribute("data-icon") ?? null)).toEqual(["dmr", "pistol", null]);
    expect(iconOf(slots[0]!)!.style.color).toBe(rgb(RARITY_INK.legendary));
    expect(iconOf(slots[0]!)!.getAttribute("aria-hidden")).toBe("true");
    expect(slots[0]!.className).toContain("weapon-strip__slot--icon");
    expect(slots[0]!.textContent).toBe("1Kagero DMR");
    expect(slots[2]!.className).not.toContain("weapon-strip__slot--icon");
  });

  it("keeps the touch slots' labels and puts the icon in them too", () => {
    const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };
    const store = createUiStore({ screen: "playing", weapons: strip([{ slot: "secondary", key: 2, name: "item.hebi_smg.name", rarity: "epic", icon: "smg" }]) });
    render(<GameUi store={store} intents={intents()} touch={pad} />);
    const button = screen.getByRole("button", { name: /Hebi/ });
    expect(iconOf(button)?.getAttribute("data-icon")).toBe("smg");
    expect(iconOf(button)!.style.color).toBe(rgb(RARITY_INK.epic));
  });
});

describe("the counter", () => {
  it("frames every offer with its icon: weapons, garments, mods, stacks and ammo boxes", () => {
    mount({ shopOpen: true, shopId: "oyaji", reputation: createReputation(), level: 1 });
    for (const entry of SHOPS.oyaji.stock) {
      const offer = screen.getByTestId(`stock-${entry.item}`);
      const icon = iconOf(offer);
      expect(icon?.className, entry.item).toContain("item-icon--framed");
      if (entry.kind === "ammo") expect(icon?.getAttribute("data-icon"), entry.item).toBe(ammoIcon(entry.item));
      else expect(icon?.getAttribute("data-icon"), entry.item).toBe(itemIcon(entry.item));
      if (entry.kind === "item") expect(icon?.getAttribute("data-rarity")).toBe(entry.rarity);
    }
    expect(screen.getByTestId("stock-hebi_smg").className).toContain("rarity--uncommon");
  });

  it("frames the clinic's implants and its stock with their icons", () => {
    mount({ shopOpen: true, shopId: "clinic", reputation: createReputation(), level: 1 });
    const implants = screen.getAllByTestId(/^implant-/);
    expect(implants.length).toBeGreaterThan(0);
    for (const offer of implants) expect(iconOf(offer)?.getAttribute("data-icon")).toBe(itemIcon(offer.getAttribute("data-testid")!.slice("implant-".length) as ItemDefId));
    for (const entry of SHOPS.clinic.stock) expect(iconOf(screen.getByTestId(`stock-${entry.item}`)), entry.item).not.toBeNull();
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
