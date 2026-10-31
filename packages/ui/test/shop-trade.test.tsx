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
  setFieldOfView: vi.fn(),
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
  travelMetro: vi.fn(),
  closeMetro: vi.fn(),
  setRadioStation: vi.fn(),
  nextRadioStation: vi.fn(),
  trackQuest: vi.fn(),
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
    piece("i5", "steady_grip", "cyberware.steady_grip.name", { category: "cyberware" }),
    piece("i6", "hitomi_optics_mk1", "cyberware.hitomi_optics_mk1.name", { category: "cyberware" }),
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
    expect(shop.getAttribute("aria-label")).toBe("Oyaji's stall");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Buy", "Sell", "Repairs"]);
    expect(shop.textContent).toContain("9 mm × 24");
    fireEvent.click(within(shop).getAllByRole("button", { name: /Buy · 24 €\$/ })[0]!);
    expect(i.buyItem).toHaveBeenCalledWith("9mm");
    fireEvent.click(within(screen.getByTestId("shop-backpack")).getByRole("button", { name: /Buy · 600/ }));
    expect(i.upgradeBackpack).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Talk to Oyaji" }));
    expect(i.talkToShopkeeper).toHaveBeenCalled();
  });

  it("the Sell tab quotes with the core sale price and sells", () => {
    const { i } = mount({ shopId: "oyaji" });
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    const lines = screen.getAllByTestId("shop-sell-line");
    const text = lines.map((l) => l.textContent);
    // Worn pieces cannot go; the uncommon SMG fetches 280, scrap its full 12 a piece.
    expect(text.find((t) => t?.includes("Unity-9"))).toContain("In use");
    expect(text.find((t) => t?.includes("Hitomi Mk1 optics"))).toContain("Worthless");
    const smg = lines.find((l) => l.textContent?.includes("Hebi SMG"))!;
    expect(smg.textContent).toContain("uncommon");
    fireEvent.click(within(smg).getByRole("button", { name: /Sell · 280 €\$/ }));
    expect(i.sellItem).toHaveBeenCalledWith({ uid: "i4" }, 1);
    const scrap = lines.find((l) => l.textContent?.includes("Złom"))!;
    fireEvent.click(within(scrap).getByRole("button", { name: /All · 36 €\$/ }));
    expect(i.sellItem).toHaveBeenCalledWith({ stack: "scrap" }, 3);
  });

  it("pays a trusted regular more and a wary customer less", () => {
    mount({ shopId: "oyaji", reputation: { ...createReputation(), civilians: 80 } });
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    expect(screen.getByTestId("shop-sell").textContent).toContain("Sell · 336 €$");
    cleanup();
    mount({ shopId: "oyaji", reputation: { ...createReputation(), civilians: -30 } });
    expect(screen.getByTestId("shop-terms").textContent).toBe("Oyaji doesn't trust you · 25% surcharge");
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    expect(screen.getByTestId("shop-sell").textContent).toContain("Sell · 210 €$");
  });

  it("quotes repairs with and without weapon parts", () => {
    const { i } = mount({ shopId: "oyaji" });
    fireEvent.click(screen.getByTestId("shop-tab-repair"));
    // Kurtka Seki at 40%: 150 × 0.3 × 0.6 = 27, one part takes 25 off.
    const line = screen.getByTestId("shop-repair-line");
    expect(line.textContent).toContain("condition 40% · parts: 1");
    fireEvent.click(within(line).getByRole("button", { name: /Repair · 2 €\$/ }));
    expect(i.repairItem).toHaveBeenCalledWith("i2", 1);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(within(screen.getByTestId("shop-repair-line")).getByRole("button", { name: /Repair · 27 €\$/ }));
    expect(i.repairItem).toHaveBeenLastCalledWith("i2", 0);
  });

  it("says so when there is nothing to sell or mend, and when the bag is as big as it gets", () => {
    mount({ shopId: "oyaji", trade: { items: [], capacity: 36, freeCells: 36, weaponParts: 0 } });
    expect(within(screen.getByTestId("shop-backpack")).getByRole("button", { name: "Biggest backpack" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    expect(screen.getByText("You have nothing they'd buy here.")).toBeTruthy();
    fireEvent.click(screen.getByTestId("shop-tab-repair"));
    expect(screen.getByText(/Your clothes are whole/)).toBeTruthy();
  });
});

describe("clinic with implants from the bag (E11)", () => {
  it("lists implants carried in the bag with the fitting fee", () => {
    const { i } = mount({ shopId: "clinic", cyberware: { optics: "hitomi_optics_mk1" } });
    fireEvent.click(screen.getByTestId("shop-tab-implants"));
    const bag = screen.getAllByTestId("shop-bag-implant");
    expect(bag.map((b) => b.textContent)).toEqual([expect.stringContaining("Grip stabiliser"), expect.stringContaining("Hitomi Mk1 optics")]);
    fireEvent.click(within(bag[0]!).getByRole("button", { name: /Fit · 125 €\$/ }));
    expect(i.installCyberwareItem).toHaveBeenCalledWith("i5");
    expect(within(bag[1]!).getByRole("button", { name: "Already implanted" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(within(screen.getByTestId("shop-installed")).getByRole("button", { name: /Remove · free/ }));
    expect(i.removeCyberware).toHaveBeenCalledWith("optics");
  });

  it("names the implant a fitting replaces, and that it comes back", () => {
    mount({ shopId: "clinic", cyberware: { arms: "steady_grip" }, trade: { ...BAG, items: [piece("i9", "steady_grip", "cyberware.steady_grip.name", { category: "cyberware" })] } });
    fireEvent.click(screen.getByTestId("shop-tab-implants"));
    expect(screen.getByTestId("shop-bag-implant").textContent).toContain("Already implanted");
    cleanup();
    mount({ shopId: "clinic", cyberware: { nervous: "synapse_booster" }, trade: { ...BAG, items: [piece("i9", "kairos_overclock", "cyberware.kairos_overclock.name", { category: "cyberware" })] } });
    fireEvent.click(screen.getByTestId("shop-tab-implants"));
    expect(screen.getByTestId("shop-bag-implant").textContent).toContain("replaces: Synapse booster (back to the backpack)");
  });

  it("warns before a purchase when the old implant has nowhere to go; a full bag cannot take one out", () => {
    mount({ shopId: "clinic", cyberware: { nervous: "synapse_booster", optics: "hitomi_optics_mk1" }, trade: { ...BAG, items: [], freeCells: 0 } });
    expect(screen.getAllByText("No room: the old implant will be lost").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("shop-tab-implants"));
    expect(screen.getByText("You have no implants in your backpack.")).toBeTruthy();
    expect(within(screen.getByTestId("shop-installed")).getAllByRole("button", { name: "No room" })[0]!.hasAttribute("disabled")).toBe(true);
  });

  it("the clinic only buys implants", () => {
    const { i } = mount({ shopId: "clinic" });
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    const lines = screen.getAllByTestId("shop-sell-line");
    expect(lines.map((l) => l.textContent)).toEqual([expect.stringContaining("Grip stabiliser"), expect.stringContaining("Hitomi Mk1 optics")]);
    fireEvent.click(within(lines[0]!).getByRole("button", { name: /Sell · 125 €\$/ }));
    expect(i.sellItem).toHaveBeenCalledWith({ uid: "i5" }, 1);
  });
});
