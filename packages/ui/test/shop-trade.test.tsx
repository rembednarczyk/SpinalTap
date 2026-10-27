// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReputation } from "@seki/core";
import { GameUi, type TradeItemVm, type TradeVm, type UiIntents, type UiState, createUiStore } from "../src";

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
});

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

const BAG: TradeVm = {
  items: [
    piece("i1", "unity9", "Unity-9", { inUse: true }),
    piece("i2", "seki_jacket", "Kurtka Seki", { category: "garment", condition: 40, inUse: true }),
    piece("i4", "hebi_smg", "Hebi SMG", { rarity: "uncommon" }),
    piece("i5", "steady_grip", "Stabilizator chwytu", { category: "cyberware" }),
    piece("i6", "hitomi_optics_mk1", "Optyka Hitomi Mk1", { category: "cyberware" }),
    { ...piece("scrap", "scrap", "Złom elektroniczny", { category: "junk", rarity: null, qty: 3 }), ref: { stack: "scrap" } },
    { ...piece("weapon_parts", "weapon_parts", "Części broni", { category: "junk", rarity: null, qty: 1 }), ref: { stack: "weapon_parts" } },
  ],
  capacity: 24,
  freeCells: 19,
  weaponParts: 1,
};

const mount = (state: Partial<UiState>) => {
  const store = createUiStore({ screen: "playing", shopOpen: true, eddies: 1000, trade: BAG, ...state });
  const i = intents();
  render(<GameUi store={store} intents={i} />);
  return { store, i };
};

afterEach(cleanup);

describe("Oyaji's stall", () => {
  it("has its own counter with buy, sell and repair tabs", () => {
    const { i } = mount({ shopId: "oyaji" });
    const shop = screen.getByTestId("shop");
    expect(shop.getAttribute("aria-label")).toBe("Stragan Oyajiego");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Kup", "Sprzedaj", "Naprawa"]);
    expect(shop.textContent).toContain("9 mm × 24");
    fireEvent.click(within(shop).getAllByRole("button", { name: /Kup · 24 €\$/ })[0]!);
    expect(i.buyItem).toHaveBeenCalledWith("9mm");
    fireEvent.click(within(screen.getByTestId("shop-backpack")).getByRole("button", { name: /Kup · 600/ }));
    expect(i.upgradeBackpack).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Porozmawiaj z Oyajim" }));
    expect(i.talkToShopkeeper).toHaveBeenCalled();
  });

  it("the Sprzedaj tab quotes with the core sale price and sells", () => {
    const { i } = mount({ shopId: "oyaji" });
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    const lines = screen.getAllByTestId("shop-sell-line");
    const text = lines.map((l) => l.textContent);
    // Worn pieces cannot go; the uncommon SMG fetches 280, scrap its full 12 a piece.
    expect(text.find((t) => t?.includes("Unity-9"))).toContain("W użyciu");
    expect(text.find((t) => t?.includes("Optyka"))).toContain("Bez wartości");
    const smg = lines.find((l) => l.textContent?.includes("Hebi SMG"))!;
    expect(smg.textContent).toContain("niezwykły");
    fireEvent.click(within(smg).getByRole("button", { name: /Sprzedaj · 280 €\$/ }));
    expect(i.sellItem).toHaveBeenCalledWith({ uid: "i4" }, 1);
    const scrap = lines.find((l) => l.textContent?.includes("Złom"))!;
    fireEvent.click(within(scrap).getByRole("button", { name: /Wszystkie · 36 €\$/ }));
    expect(i.sellItem).toHaveBeenCalledWith({ stack: "scrap" }, 3);
  });

  it("pays a trusted regular more and a wary customer less", () => {
    mount({ shopId: "oyaji", reputation: { ...createReputation(), civilians: 80 } });
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    expect(screen.getByTestId("shop-sell").textContent).toContain("Sprzedaj · 336 €$");
    cleanup();
    mount({ shopId: "oyaji", reputation: { ...createReputation(), civilians: -30 } });
    expect(screen.getByTestId("shop-terms").textContent).toBe("Oyaji ci nie ufa · dopłata 25%");
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    expect(screen.getByTestId("shop-sell").textContent).toContain("Sprzedaj · 210 €$");
  });

  it("quotes repairs with and without weapon parts", () => {
    const { i } = mount({ shopId: "oyaji" });
    fireEvent.click(screen.getByTestId("shop-tab-repair"));
    // Kurtka Seki at 40%: 150 × 0.3 × 0.6 = 27, one part takes 25 off.
    const line = screen.getByTestId("shop-repair-line");
    expect(line.textContent).toContain("stan 40%");
    fireEvent.click(within(line).getByRole("button", { name: /Napraw · 2 €\$/ }));
    expect(i.repairItem).toHaveBeenCalledWith("i2", 1);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(within(screen.getByTestId("shop-repair-line")).getByRole("button", { name: /Napraw · 27 €\$/ }));
    expect(i.repairItem).toHaveBeenLastCalledWith("i2", 0);
  });

  it("says so when there is nothing to sell or mend, and when the bag is as big as it gets", () => {
    mount({ shopId: "oyaji", trade: { items: [], capacity: 36, freeCells: 36, weaponParts: 0 } });
    expect(within(screen.getByTestId("shop-backpack")).getByRole("button", { name: "Największy plecak" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    expect(screen.getByText("Nie masz nic, co by tu kupili.")).toBeTruthy();
    fireEvent.click(screen.getByTestId("shop-tab-repair"));
    expect(screen.getByText(/Ubrania całe/)).toBeTruthy();
  });
});

describe("clinic with implants from the bag (E11)", () => {
  it("lists implants carried in the bag with the fitting fee", () => {
    const { i } = mount({ shopId: "clinic", cyberware: { optics: "hitomi_optics_mk1" } });
    fireEvent.click(screen.getByTestId("shop-tab-implants"));
    const bag = screen.getAllByTestId("shop-bag-implant");
    expect(bag.map((b) => b.textContent)).toEqual([expect.stringContaining("Stabilizator chwytu"), expect.stringContaining("Optyka Hitomi Mk1")]);
    fireEvent.click(within(bag[0]!).getByRole("button", { name: /Zamontuj · 125 €\$/ }));
    expect(i.installCyberwareItem).toHaveBeenCalledWith("i5");
    expect(within(bag[1]!).getByRole("button", { name: "Już wszczepiony" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(within(screen.getByTestId("shop-installed")).getByRole("button", { name: /Wymontuj/ }));
    expect(i.removeCyberware).toHaveBeenCalledWith("optics");
  });

  it("names the implant a fitting replaces, and that it comes back", () => {
    mount({ shopId: "clinic", cyberware: { arms: "steady_grip" }, trade: { ...BAG, items: [piece("i9", "steady_grip", "Stabilizator chwytu", { category: "cyberware" })] } });
    fireEvent.click(screen.getByTestId("shop-tab-implants"));
    expect(screen.getByTestId("shop-bag-implant").textContent).toContain("Już wszczepiony");
    cleanup();
    mount({ shopId: "clinic", cyberware: { nervous: "synapse_booster" }, trade: { ...BAG, items: [piece("i9", "kairos_overclock", "Akcelerator Kairos", { category: "cyberware" })] } });
    fireEvent.click(screen.getByTestId("shop-tab-implants"));
    expect(screen.getByTestId("shop-bag-implant").textContent).toContain("zastąpi: Wzmacniacz synaps (wróci do plecaka)");
  });

  it("warns before a purchase when the old implant has nowhere to go; a full bag cannot take one out", () => {
    mount({ shopId: "clinic", cyberware: { nervous: "synapse_booster", optics: "hitomi_optics_mk1" }, trade: { ...BAG, items: [], freeCells: 0 } });
    expect(screen.getAllByText("Brak miejsca: stary implant przepadnie").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("shop-tab-implants"));
    expect(screen.getByText("W plecaku nie masz żadnego wszczepu.")).toBeTruthy();
    expect(within(screen.getByTestId("shop-installed")).getAllByRole("button", { name: "Brak miejsca" })[0]!.hasAttribute("disabled")).toBe(true);
  });

  it("the clinic only buys implants", () => {
    const { i } = mount({ shopId: "clinic" });
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    const lines = screen.getAllByTestId("shop-sell-line");
    expect(lines.map((l) => l.textContent)).toEqual([expect.stringContaining("Stabilizator"), expect.stringContaining("Optyka")]);
    fireEvent.click(within(lines[0]!).getByRole("button", { name: /Sprzedaj · 125 €\$/ }));
    expect(i.sellItem).toHaveBeenCalledWith({ uid: "i5" }, 1);
  });
});
