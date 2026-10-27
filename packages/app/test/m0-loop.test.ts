import { describe, expect, it } from "vitest";
import {
  type AudioCue,
  type AudioPort,
  type CameraMode,
  EMPTY_INPUT,
  type EffectDescriptor,
  type EntityId,
  type InputFrame,
  M0_TARGET_TAG,
  type RenderPort,
  type Transform,
  type ViewDescriptor,
  killedFlag,
} from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";

class FakeRender implements RenderPort {
  readonly views = new Map<EntityId, ViewDescriptor>();
  mode: CameraMode = "FPP";
  effects: EffectDescriptor["kind"][] = [];
  spawn(id: EntityId, v: ViewDescriptor, _t: Transform) { this.views.set(id, v); }
  updateTransform() {}
  despawn(id: EntityId) { this.views.delete(id); }
  clear() { this.views.clear(); }
  setCameraMode(m: CameraMode) { this.mode = m; }
  attachCamera() {}
  playEffect(e: EffectDescriptor) { this.effects.push(e.kind); }
}

class FakeAudio implements AudioPort {
  cues: AudioCue[] = [];
  play(c: AudioCue) { this.cues.push(c); }
  stopAll() {}
}

const setup = () => {
  const render = new FakeRender();
  const audio = new FakeAudio();
  const ui = createUiStore();
  const store = new MemorySaveStore();
  const session = new GameSession({
    render,
    audio,
    persistence: new SavePersistence(store),
    ui,
    story: STORY_SOURCE,
    seed: () => 2024,
    now: () => new Date(2026, 9, 26, 22, 30),
  });
  return { session, render, audio, ui, store };
};

const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

const steps = (s: GameSession, n: number, input: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(input);
  s.render(0);
};

const teleport = (s: GameSession, x: number, z: number, yaw = 0, pitch = 0) => {
  const p = s.sim.player()!;
  p.position = { x, y: 0, z };
  p.prevPosition = p.position;
  p.yaw = yaw;
  p.pitch = pitch;
};

/** Walks the dialogue to its end, always taking the first choice. */
const talkThrough = (s: GameSession, ui: ReturnType<typeof createUiStore>) => {
  for (let guard = 0; guard < 10 && !ui.getState().dialogue?.ended; guard++) s.choose(0);
  expect(ui.getState().dialogue?.ended).toBe(true);
  s.closeDialogue();
};

describe("M0 vertical slice: input → sim → narrative → domain → save → load", () => {
  it("plays the first contract end to end and survives a save/load round trip", async () => {
    const { session, render, audio, ui } = setup();
    expect(ui.getState().screen).toBe("title");
    session.newGame();
    expect(ui.getState().screen).toBe("playing");
    expect(render.views.size).toBeGreaterThan(30);

    // Walk forward a bit and switch to TPP.
    steps(session, 30, frame({ moveZ: 1 }));
    steps(session, 1, frame({ toggleCamera: true }));
    expect(render.mode).toBe("TPP");

    // 1. Talk to Kaito.
    teleport(session, 4.6, 1.5, Math.PI / 2);
    steps(session, 1);
    expect(ui.getState().prompt).toBe("Rozmawiaj z Kaito");
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().dialogue?.lines[0]?.speaker).toBe("Kaito");
    talkThrough(session, ui);
    steps(session, 1);
    expect(session.sim.domain.character.alias).toBe("Seki Senshi");
    expect(ui.getState().objective).toContain("kuriera Hebi");

    // 2. Fight in the alley until the courier is down.
    const courier = () => [...session.sim.world].find((e) => e.key === "courier");
    for (let i = 0; i < 900 && courier(); i++) {
      const c = courier()!;
      // TPP: shots leave from the shoulder line, 0.55 m to the right of the eye.
      teleport(session, c.position.x - 0.55, c.position.z - 5, 0, 0.12);
      session.step(frame({ fire: true }));
    }
    steps(session, 1);
    expect(courier()).toBeUndefined();
    expect(session.sim.domain.flags).toContain(killedFlag(M0_TARGET_TAG));
    expect(session.sim.domain.character.memories).toContain("combat_reflex");
    expect(render.effects).toContain("memory-glitch");
    expect(audio.cues).toContain("memory");
    expect(ui.getState().screen).toBe("playing");

    // 3. Report back and get paid.
    teleport(session, 4.6, 1.5, Math.PI / 2);
    steps(session, 1, frame({ interact: true }));
    talkThrough(session, ui);
    steps(session, 1);
    expect(session.sim.domain.quests.m0_first_contract).toEqual({ status: "completed" });
    expect(session.sim.domain.wallet.eddies).toBeGreaterThan(600);
    expect(session.sim.domain.reputation.hebi).toBe(-15);

    // 4. Save, keep playing, load: state matches the save point, narrative included.
    expect(await session.saveAsync("slot-1")).toBe(true);
    const saved = session.snapshot();
    expect(ui.getState().slots[0]).toMatchObject({ slot: "slot-1", objective: expect.stringContaining("Kaito ma kolejne kontrakty") });
    steps(session, 120, frame({ moveZ: -1 }));
    expect(await session.loadAsync("slot-1")).toBe(true);
    expect(session.snapshot().domain).toEqual(saved.domain);
    expect(session.snapshot().entities).toEqual(saved.entities);
    expect(session.narrative.saveState()).toBe(saved.narrative);
    expect(render.mode).toBe("TPP");
    expect(courier()).toBeUndefined();

    // After the first contract Kaito moves on to repeatable jobs.
    teleport(session, 4.6, 1.5, Math.PI / 2);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().dialogue?.choices[0]?.text).toBe("Biorę robotę.");
  });

  it("refuses to save mid-dialogue and reports corrupt or empty slots", async () => {
    const { session, ui, store } = setup();
    session.newGame();
    teleport(session, 4.6, 1.5, Math.PI / 2);
    steps(session, 1, frame({ interact: true }));
    expect(await session.saveAsync("slot-1")).toBe(false);
    session.closeDialogue();
    expect(await session.loadAsync("slot-2")).toBe(false);
    await store.put("slot-3", "{corrupt");
    expect(await session.loadAsync("slot-3")).toBe(false);
    expect(ui.getState().toasts.at(-1)?.text).toBe("Plik zapisu jest uszkodzony.");
  });

  it("goes to the death screen when the player flatlines, and pause blocks the sim", () => {
    const { session, ui } = setup();
    session.newGame();
    session.pause();
    expect(ui.getState().screen).toBe("paused");
    const tick = session.sim.tick;
    steps(session, 10);
    expect(session.sim.tick).toBe(tick);
    session.resume();
    session.sim.player()!.health = { current: 0, max: 100 };
    steps(session, 1);
    expect(ui.getState().screen).toBe("dead");
    session.quitToTitle();
    expect(ui.getState().screen).toBe("title");
  });
});
