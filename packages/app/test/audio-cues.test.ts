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
    bus.emit("ReloadStarted", { entityId: PLAYER, duration: 1.4, perRound: false });
    bus.emit("WeaponSwitched", { entityId: PLAYER, slot: "primary", weapon: "hebi_smg" });
    bus.emit("LootTaken", { containerKey: "loot:guard", lines: [{ kind: "eddies", qty: 12 }], left: 0 });
    bus.emit("ItemSold", { shopId: "oyaji", defId: "scrap", qty: 2, price: 24 });
    bus.emit("ItemRepaired", { uid: "i2", defId: "seki_jacket", price: 20, parts: 1 });
    expect(cues).toEqual(["reload", "draw-smg", "loot-pickup", "sell", "repair"]);
  });

  it("draws each weapon with its own handling, the one in hand out of the holster, and puts it away (user notes of 21.11)", () => {
    const { bus, cues, ui } = setup();
    for (const weapon of ["unity9", "oni44", "hebi_smg", "raijin12", "tessen_ar5", "kagero_dmr", "baton", "shirasaya"] as const) bus.emit("WeaponSwitched", { entityId: PLAYER, slot: "primary", weapon });
    bus.emit("WeaponSwitched", { entityId: NPC, slot: "primary", weapon: "raijin12" });
    expect(cues).toEqual(["draw-pistol", "draw-revolver", "draw-smg", "draw-shotgun", "draw-rifle", "draw-rifle", "draw-baton", "draw-blade"]);
    cues.length = 0;
    // Out of the holster: the weapon the HUD's strip has in hand; a hand it names nothing in, the plain click.
    ui.setState({ weapons: { slots: [{ slot: "primary", key: 1, name: "item.raijin12.name", rarity: null, icon: null }], active: "primary", loaded: 6, magazine: 6, reserve: 12, ammoName: null, reloading: false, holstered: true } });
    bus.emit("WeaponToggled", { entityId: PLAYER, drawn: true });
    bus.emit("WeaponToggled", { entityId: PLAYER, drawn: false });
    ui.setState({ weapons: null });
    bus.emit("WeaponToggled", { entityId: PLAYER, drawn: true });
    bus.emit("WeaponToggled", { entityId: NPC, drawn: true });
    expect(cues).toEqual(["draw-shotgun", "holster", "weapon-switch"]);
  });

  it("her own horn sounds once a press, recorded like the street's (ADR-0097)", () => {
    const { bus, cues } = setup();
    bus.emit("VehicleHorn", { vehicleId: 900, at: { x: 0, y: 0, z: 0 } });
    expect(cues).toEqual(["horn"]);
    const m = audioSampleManifest("https://game.test/audio/");
    for (const cue of ["horn", "car-door-open", "car-door-close", "engine-start", "engine-stop"] as const) expect(m.cues?.[cue]?.urls.length, cue).toBe(1);
    expect(m.engine?.url).toBe("https://game.test/audio/engine-loop-000.ogg");
  });

  it("a magazine change plays the recorded reload, a shell into a tube only its click", () => {
    const { bus, cues } = setup();
    bus.emit("ReloadStarted", { entityId: PLAYER, duration: 1.4, perRound: false });
    bus.emit("ReloadStarted", { entityId: PLAYER, duration: 0.5, perRound: true });
    bus.emit("ReloadStarted", { entityId: PLAYER, duration: 0.5, perRound: true });
    expect(cues).toEqual(["reload", "reload-round", "reload-round"]);
  });

  it("racks the shotgun's slide once its run of rounds is in, not after a magazine or between rounds (user notes of 18.11)", () => {
    const { bus, cues } = setup();
    bus.emit("ReloadFinished", { entityId: PLAYER, loaded: 2, ready: false, perRound: true });
    bus.emit("ReloadFinished", { entityId: PLAYER, loaded: 3, ready: true, perRound: true });
    bus.emit("ReloadFinished", { entityId: PLAYER, loaded: 12, ready: true, perRound: false });
    bus.emit("ReloadFinished", { entityId: NPC, loaded: 6, ready: true, perRound: true });
    expect(cues).toEqual(["shotgun-pump"]);
  });

  it("knocks when a melee blow lands, a miss is the whoosh alone", () => {
    const { bus, cues } = setup();
    bus.emit("MeleeStrike", { entityId: PLAYER, strike: 1, hits: 0 });
    bus.emit("MeleeStrike", { entityId: PLAYER, strike: 2, hits: 1 });
    expect(cues).toEqual(["swing", "swing", "impact-melee"]);
  });

  it("every weapon kind fires its own recorded shot; others are heard from further away", () => {
    const { bus, cues } = setup();
    const at = { x: 0, y: 1, z: 0 };
    for (const look of ["pistol", "revolver", "smg", "shotgun", "rifle"] as const) {
      bus.emit("ShotFired", { shooterId: PLAYER, from: at, to: at, hitEntity: null, look });
      bus.emit("ShotFired", { shooterId: NPC, from: at, to: at, hitEntity: null, look });
    }
    expect(cues).toEqual([
      "shot", "enemy-shot",
      "shot-revolver", "enemy-shot",
      "shot-smg", "enemy-shot",
      "shot-shotgun", "enemy-shot-shotgun",
      "shot-rifle", "enemy-shot-rifle",
    ]);
  });

  it("other people's reloads and weapon changes stay silent; an empty take too", () => {
    const { bus, cues } = setup();
    bus.emit("ReloadStarted", { entityId: NPC, duration: 2, perRound: false });
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
      "Uninstalled: Grip stabiliser | Implant in the backpack",
      "Implanted: Kairos accelerator | Synapse booster goes back to the backpack",
      "Implanted: Synapse booster | Removed: Kairos accelerator",
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
    // A bag that lay too long goes without a toast (G-915): nobody took it.
    bus.emit("LootExpired", { containerKey: "loot:guard" });
    expect(ui.getState().toasts.map((t) => `${t.title} | ${t.text}`)).toEqual([
      "+12 500 €$ | Przelew",
      "Naprawiono: Kurtka Seki | -20 €$, części: 1",
      "Oyaji kręci głową | Zamknięte. Wróć za dnia.",
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
    for (const cue of ["reload", "weapon-switch", "loot-pickup", "sell", "repair", "draw-pistol", "draw-revolver", "draw-smg", "draw-shotgun", "draw-rifle", "draw-baton", "draw-blade", "holster"] as const) expect(cues[cue]?.urls.length, cue).toBeGreaterThan(0);
  });
});
