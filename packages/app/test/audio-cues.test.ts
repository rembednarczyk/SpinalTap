import { describe, expect, it } from "vitest";
import { type AudioCue, type DomainEvents, EventBus, type RenderPort } from "@seki/core";
import { createUiStore } from "@seki/ui";
import { audioSampleManifest } from "../src/audio-manifest";
import { bindEventPresenter } from "../src/event-presenter";

const render: RenderPort = {
  spawn() {},
  updateTransform() {},
  despawn() {},
  clear() {},
  setCameraMode() {},
  attachCamera() {},
  playEffect() {},
  setAppearance() {},
};

const PLAYER = 1;
const NPC = 7;

const setup = () => {
  const bus = new EventBus<DomainEvents>();
  const cues: AudioCue[] = [];
  const ui = createUiStore();
  bindEventPresenter(bus, render, { play: (c) => cues.push(c), stopAll() {} }, ui, {
    playerId: () => PLAYER,
    onDialogue() {},
    onShop() {},
    onLoot() {},
    onPlayerDied() {},
    onDialogueInterrupted() {},
  });
  return { bus, cues, ui };
};

describe("weapon, loot and trade cues (E12)", () => {
  it("each new event plays its own cue", () => {
    const { bus, cues } = setup();
    bus.emit("ReloadStarted", { entityId: PLAYER, duration: 1.4 });
    bus.emit("WeaponSwitched", { entityId: PLAYER, slot: "primary", weapon: "hebi_smg" });
    bus.emit("LootTaken", { containerKey: "loot:guard", lines: [{ kind: "eddies", qty: 12 }], left: 0 });
    bus.emit("ItemSold", { shopId: "oyaji", defId: "scrap", qty: 2, price: 24 });
    bus.emit("ItemRepaired", { uid: "i2", defId: "seki_jacket", price: 20, parts: 1 });
    expect(cues).toEqual(["reload", "weapon-switch", "loot-pickup", "sell", "repair"]);
  });

  it("other people's reloads and weapon changes stay silent; an empty take too", () => {
    const { bus, cues } = setup();
    bus.emit("ReloadStarted", { entityId: NPC, duration: 2 });
    bus.emit("WeaponSwitched", { entityId: NPC, slot: "secondary", weapon: "unity9" });
    bus.emit("LootTaken", { containerKey: "loot:guard", lines: [], left: 2 });
    expect(cues).toEqual([]);
  });

  it("trade toasts name the piece and the money; a sale is no bank transfer", () => {
    const { bus, ui } = setup();
    bus.emit("ItemSold", { shopId: "oyaji", defId: "scrap", qty: 2, price: 24 });
    bus.emit("EddiesChanged", { balance: 144, delta: 24, source: "sale" });
    bus.emit("ItemRepaired", { uid: "i2", defId: "seki_jacket", price: 20, parts: 1 });
    bus.emit("ItemRepaired", { uid: "i2", defId: "seki_jacket", price: 45, parts: 0 });
    bus.emit("CapacityUpgraded", { capacity: 30, price: 600 });
    bus.emit("ItemBought", { itemId: "9mm", price: 24, shopId: "oyaji", qty: 24 });
    bus.emit("PurchaseFailed", { reason: "closed", shopId: "oyaji" });
    bus.emit("CyberwareRemoved", { cyberwareId: "steady_grip", slot: "arms" });
    bus.emit("CyberwareInstalled", { cyberwareId: "kairos_overclock", replaced: "synapse_booster", price: 275, fromBag: true, stowed: true });
    bus.emit("CyberwareInstalled", { cyberwareId: "synapse_booster", replaced: "kairos_overclock", price: 900, stowed: false });
    const toasts = ui.getState().toasts.map((t) => `${t.title} | ${t.text}`);
    expect(toasts.slice(-4)).toEqual([
      "Oyaji shakes his head | Closed. Come back in the daytime.",
      "Uninstalled: Stabilizator chwytu | Implant in the backpack",
      "Implanted: Akcelerator Kairos | Wzmacniacz synaps goes back to the backpack",
      "Implanted: Wzmacniacz synaps | Removed: Akcelerator Kairos",
    ]);
    // The toast list keeps the last four; check the earlier ones by listening again.
    const again = setup();
    again.bus.emit("ItemSold", { shopId: "oyaji", defId: "scrap", qty: 2, price: 24 });
    again.bus.emit("EddiesChanged", { balance: 144, delta: 24, source: "sale" });
    again.bus.emit("ItemRepaired", { uid: "i2", defId: "seki_jacket", price: 20, parts: 1 });
    again.bus.emit("CapacityUpgraded", { capacity: 30, price: 600 });
    again.bus.emit("ItemBought", { itemId: "9mm", price: 24, shopId: "oyaji", qty: 24 });
    expect(again.ui.getState().toasts.map((t) => `${t.title} | ${t.text}`)).toEqual([
      "Sold: Electronic scrap × 2 | +24 €$",
      "Repaired: Seki's jacket | -20 €$, parts: 1",
      "Bigger backpack | Slots: 30",
      "Bought: 9 mm × 24 | -24 €$",
    ]);
  });

  it("writes the trade and loot toasts in Polish as before when Polish is chosen (ADR-0056)", () => {
    const { bus, ui } = setup();
    ui.setState({ settings: { ...ui.getState().settings, locale: "pl" } });
    bus.emit("EddiesChanged", { balance: 13000, delta: 12500 });
    bus.emit("ItemRepaired", { uid: "i2", defId: "seki_jacket", price: 20, parts: 1 });
    bus.emit("PurchaseFailed", { reason: "closed", shopId: "oyaji" });
    bus.emit("LootExpired", { containerKey: "loot:guard" });
    expect(ui.getState().toasts.map((t) => `${t.title} | ${t.text}`)).toEqual([
      "+12 500 €$ | Przelew",
      "Naprawiono: Kurtka Seki | -20 €$, części: 1",
      "Oyaji kręci głową | Zamknięte. Wróć za dnia.",
      "Torba przepadła | Ktoś był szybszy.",
    ]);
  });

  it("jumps and landings: the player's own, a heavy thud for a long drop, nothing for a kerb (ADR-0021)", () => {
    const { bus, cues } = setup();
    const at = { x: 0, y: 0, z: 0 };
    bus.emit("Jumped", { entityId: PLAYER, at });
    bus.emit("Landed", { entityId: PLAYER, drop: 1.2, hard: false, damage: 0, at });
    bus.emit("Landed", { entityId: PLAYER, drop: 9.9, hard: true, damage: 59, at });
    bus.emit("Landed", { entityId: PLAYER, drop: 0.38, hard: false, damage: 0, at });
    bus.emit("Jumped", { entityId: NPC, at });
    bus.emit("Landed", { entityId: NPC, drop: 5, hard: true, damage: 10, at });
    expect(cues).toEqual(["jump", "land", "land-hard"]);
  });

  it("every new cue has a recording", () => {
    const cues = audioSampleManifest("https://example.test/audio/").cues ?? {};
    for (const cue of ["reload", "weapon-switch", "loot-pickup", "sell", "repair"] as const) expect(cues[cue]?.urls.length, cue).toBeGreaterThan(0);
  });
});
