import { describe, expect, it } from "vitest";
import { type AudioCue, type DomainEvents, EMPTY_INPUT, type EffectDescriptor, EventBus, type RenderPort, WEAPON_CATALOG } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { SIM_DT } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { bindEventPresenter } from "../src/event-presenter";
import { GameSession } from "../src/game-session";

const PLAYER = 1;
const NPC = 7;

const recorder = () => {
  const effects: EffectDescriptor[] = [];
  const render: RenderPort = {
    spawn() {},
    updateTransform() {},
    despawn() {},
    clear() {},
    setCameraMode() {},
    attachCamera() {},
    playEffect: (e) => effects.push(e),
    setAppearance() {},
  };
  return { render, effects };
};

describe("melee presentation (ADR-0019)", () => {
  const setup = () => {
    const bus = new EventBus<DomainEvents>();
    const cues: AudioCue[] = [];
    const { render, effects } = recorder();
    bindEventPresenter(bus, render, { play: (c) => cues.push(c), stopAll() {} }, createUiStore(), {
      playerId: () => PLAYER,
      onDialogue() {},
      onShop() {},
      onLoot() {},
      onPlayerDied() {},
      onDialogueInterrupted() {},
    });
    return { bus, cues, effects };
  };

  it("plays the swing on the rig, the whoosh as it lands, the guard and the stagger", () => {
    const { bus, cues, effects } = setup();
    bus.emit("MeleeSwing", { entityId: NPC, strike: 1, windup: 0.5, recovery: 0.3 });
    bus.emit("MeleeStrike", { entityId: NPC, strike: 1, hits: 1 });
    bus.emit("AttackBlocked", { attackerId: NPC, defenderId: PLAYER, parried: false, kind: "melee", at: { x: 0, y: 1.25, z: 0 } });
    bus.emit("AttackBlocked", { attackerId: NPC, defenderId: PLAYER, parried: true, kind: "melee", at: { x: 0, y: 1.25, z: 0 } });
    bus.emit("Staggered", { entityId: NPC, duration: 1.2, cause: "parry" });
    expect(effects).toEqual([
      { kind: "melee", entityId: NPC, strike: 1, windup: 0.5, recovery: 0.3 },
      { kind: "block", entityId: PLAYER, parried: false, at: { x: 0, y: 1.25, z: 0 } },
      { kind: "block", entityId: PLAYER, parried: true, at: { x: 0, y: 1.25, z: 0 } },
      { kind: "stagger", entityId: NPC, duration: 1.2 },
    ]);
    expect(cues).toEqual(["swing", "block", "parry"]);
  });
});

describe("aim down sights in the HUD (ADR-0019)", () => {
  it("reports aiming and the zoom, and the crosshair narrows", () => {
    const ui = createUiStore();
    const session = new GameSession({
      render: recorder().render,
      audio: { play() {}, stopAll() {} },
      persistence: new SavePersistence(new MemorySaveStore()),
      ui,
      story: STORY_SOURCE,
      seed: () => 2024,
      now: () => new Date(2026, 9, 27, 21, 0),
    });
    session.newGame();
    session.step(EMPTY_INPUT);
    session.render(0);
    const hip = ui.getState().aimSpread;
    const ads = WEAPON_CATALOG.unity9.ads;
    for (let i = 0; i < Math.ceil(ads.time / SIM_DT) + 1; i++) session.step({ ...EMPTY_INPUT, aim: true });
    session.render(0);
    expect(ui.getState()).toMatchObject({ aiming: true, aimZoom: ads.zoom, blocking: false });
    expect(ui.getState().aimSpread).toBeLessThan(hip * 0.6);
    for (let i = 0; i < Math.ceil(ads.time / SIM_DT) + 1; i++) session.step(EMPTY_INPUT);
    session.render(0);
    expect(ui.getState()).toMatchObject({ aiming: false, aimZoom: 1 });
  });
});
