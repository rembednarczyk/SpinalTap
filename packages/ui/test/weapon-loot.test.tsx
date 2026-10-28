// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUi, type TouchPadSink, type UiIntents, type UiState, type WeaponStripVm, createUiStore, patchUi } from "../src";

const intents = (): UiIntents => ({
  newGame: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn(),
  save: vi.fn(),
  load: vi.fn(),
  choose: vi.fn(),
  closeDialogue: vi.fn(),
  quitToTitle: vi.fn(),
  buyCyberware: vi.fn(),
  buyItem: vi.fn(),
  closeShop: vi.fn(),
  talkToShopkeeper: vi.fn(),
  sellItem: vi.fn(),
  repairItem: vi.fn(),
  upgradeBackpack: vi.fn(),
  installCyberwareItem: vi.fn(),
  removeCyberware: vi.fn(),
  changeSettings: vi.fn(),
  bindKey: vi.fn(),
  resetControls: vi.fn(),
  reload: vi.fn(),
  takeLoot: vi.fn(),
  closeLoot: vi.fn(),
  openCharacterScreen: vi.fn(),
  closeCharacterScreen: vi.fn(),
  setPreviewViewport: vi.fn(),
  rotatePreview: vi.fn(),
  resetPreview: vi.fn(),
  equip: vi.fn(),
  unequip: vi.fn(),
  useItem: vi.fn(),
  dropItem: vi.fn(),
  installMod: vi.fn(),
  removeMod: vi.fn(),
  openPhone: vi.fn(),
  closePhone: vi.fn(),
  readThread: vi.fn(),
  dismissDebrief: vi.fn(),
  setScan: vi.fn(),
  pickQuickhack: vi.fn(),
  submitBreach: vi.fn(),
});

const pad = (): TouchPadSink => ({ setStick: vi.fn(), look: vi.fn(), press: vi.fn(), release: vi.fn(), reset: vi.fn(), selectWeaponSlot: vi.fn() });

const strip = (patch: Partial<WeaponStripVm> = {}): WeaponStripVm => ({
  slots: [
    { slot: "primary", key: 1, name: "Hebi SMG", rarity: "uncommon" },
    { slot: "secondary", key: 2, name: "Unity-9", rarity: "common" },
    { slot: "melee", key: 3, name: null, rarity: null },
  ],
  active: "secondary",
  loaded: 7,
  magazine: 12,
  reserve: 36,
  ammoName: "9 mm",
  reloading: false,
  holstered: false,
  ...patch,
});

const mount = (state: Partial<UiState> = {}, touch?: TouchPadSink) => {
  const store = createUiStore({ screen: "playing", ...state });
  const i = intents();
  render(<GameUi store={store} intents={i} touch={touch} />);
  return { store, i };
};

afterEach(cleanup);

describe("HUD weapon strip", () => {
  it("shows the slots, the active one and the rounds of the active weapon", () => {
    mount({ weapons: strip() });
    const el = screen.getByTestId("weapon-strip");
    expect(el.textContent).toContain("Hebi SMG");
    expect(el.textContent).toContain("Unity-9");
    expect(el.textContent).toContain("Wręcz");
    expect(screen.getByTestId("weapon-ammo").textContent).toContain("7 / 36");
    expect(screen.getByTestId("weapon-ammo").textContent).toContain("9 mm");
    expect(el.querySelector(".weapon-strip__slot--active")?.textContent).toContain("Unity-9");
    expect(el.querySelector(".rarity--uncommon")?.textContent).toContain("Hebi SMG");
    // Without a touch pad the slots are not buttons.
    expect(screen.queryByRole("button", { name: /Główna/ })).toBeNull();
  });

  it("tells reloading, empty, dry and holstered apart", () => {
    const { store } = mount({ weapons: strip({ reloading: true }) });
    expect(screen.getByTestId("weapon-ammo").textContent).toContain("przeładowanie");
    act(() => patchUi(store, { weapons: strip({ loaded: 0 }) }));
    expect(screen.getByTestId("weapon-ammo").textContent).toContain("pusty magazynek [R]");
    expect(screen.getByTestId("weapon-ammo").className).toContain("weapon-strip__ammo--empty");
    act(() => patchUi(store, { weapons: strip({ loaded: 0, reserve: 0 }) }));
    expect(screen.getByTestId("weapon-ammo").textContent).toContain("brak amunicji");
    act(() => patchUi(store, { weapons: strip({ holstered: true }) }));
    expect(screen.getByTestId("weapon-ammo").textContent).toContain("schowana");
  });

  it("labels melee and an empty hand without a round count", () => {
    const { store } = mount({ weapons: strip({ active: "primary", loaded: null, reserve: null, magazine: null, ammoName: null }) });
    expect(screen.getByTestId("weapon-ammo").textContent).toBe("wręcz");
    act(() => patchUi(store, { weapons: strip({ active: "melee", loaded: null, reserve: null, magazine: null, ammoName: null }) }));
    expect(screen.getByTestId("weapon-ammo").textContent).toBe("bez broni");
    act(() => patchUi(store, { weapons: null }));
    expect(screen.queryByTestId("weapon-strip")).toBeNull();
  });

  it("on a touch screen the slots pick the weapon through the pad, and R reloads", () => {
    const p = pad();
    mount({ weapons: strip() }, p);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Główna: Hebi SMG" }));
    expect(p.selectWeaponSlot).toHaveBeenCalledWith(1);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Wręcz: pusto" }));
    expect(p.selectWeaponSlot).toHaveBeenCalledWith(3);
    const reload = screen.getByRole("button", { name: "Przeładuj" });
    fireEvent.pointerDown(reload, { pointerId: 5 });
    expect(p.press).toHaveBeenCalledWith("reload");
    fireEvent.pointerUp(reload, { pointerId: 5 });
    expect(p.release).toHaveBeenCalledWith("reload");
  });
});

describe("loot panel", () => {
  const loot = {
    key: "loot:guard",
    title: "Torba gangera",
    lines: [
      { index: 0, kind: "eddies" as const, label: "€$", qty: 17, rarity: null },
      { index: 1, kind: "ammo" as const, label: "Amunicja 9 mm", qty: 9, rarity: null },
      { index: 2, kind: "item" as const, label: "Hebi SMG", qty: 1, rarity: "rare" as const },
    ],
  };

  it("lists the lines with quantities and rarity labels, and hides the pad", () => {
    mount({ loot }, pad());
    const panel = screen.getByTestId("loot");
    expect(panel.textContent).toContain("Torba gangera");
    const lines = screen.getAllByTestId("loot-line");
    expect(lines).toHaveLength(3);
    expect(lines[0]!.textContent).toContain("× 17");
    expect(lines[2]!.textContent).toContain("rzadki");
    expect(lines[2]!.className).toContain("rarity--rare");
    expect(screen.queryByTestId("touch-controls")).toBeNull();
  });

  it("takes one line, all of it, or leaves", () => {
    const { i } = mount({ loot });
    fireEvent.click(screen.getAllByRole("button", { name: "Weź" })[1]!);
    expect(i.takeLoot).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByTestId("loot-take-all"));
    expect(i.takeLoot).toHaveBeenCalledWith("all");
    fireEvent.click(screen.getByRole("button", { name: "Zostaw" }));
    expect(i.closeLoot).toHaveBeenCalled();
  });

  it("E takes all (a double E on a bag empties it), Esc leaves", () => {
    const { i } = mount({ loot });
    fireEvent.keyDown(window, { key: "e" });
    expect(i.takeLoot).toHaveBeenCalledWith("all");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(i.closeLoot).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "x" });
    expect(i.takeLoot).toHaveBeenCalledTimes(1);
  });

  it("says when the bag is empty and goes away when closed", () => {
    const { store } = mount({ loot: { ...loot, lines: [] } });
    expect(screen.getByTestId("loot").textContent).toContain("Pusto.");
    act(() => patchUi(store, { loot: null }));
    expect(screen.queryByTestId("loot")).toBeNull();
  });
});
