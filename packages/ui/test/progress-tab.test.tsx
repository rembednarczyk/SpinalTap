// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  type InventoryState,
  MAX_LEVEL,
  START_ATTRIBUTES,
  STANDARD_TERMS,
  createReputation,
  equip,
  addInstance,
  respecPrice,
  starterKit,
  xpForLevel,
} from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, GameUi, type UiIntents, type UiState, createUiStore, patchUi } from "../src";
import { xpProgress } from "../src/progress/xp";
import { firstTree } from "../src/progress/use-progress-tree";

/* ADR-0059, stage 7: the Progress tab, the XP bar on the HUD, the points' badges and the item card's comparison. */

const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const pad = () => ({ setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() });

const mount = (state: Partial<UiState> = {}, touch = false) => {
  const store = createUiStore({ screen: "playing", hp: 100, maxHp: 100, ...state });
  const i = intents();
  render(<GameUi store={store} intents={i} touch={touch ? pad() : undefined} />);
  return { store, i };
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the XP numbers", () => {
  it("measure the way from the level's start to the next one with the core curve; the top level is full", () => {
    expect(xpProgress(1, 0)).toEqual({ into: 0, span: 100, share: 0, top: false });
    // Level 2 starts at 100 XP and takes round(100 × 2^1.6) = 303 more.
    expect(xpProgress(2, 150)).toEqual({ into: 50, span: 303, share: 50 / 303, top: false });
    expect(xpProgress(MAX_LEVEL, xpForLevel(MAX_LEVEL) + 500)).toEqual({ into: 0, span: 0, share: 1, top: true });
  });

  it("the tab opens on the tree where a point buys a rank, else the one with most ranks, else Might", () => {
    expect(firstTree(START_ATTRIBUTES, {}, 1)).toBe("might");
    expect(firstTree({ ...START_ATTRIBUTES, tech: 4 }, {}, 1)).toBe("tech");
    expect(firstTree({ ...START_ATTRIBUTES, tech: 4 }, {}, 0)).toBe("might");
    expect(firstTree({ ...START_ATTRIBUTES, net: 4 }, { net_buffer: 2 }, 0)).toBe("net");
  });
});

describe("the Progress tab", () => {
  it("opens on K and from its tab; shows the level, the XP bar and the points on the tab", () => {
    const { store, i } = mount({ level: 2, xp: 150, attributePoints: 1, perkPoints: 1 });
    fireEvent.keyDown(window, { code: "KeyK" });
    expect(i.openCharacterScreen).toHaveBeenLastCalledWith("progress");
    expect(screen.getByTestId("progress-tab")).toBeTruthy();
    expect(screen.getByTestId("progress-level").textContent).toBe("Level 2");
    expect(screen.getByTestId("progress-xp").textContent).toBe("50 / 303 XP");
    expect(within(screen.getByTestId("progress-xp")).getByRole("meter").getAttribute("aria-valuenow")).toBe("50");
    expect(screen.getByTestId("progress-tab-points").textContent).toBe("2");
    fireEvent.keyDown(window, { code: "KeyK" });
    expect(screen.queryByTestId("character-screen")).toBeNull();
    act(() => store.getState().showCharacterTab("inventory"));
    fireEvent.click(screen.getByRole("tab", { name: /Progress/ }));
    expect(store.getState().characterTab).toBe("progress");
  });

  it("raises an attribute and buys a perk through the intents; the tiers say what opens them", () => {
    const { i } = mount({ level: 5, attributePoints: 2, perkPoints: 2, attributes: { ...START_ATTRIBUTES, might: 4 } });
    fireEvent.keyDown(window, { code: "KeyK" });
    fireEvent.click(screen.getByRole("button", { name: "Raise Reflex" }));
    expect(i.spendAttributePoint).toHaveBeenCalledWith("reflex");
    // Might 4 opens tier 4: the tab opened on Might's tree.
    fireEvent.click(screen.getByRole("button", { name: "Buy Thick Skin" }));
    expect(i.spendPerkPoint).toHaveBeenCalledWith("might_tough");
    expect(screen.getByTestId("tier-might-4").textContent).not.toContain("Opens at");
    expect(screen.getByTestId("tier-might-8").textContent).toContain("Opens at Might 8");
    // Every perk of the tree is there, with its description.
    expect(within(screen.getByTestId("perks")).getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByTestId("perk-might_crushing_parry").textContent).toContain("Key perk");
  });

  it("each of the five trees shows on its attribute, with its ranks counted on the attribute", () => {
    mount({ perks: { net_buffer: 2 }, attributes: { ...START_ATTRIBUTES, net: 4 } });
    fireEvent.keyDown(window, { code: "KeyK" });
    for (const tree of ["might", "reflex", "tech", "net", "shadow"] as const) {
      fireEvent.click(screen.getByTestId(`attribute-tree-${tree}`));
      expect(screen.getByTestId("attribute-tree-" + tree).getAttribute("aria-pressed")).toBe("true");
      expect(screen.getAllByTestId(/^perk-/).every((el) => el.dataset.testid!.startsWith(`perk-${tree}_`))).toBe(true);
    }
    expect(screen.getByTestId("attribute-net").textContent).toContain("Ranks bought: 2");
  });

  it("says where the respec is and for how much; on basic terms and with nothing spent it says why not", () => {
    mount({ level: 6, attributes: { ...START_ATTRIBUTES, tech: 5 } });
    fireEvent.keyDown(window, { code: "KeyK" });
    expect(screen.getByTestId("progress-respec").textContent).toContain(`Rewire at Mori's clinic: ${respecPrice(6, STANDARD_TERMS).toLocaleString("en")} €$`);
    cleanup();
    mount({ level: 6, attributes: { ...START_ATTRIBUTES, tech: 5 }, reputation: { ...createReputation(), clinic: -80 } });
    fireEvent.keyDown(window, { code: "KeyK" });
    expect(screen.getByTestId("progress-respec").textContent).toContain("only clients she trusts");
    cleanup();
    mount({ level: 6 });
    fireEvent.keyDown(window, { code: "KeyK" });
    expect(screen.getByTestId("progress-respec").textContent).toContain("Nothing to reset yet");
  });

  it("speaks Polish with the Polish setting", () => {
    mount({ level: 3, xp: 400, perkPoints: 1, settings: { ...DEFAULT_SETTINGS, locale: "pl" } });
    fireEvent.keyDown(window, { code: "KeyK" });
    expect(screen.getByRole("tab", { name: /Rozwój/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("progress-level").textContent).toBe("Poziom 3");
    expect(screen.getByTestId("tier-might-8").textContent).toContain("Otwiera się przy: Krzepa 8");
    expect(screen.getByTestId("progress-xp").textContent).toMatch(/PD$/);
  });
});

describe("the sheet after the move", () => {
  it("keeps the level and the XP bar, sends the points to the Progress tab and marks implants that are off", () => {
    const { store } = mount({ level: 4, xp: 700, attributePoints: 1, cyberware: { skeleton: "subdermal_weave" }, capacity: { used: 14, max: 12, inactive: ["subdermal_weave"] } });
    fireEvent.keyDown(window, { code: "Tab" });
    expect(screen.queryByTestId("attributes")).toBeNull();
    expect(screen.queryByTestId("perks")).toBeNull();
    expect(screen.getByTestId("sheet-level").textContent).toContain("Level 4 · Points to spend: 1");
    expect(screen.getByTestId("sheet-implant-skeleton").textContent).toContain("off: over the pool");
    expect(screen.getByTestId("sheet-implant-optics").textContent).not.toContain("off");
    fireEvent.click(screen.getByRole("button", { name: "Spend in Progress" }));
    expect(store.getState().characterTab).toBe("progress");
  });
});

describe("the XP bar on the HUD", () => {
  it("sits under the health bar with the level and the points to spend with the tab's key", () => {
    mount({ level: 3, xp: 500, attributePoints: 1, perkPoints: 2 });
    const identity = screen.getByTestId("identity");
    expect(within(identity).getByTestId("hud-level").textContent).toBe("Lv 3");
    expect(within(identity).getByTestId("hud-xp")).toBeTruthy();
    expect(within(identity).getByTestId("hud-points").textContent).toBe("▲ 3 K");
    expect(within(identity).getByTestId("hud-points").getAttribute("aria-label")).toBe("Points to spend: 3");
  });

  it("shows the calm block a moment after XP comes in, and flashes the bar on a level up", () => {
    vi.useFakeTimers();
    const { store } = mount({ level: 1, xp: 0 });
    const identity = () => screen.getByTestId("identity");
    expect(identity().classList.contains("hud__identity--calm")).toBe(true);
    act(() => patchUi(store, { xp: 40 }));
    expect(identity().classList.contains("hud__identity--calm")).toBe(false);
    expect(screen.getByTestId("hud-progress").classList.contains("hud__progress--up")).toBe(false);
    act(() => patchUi(store, { xp: 120, level: 2 }));
    expect(screen.getByTestId("hud-progress").classList.contains("hud__progress--up")).toBe(true);
    act(() => vi.advanceTimersByTime(4100));
    expect(identity().classList.contains("hud__identity--calm")).toBe(true);
    expect(screen.getByTestId("hud-progress").classList.contains("hud__progress--up")).toBe(false);
  });

  it("on touch the menu button wears the points instead; none without points", () => {
    mount({ attributePoints: 1, perkPoints: 1 }, true);
    expect(within(screen.getByTestId("touch-character")).getByTestId("touch-character-points").textContent).toBe("2");
    cleanup();
    mount({}, true);
    expect(screen.queryByTestId("touch-character-points")).toBeNull();
    expect(screen.queryByTestId("hud-points")).toBeNull();
  });
});

describe("the item card against the equipped piece", () => {
  /** An epic SMG of level 5 with a trait in the primary slot and a rare one of level 9 in the bag. */
  const bag = () => {
    const { inventory, equipment, ammo } = starterKit();
    const worn = addInstance(inventory, equipment, "hebi_smg", { rarity: "epic", level: 5, traits: ["hot_loads"] });
    if (!worn.ok) throw new Error("full");
    const on = equip(worn.inventory, equipment, worn.item.uid);
    if (!on.ok) throw new Error("equip");
    const spare = addInstance(worn.inventory, on.equipment, "hebi_smg", { rarity: "rare", level: 9 });
    if (!spare.ok) throw new Error("full");
    return { inventory: spare.inventory as InventoryState, equipment: on.equipment, ammo };
  };

  it("names the equipped piece with its level and lists its traits", () => {
    const state = bag();
    mount(state);
    fireEvent.keyDown(window, { code: "KeyI" });
    // The equipped one sits in its slot, so the only SMG in the grid is the spare.
    const cells = screen.getAllByTestId("item-cell").filter((c) => c.getAttribute("data-def") === "hebi_smg");
    expect(cells).toHaveLength(1);
    const cell = cells[0]!;
    fireEvent.click(cell, { timeStamp: 1000 });
    expect(screen.getByTestId("item-level").textContent).toBe("Level 9");
    expect(screen.getByTestId("compare-against").textContent).toBe("Hebi SMG · Level 5");
    expect(screen.getByTestId("against-traits").textContent).toBe("Equipped piece's traits: Hot loads");
  });
});
