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
  exportSave: vi.fn(),
  importSave: vi.fn(),
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
  setDifficulty: vi.fn(),
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
  spendAttributePoint: vi.fn(),
  spendPerkPoint: vi.fn(),
  respec: vi.fn(),
  openPhone: vi.fn(),
  closePhone: vi.fn(),
  readThread: vi.fn(),
  dismissDebrief: vi.fn(),
  setScan: vi.fn(),
  pickQuickhack: vi.fn(),
  submitBreach: vi.fn(),
  selectMetroStop: vi.fn(),
  buyMetroTicket: vi.fn(),
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

describe("a hostile reputation narrows the counter instead of closing it (ADR-0070)", () => {
  const standing = (patch: Partial<ReturnType<typeof createReputation>>) => ({ ...createReputation(), ...patch });

  it("Oyaji sells only ammo, at half again the price, and says why the rest is greyed out", () => {
    const { i } = mount({ shopId: "oyaji", reputation: standing({ civilians: -60 }) });
    expect(screen.getByTestId("shop-terms").textContent).toBe("The street fears you · 50% surcharge");
    expect(screen.getByTestId("shop-basic").textContent).toContain("ammo only");
    fireEvent.click(within(screen.getByTestId("stock-9mm")).getByRole("button", { name: /Buy · 36 €\$/ }));
    expect(i.buyItem).toHaveBeenCalledWith("9mm");
    const smg = screen.getByTestId("stock-hebi_smg");
    expect(smg.className).toContain("shop__item--locked");
    expect(within(smg).getByRole("button", { name: "Not for you" }).hasAttribute("disabled")).toBe(true);
    expect(within(smg).getByTestId("shop-locked-why").textContent).toBe("Under the counter while your reputation is hostile.");
    expect(screen.getByTestId("stock-9mm").className).not.toContain("shop__item--locked");
    expect(within(screen.getByTestId("shop-backpack")).getByRole("button", { name: "Not for you" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByTestId("shop-tab-sell"));
    // The uncommon SMG: 280 at list terms, half from a hostile trader.
    expect(screen.getByTestId("shop-sell").textContent).toContain("Sell · 140 €$");
    fireEvent.click(screen.getByTestId("shop-tab-repair"));
    expect(within(screen.getByTestId("shop-repair-line")).getByRole("button", { name: "Not for you" }).hasAttribute("disabled")).toBe(true);
  });

  // With money and room to spare only the reputation can grey the SMG out.
  it("a full wallet does not buy what is under the counter", () => {
    const { i } = mount({ shopId: "oyaji", eddies: 100_000, reputation: standing({ civilians: -60 }) });
    const buy = within(screen.getByTestId("stock-hebi_smg")).getByRole("button", { name: "Not for you" });
    expect(buy.hasAttribute("disabled")).toBe(true);
    fireEvent.click(buy);
    expect(i.buyItem).not.toHaveBeenCalled();
  });

  it("a wary street keeps the full offer", () => {
    mount({ shopId: "oyaji", reputation: standing({ civilians: -49 }) });
    expect(screen.queryByTestId("shop-basic")).toBeNull();
    expect(screen.queryByTestId("shop-locked-why")).toBeNull();
    expect(within(screen.getByTestId("stock-hebi_smg")).getByRole("button", { name: /Buy · / })).toBeTruthy();
  });

  it("Mori sells medkits but no implants, and does not operate", () => {
    mount({ shopId: "clinic", eddies: 5000, cyberware: { optics: "hitomi_optics_mk1" }, reputation: standing({ clinic: -60 }) });
    expect(screen.getByTestId("shop-terms").textContent).toBe("The clinic sees you as a threat · 50% surcharge");
    expect(screen.getByTestId("shop-basic").textContent).toContain("Mori won't put you on the table");
    expect(within(screen.getByTestId("stock-medkit")).getByRole("button", { name: /Buy · 135 €\$/ }).hasAttribute("disabled")).toBe(false);
    expect(within(screen.getByTestId("implant-steady_grip")).getByRole("button", { name: "Not for you" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByTestId("shop-tab-implants"));
    const bag = screen.getAllByTestId("shop-bag-implant");
    expect(within(bag[0]!).getByRole("button", { name: "Not for you" }).hasAttribute("disabled")).toBe(true);
    expect(within(screen.getByTestId("shop-installed")).getByRole("button", { name: "Not for you" }).hasAttribute("disabled")).toBe(true);
  });

  // Decision 5.11 (ADR-0070): the capacity shard is cyberware work, so it greys out with the implants.
  // Decision 6.11: the Shizuka stim is a combat stim and greys out too.
  it("Mori keeps the capacity shard and the combat stim under the counter", () => {
    mount({ shopId: "clinic", eddies: 5000, reputation: standing({ clinic: -60 }) });
    expect(screen.getByTestId("shop-basic").textContent).toContain("capacity shard");
    const shard = screen.getByTestId("stock-capacity_shard");
    expect(shard.className).toContain("shop__item--locked");
    expect(within(shard).getByRole("button", { name: "Not for you" }).hasAttribute("disabled")).toBe(true);
    expect(within(screen.getByTestId("stock-steady_stim")).getByRole("button", { name: "Not for you" }).hasAttribute("disabled")).toBe(true);
    expect(within(screen.getByTestId("stock-medkit")).getByRole("button", { name: /Buy · 135 €\$/ }).hasAttribute("disabled")).toBe(false);
  });

  it("a wary clinic still sells the shard, dearer", () => {
    mount({ shopId: "clinic", eddies: 5000, reputation: standing({ clinic: -49 }) });
    expect(within(screen.getByTestId("stock-capacity_shard")).getByRole("button", { name: /Buy · 563 €\$/ }).hasAttribute("disabled")).toBe(false);
  });

  it("Fumiko's food is all basics: a surcharge, nothing greyed out", () => {
    mount({ shopId: "yatai", reputation: standing({ civilians: -60 }) });
    expect(screen.getByTestId("shop-terms").textContent).toBe("The street fears you · 50% surcharge");
    expect(screen.queryByTestId("shop-basic")).toBeNull();
    expect(screen.queryByText("Not for you")).toBeNull();
  });

  it("says it in Polish too", () => {
    mount({ shopId: "oyaji", reputation: standing({ civilians: -60 }), settings: { ...createUiStore().getState().settings, locale: "pl" } });
    expect(screen.getByTestId("shop-terms").textContent).toBe("Ulica się ciebie boi · dopłata 50%");
    expect(screen.getByTestId("shop-basic").textContent).toContain("tylko amunicja");
    const smg = screen.getByTestId("stock-hebi_smg");
    expect(within(smg).getByRole("button", { name: "Nie dla ciebie" })).toBeTruthy();
    expect(within(smg).getByTestId("shop-locked-why").textContent).toBe("Pod ladą, dopóki masz wrogą reputację.");
  });

  it("Mori names the shard in Polish too", () => {
    mount({ shopId: "clinic", reputation: standing({ clinic: -60 }), settings: { ...createUiStore().getState().settings, locale: "pl" } });
    expect(screen.getByTestId("shop-basic").textContent).toContain("sharda pojemności");
  });
});
