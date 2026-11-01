import { describe, expect, it } from "vitest";
import { type AppearanceDescriptor, type AudioPort, EMPTY_INPUT, type RenderPort, newInstance } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { type PreviewRect, createUiStore } from "@seki/ui";
import { type PreviewHost, characterStats, playerAppearance } from "../src/character-view";
import { GameSession } from "../src/game-session";

const noRender: RenderPort = {
  spawn() {},
  updateTransform() {},
  despawn() {},
  clear() {},
  setCameraMode() {},
  attachCamera() {},
  playEffect() {},
  setAppearance() {},
};
const noAudio: AudioPort = { play() {}, stopAll() {} };

/** Records what reaches the preview, as the engine's PreviewStage would get it. */
class FakePreview implements PreviewHost {
  rect: PreviewRect | null = null;
  rects: (PreviewRect | null)[] = [];
  looks: AppearanceDescriptor[] = [];
  yaw = 0;
  resets = 0;
  setViewport(rect: PreviewRect | null) {
    this.rect = rect;
    this.rects.push(rect);
  }
  setAppearance(a: AppearanceDescriptor) {
    if (this.looks.at(-1) !== a) this.looks.push(a);
  }
  rotate(d: number) {
    this.yaw += d;
  }
  reset() {
    this.resets += 1;
  }
  get look() {
    return this.looks.at(-1) ?? null;
  }
}

const RECT: PreviewRect = { x: 10, y: 52, width: 180, height: 260 };

/** A running game whose bag holds a looted SMG ("i4"), loaded through a save. */
const setup = async () => {
  const ui = createUiStore();
  const preview = new FakePreview();
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({ render: noRender, audio: noAudio, persistence, ui, preview, story: STORY_SOURCE, seed: () => 71, now: () => new Date(2026, 9, 27, 22, 0) });
  session.newGame();
  const snap = session.snapshot();
  const d = snap.domain;
  await persistence.save("t", { ...snap, domain: { ...d, inventory: { ...d.inventory, items: [...d.inventory.items, newInstance("i4", "hebi_smg", "uncommon")], nextUid: 5 } } });
  await session.loadAsync("t");
  session.render(0);
  return { session, ui, preview };
};

describe("character menu in the app (plan §8.5 contract)", () => {
  it("hands the preview its rectangle and the look when the menu opens, and takes them away on close", async () => {
    const { session, ui, preview } = await setup();
    // The box measures itself before the screen reports that it opened (React effect order).
    session.intents.setPreviewViewport(RECT);
    expect(preview.rect).toBeNull();
    session.intents.openCharacterScreen("inventory");
    expect(preview.rect).toEqual(RECT);
    expect(preview.look?.weapons).toEqual({ primary: null, secondary: "pistol", melee: null, active: "secondary" });
    expect(preview.look?.garments).toEqual({ torso: { tint: "jacket-seki" }, legs: { tint: "cargo" } });
    expect(ui.getState()).toMatchObject({ characterTab: "inventory", prompt: null });
    expect(session.characterScreenOpen).toBe(true);

    session.intents.rotatePreview(0.4);
    session.intents.resetPreview();
    expect(preview).toMatchObject({ yaw: 0.4, resets: 1 });

    session.intents.closeCharacterScreen();
    expect(preview.rect).toBeNull();
    expect(ui.getState().characterTab).toBeNull();
    expect(session.characterScreenOpen).toBe(false);
    // While closed a stray rectangle does not show the preview.
    session.intents.setPreviewViewport(RECT);
    expect(preview.rect).toBeNull();
  });

  it("stops the clock while open; an equip applies at once and reaches the preview in the same frame", async () => {
    const { session, ui, preview } = await setup();
    session.intents.openCharacterScreen("inventory");
    const tick = session.sim.tick;
    session.step({ ...EMPTY_INPUT, moveZ: 1 });
    expect(session.sim.tick).toBe(tick);
    expect(session.inControl).toBe(false);

    session.intents.equip("i4");
    expect(session.sim.tick).toBe(tick);
    expect(session.sim.domain.equipment.primary).toBe("i4");
    expect(ui.getState().equipment.primary).toBe("i4");
    expect(preview.look?.weapons.primary).toBe("smg");
    const looks = preview.looks.length;
    session.render(0);
    // Unchanged look: the same descriptor, nothing new for the preview.
    expect(preview.looks).toHaveLength(looks);

    session.intents.unequip("primary");
    expect(preview.look?.weapons.primary).toBeNull();
    session.intents.useItem({ stack: "medkit" });
    session.intents.installMod("i4", "nope");
    session.intents.removeMod("i4", "sight");
    session.intents.dropItem({ uid: "i4" }, 1);
    expect(session.sim.domain.inventory.items.some((i) => i.uid === "i4")).toBe(false);
    expect(session.sim.domain.loot.containers).toHaveLength(1);

    session.intents.closeCharacterScreen();
    session.step(EMPTY_INPUT);
    expect(session.sim.tick).toBe(tick + 1);
  });

  it("ignores menu commands while the menu is shut", async () => {
    const { session } = await setup();
    session.intents.equip("i4");
    session.step(EMPTY_INPUT);
    expect(session.sim.domain.equipment.primary).toBeNull();
  });

  it("refuses to open over the clinic, and closes on death or a load", async () => {
    const { session, ui, preview } = await setup();
    ui.setState({ characterTab: "inventory" });
    (session as unknown as { c: { shop: { shopOpen: boolean } } }).c.shop.shopOpen = true;
    session.intents.openCharacterScreen("inventory");
    expect(ui.getState().characterTab).toBeNull();
    expect(session.characterScreenOpen).toBe(false);
    (session as unknown as { c: { shop: { shopOpen: boolean } } }).c.shop.shopOpen = false;

    session.intents.openCharacterScreen("sheet");
    session.intents.openCharacterScreen("journal");
    expect(ui.getState()).toMatchObject({ characterTab: "journal", journalOpen: true });
    session.intents.setPreviewViewport(RECT);
    await session.loadAsync("t");
    expect(session.characterScreenOpen).toBe(false);
    expect(preview.rect).toBeNull();

    session.intents.openCharacterScreen("inventory");
    session.sim.player()!.health = { current: 0, max: 100 };
    session.intents.closeCharacterScreen();
    session.intents.openCharacterScreen("inventory");
    (session as unknown as { view: { set(s: string): void } }).view.set("dead");
    expect(ui.getState().characterTab).toBeNull();
    expect(session.characterScreenOpen).toBe(false);
  });
});

describe("stats and look for the menu", () => {
  it("counts armor per zone with clothes, crits and the standing aim cone of the weapon in hand", async () => {
    const { session } = await setup();
    const s = characterStats(session.sim.domain, 90, 100);
    // Starting optics: +4% crit chance and a 10% steadier hand.
    expect(s).toMatchObject({ hp: 90, maxHp: 100, critMultiplier: 1.8, moveSpeed: 4.2 });
    expect(s.critChance).toBeCloseTo(0.12);
    expect(s.armor).toEqual({ head: 2, torso: 3, arm: 3, leg: 3 });
    expect(s.spread).toBeCloseTo((0.02 * 0.9 * 180) / Math.PI);
    const melee = { ...session.sim.domain, equipment: { ...session.sim.domain.equipment, active: "melee" as const } };
    expect(characterStats(melee, 90, 100).spread).toBeNull();
  });

  it("shows visible implants in the look", async () => {
    const { session } = await setup();
    const d = session.sim.domain;
    const look = playerAppearance({ ...d, character: { ...d.character, cyberware: { optics: "hitomi_optics_mk1", arms: "steady_grip" } } });
    expect(look.implants).toEqual(["optics", "arms"]);
  });
});
