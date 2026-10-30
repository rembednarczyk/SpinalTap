// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { type InventoryState, addInstance, addStack, installMod, starterKit } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type CharacterStatsVm, GameUi, type UiIntents, type UiState, createUiStore, patchUi } from "../src";

/** Every intent is a spy. */
const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const STATS: CharacterStatsVm = { hp: 86, maxHp: 100, armor: { head: 2, torso: 3, arm: 3, leg: 3 }, critChance: 0.08, critMultiplier: 1.8, spread: 1.1, moveSpeed: 4.2 };

/** Starter kit (Unity-9, jacket, cargo, a medkit) plus loot: uncommon SMG i4, rare revolver i5, holo sight i6, scrap. */
const bag = () => {
  const { inventory, equipment, ammo } = starterKit();
  let inv: InventoryState = inventory;
  for (const [def, rarity] of [
    ["hebi_smg", "uncommon"],
    ["oni44", "rare"],
    ["holo_sight", "common"],
  ] as const) {
    const r = addInstance(inv, equipment, def, rarity);
    if (!r.ok) throw new Error("full");
    inv = r.inventory;
  }
  inv = addStack(inv, equipment, "scrap", 3).inventory;
  return { inventory: inv, equipment, ammo };
};

const mount = (state: Partial<UiState> = {}, touch = false) => {
  const store = createUiStore({ screen: "playing", ...bag(), characterStats: STATS, eddies: 1240, ...state });
  const i = intents();
  const pad = { setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() };
  const view = render(<GameUi store={store} intents={i} touch={touch ? pad : undefined} />);
  return { store, i, view };
};

const cell = (def: string) => screen.getAllByTestId("item-cell").find((c) => c.getAttribute("data-def") === def)!;

afterEach(cleanup);

describe("character screen", () => {
  it("opens on its tab with I, Tab and J, tells the app, and closes on the same key or Esc", () => {
    const { store, i } = mount();
    expect(screen.queryByTestId("character-screen")).toBeNull();
    fireEvent.keyDown(window, { code: "KeyI" });
    expect(screen.getByTestId("inventory-tab")).toBeTruthy();
    expect(i.openCharacterScreen).toHaveBeenLastCalledWith("inventory");
    // The HUD under the menu is gone.
    expect(screen.queryByTestId("hud")).toBeNull();
    fireEvent.keyDown(window, { code: "Tab" });
    expect(screen.getByTestId("character-panel")).toBeTruthy();
    expect(i.openCharacterScreen).toHaveBeenLastCalledWith("sheet");
    fireEvent.keyDown(window, { code: "KeyJ" });
    expect(screen.getByTestId("journal")).toBeTruthy();
    expect(store.getState()).toMatchObject({ characterTab: "journal", journalOpen: true, sheetOpen: false });
    fireEvent.keyDown(window, { code: "KeyJ" });
    expect(screen.queryByTestId("character-screen")).toBeNull();
    expect(i.closeCharacterScreen).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { code: "KeyI" });
    fireEvent.keyDown(window, { code: "Escape" });
    expect(screen.queryByTestId("character-screen")).toBeNull();
    expect(i.closeCharacterScreen).toHaveBeenCalledTimes(2);
  });

  it("stays shut during a dialogue, at the clinic and over a bag", () => {
    mount({ shopOpen: true });
    fireEvent.keyDown(window, { code: "KeyI" });
    expect(screen.queryByTestId("character-screen")).toBeNull();
  });

  it("switches tabs by tapping them, and closes with the cross", () => {
    const { i } = mount({ characterTab: "inventory" });
    fireEvent.click(screen.getByRole("tab", { name: /Journal/ }));
    expect(screen.getByTestId("journal")).toBeTruthy();
    // Tapping the open tab does not close the screen.
    fireEvent.click(screen.getByRole("tab", { name: /Journal/ }));
    expect(screen.getByTestId("journal")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close the character menu" }));
    expect(screen.queryByTestId("character-screen")).toBeNull();
    expect(i.closeCharacterScreen).toHaveBeenCalled();
  });

  it("shows money and the rounds in the pouch in the top bar", () => {
    mount({ characterTab: "inventory", ammo: { "9mm": 72, "12g": 6 } });
    expect(screen.getByTestId("menu-eddies").textContent).toBe("€$ 1,240");
    const pouch = screen.getByTestId("ammo-pouch").textContent;
    expect(pouch).toContain("9 mm 72");
    expect(pouch).toContain("Śrut 12 6");
    expect(pouch).not.toContain(".44");
  });

  it("replaces the touch sheet and journal buttons with one Postać button", () => {
    mount({}, true);
    expect(screen.queryByRole("button", { name: "Dziennik" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Postać" }));
    expect(screen.getByTestId("inventory-tab")).toBeTruthy();
    expect(screen.queryByTestId("touch-controls")).toBeNull();
  });
});

describe("inventory tab", () => {
  it("fills a 6 × 4 grid: bag pieces, stacks, empty cells, and counts the cells", () => {
    mount({ characterTab: "inventory" });
    const grid = screen.getByTestId("item-grid");
    expect(within(grid).getAllByTestId("item-cell")).toHaveLength(5);
    expect(grid.querySelectorAll(".inv__cell--empty")).toHaveLength(19);
    expect(screen.getByTestId("inventory-count").textContent).toBe("5 / 24");
    // Worn pieces sit in their slots, not in the grid.
    expect(screen.getByTestId("slot-secondary").textContent).toContain("Unity-9");
    expect(screen.getByTestId("slot-torso").textContent).toContain("Kurtka Seki");
    expect(screen.getByTestId("slot-primary").textContent).toContain("empty");
    expect(screen.getByTestId("stats-panel").textContent).toContain("86/100");
  });

  it("filters by category and sorts on demand", () => {
    mount({ characterTab: "inventory" });
    fireEvent.click(screen.getByRole("tab", { name: "Weapons" }));
    expect(screen.getAllByTestId("item-cell").map((c) => c.getAttribute("data-def"))).toEqual(["hebi_smg", "oni44"]);
    fireEvent.click(screen.getByRole("tab", { name: "Other" }));
    expect(screen.getAllByTestId("item-cell").map((c) => c.getAttribute("data-def"))).toEqual(["holo_sight", "scrap"]);
    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    fireEvent.click(screen.getByRole("button", { name: /Sort: category/ }));
    expect(screen.getAllByTestId("item-cell")[0]!.getAttribute("data-def")).toBe("oni44");
    fireEvent.click(screen.getByRole("button", { name: /Sort: rarity/ }));
    expect(screen.getAllByTestId("item-cell").map((c) => c.getAttribute("data-def"))[0]).toBe("medkit");
  });

  it("selects on a tap and compares with the slot: the revolver beats the pistol on damage", () => {
    mount({ characterTab: "inventory" });
    fireEvent.click(cell("oni44"), { timeStamp: 1000 });
    const detail = screen.getByTestId("item-detail");
    expect(detail.textContent).toContain("Oni .44");
    expect(detail.textContent).toContain("rare");
    expect(screen.getByTestId("delta-damage").textContent).toBe("▲ +33.7");
    expect(screen.getByTestId("delta-reload").textContent).toContain("▼");
    expect(screen.getByTestId("item-compare").textContent).toContain("Unity-9");
    const smg = cell("hebi_smg");
    fireEvent.click(smg, { timeStamp: 3000 });
    expect(smg.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("item-detail").textContent).toContain("(primary slot empty)");
  });

  it("does the default action on a double tap, a right click or Enter, and E or X from the keyboard", () => {
    const { i } = mount({ characterTab: "inventory" });
    const smg = cell("hebi_smg");
    fireEvent.click(smg, { timeStamp: 1000 });
    fireEvent.click(smg, { timeStamp: 1200 });
    expect(i.equip).toHaveBeenCalledWith("i4");
    // A slow second tap only selects again.
    const clock = vi.spyOn(performance, "now").mockReturnValue(5000);
    fireEvent.click(cell("medkit"));
    clock.mockReturnValue(6000);
    fireEvent.click(cell("medkit"));
    clock.mockRestore();
    expect(i.useItem).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByTestId("item-grid"), { key: "Enter" });
    expect(i.useItem).toHaveBeenCalledWith({ stack: "medkit" });
    fireEvent.pointerDown(cell("oni44"), { pointerType: "mouse" });
    fireEvent.contextMenu(cell("oni44"));
    expect(i.equip).toHaveBeenCalledWith("i5");
    fireEvent.keyDown(screen.getByTestId("item-grid"), { key: "ArrowLeft" });
    fireEvent.keyDown(window, { code: "KeyE" });
    expect(i.equip).toHaveBeenCalledTimes(3);
    fireEvent.click(cell("scrap"), { timeStamp: 9000 });
    fireEvent.keyDown(window, { code: "KeyX" });
    expect(screen.getByTestId("quantity-picker")).toBeTruthy();
  });

  it("opens the details on a held finger without acting, and ignores the touch context menu", () => {
    vi.useFakeTimers();
    try {
      const { i } = mount({ characterTab: "inventory" });
      const smg = cell("hebi_smg");
      fireEvent.pointerDown(smg, { pointerType: "touch" });
      act(() => vi.advanceTimersByTime(450));
      fireEvent.contextMenu(smg);
      fireEvent.pointerUp(smg, { pointerType: "touch" });
      fireEvent.click(smg);
      expect(screen.getByTestId("item-detail").textContent).toContain("Hebi SMG");
      expect(screen.getByTestId("inventory-tab").className).toContain("inv--detail");
      expect(i.equip).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("acts from the buttons: equip, take off a worn piece, use, drop a stack by amount", () => {
    const { i } = mount({ characterTab: "inventory" });
    fireEvent.click(cell("hebi_smg"), { timeStamp: 1 });
    fireEvent.click(screen.getByRole("button", { name: /Equip/ }));
    expect(i.equip).toHaveBeenCalledWith("i4");
    fireEvent.click(screen.getByTestId("slot-torso"));
    expect(screen.getByTestId("item-detail").textContent).toContain("Equipped");
    fireEvent.click(screen.getByRole("button", { name: "Unequip" }));
    expect(i.unequip).toHaveBeenCalledWith("torso");
    fireEvent.click(cell("medkit"), { timeStamp: 5000 });
    fireEvent.click(screen.getByRole("button", { name: /Use/ }));
    expect(i.useItem).toHaveBeenCalledWith({ stack: "medkit" });
    fireEvent.click(cell("scrap"), { timeStamp: 9000 });
    fireEvent.click(screen.getByRole("button", { name: /Drop/ }));
    fireEvent.change(screen.getByRole("slider", { name: "Quantity" }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Drop × 2" }));
    expect(i.dropItem).toHaveBeenCalledWith({ stack: "scrap" }, 2);
  });

  it("asks before dropping a rare piece, and drops a common one at once", () => {
    const { i } = mount({ characterTab: "inventory" });
    fireEvent.click(cell("oni44"), { timeStamp: 1 });
    fireEvent.click(screen.getByRole("button", { name: /Drop/ }));
    const ask = screen.getByTestId("confirm-drop");
    expect(ask.textContent).toContain("Oni .44");
    fireEvent.click(within(ask).getByRole("button", { name: "Keep" }));
    expect(i.dropItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Drop/ }));
    fireEvent.click(within(screen.getByTestId("confirm-drop")).getByRole("button", { name: "Drop" }));
    expect(i.dropItem).toHaveBeenCalledWith({ uid: "i5" }, 1);
    fireEvent.click(cell("holo_sight"), { timeStamp: 5000 });
    fireEvent.click(screen.getByRole("button", { name: /Drop/ }));
    expect(i.dropItem).toHaveBeenLastCalledWith({ uid: "i6" }, 1);
  });

  it("blocks what the rules refuse: taking off with a full bag, using at full health, dropping a modded gun", () => {
    const full = bag();
    let inv = full.inventory;
    while (true) {
      const r = addInstance(inv, full.equipment, "baton", "common");
      if (!r.ok) break;
      inv = r.inventory;
    }
    mount({ characterTab: "inventory", inventory: inv, characterStats: { ...STATS, hp: 100 } });
    expect(screen.getByTestId("inventory-count").textContent).toBe("24 / 24");
    fireEvent.click(screen.getByTestId("slot-legs"));
    expect((screen.getByRole("button", { name: "Unequip" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("item-actions").textContent).toContain("No room in the bag");
    fireEvent.click(cell("medkit"), { timeStamp: 1 });
    expect((screen.getByRole("button", { name: /Use/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("item-actions").textContent).toContain("Health is full");
    cleanup();
    const modded = installMod(bag().inventory, bag().equipment, "i4", "i6");
    if (!modded.ok) throw new Error("mod");
    mount({ characterTab: "inventory", inventory: modded.inventory });
    fireEvent.click(cell("hebi_smg"), { timeStamp: 1 });
    expect((screen.getByRole("button", { name: /Drop/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("item-detail").textContent).toContain("Celownik holo");
  });

  it("mounts and takes off mods in the overlay", () => {
    const { i, store } = mount({ characterTab: "inventory" });
    fireEvent.click(cell("hebi_smg"), { timeStamp: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Mods" }));
    const overlay = screen.getByTestId("mod-overlay");
    expect(within(screen.getByTestId("mod-slot-muzzle")).getByText("No matching mods in the bag")).toBeTruthy();
    fireEvent.click(within(overlay).getByRole("button", { name: "Mount: Celownik holo" }));
    expect(i.installMod).toHaveBeenCalledWith("i4", "i6");
    const s = store.getState();
    const r = installMod(s.inventory, s.equipment, "i4", "i6");
    if (!r.ok) throw new Error("mod");
    act(() => patchUi(store, { inventory: r.inventory }));
    fireEvent.click(within(screen.getByTestId("mod-slot-sight")).getByRole("button", { name: "Unequip" }));
    expect(i.removeMod).toHaveBeenCalledWith("i4", "sight");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByTestId("mod-overlay")).toBeNull();
  });

  it("drops the selection when the piece is gone, e.g. the last medkit used", () => {
    const { store } = mount({ characterTab: "inventory" });
    fireEvent.click(cell("medkit"), { timeStamp: 1 });
    expect(screen.getByTestId("item-detail").textContent).toContain("Apteczka");
    const s = store.getState();
    act(() => patchUi(store, { inventory: { ...s.inventory, stacks: { scrap: 3 } } }));
    expect(screen.getByTestId("item-detail").textContent).toContain("Pick an item");
  });
});

describe("character preview", () => {
  it("sends its rectangle, turns on a drag, resets on a double tap and hides on close", () => {
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 20, y: 60, left: 20, top: 60, width: 160, height: 240, right: 180, bottom: 300, toJSON: () => ({}) } as DOMRect);
    try {
      const { i, store } = mount({ characterTab: "inventory" });
      expect(i.setPreviewViewport).toHaveBeenLastCalledWith({ x: 20, y: 60, width: 160, height: 240 });
      const box = screen.getByTestId("character-preview");
      fireEvent.pointerDown(box, { pointerId: 1, clientX: 50, clientY: 100 });
      fireEvent.pointerMove(box, { pointerId: 1, clientX: 90, clientY: 100 });
      fireEvent.pointerUp(box, { pointerId: 1, clientX: 90, clientY: 100 });
      expect(i.rotatePreview).toHaveBeenCalledTimes(1);
      expect(vi.mocked(i.rotatePreview).mock.calls[0]![0]).toBeCloseTo(0.48);
      for (const t of [1000, 1200]) {
        fireEvent.pointerDown(box, { pointerId: 2, clientX: 60, clientY: 100, timeStamp: t });
        fireEvent.pointerUp(box, { pointerId: 2, clientX: 60, clientY: 100, timeStamp: t + 40 });
      }
      expect(i.resetPreview).toHaveBeenCalledTimes(1);
      act(() => store.getState().closeCharacter());
      expect(i.setPreviewViewport).toHaveBeenLastCalledWith(null);
    } finally {
      rect.mockRestore();
    }
  });
});
