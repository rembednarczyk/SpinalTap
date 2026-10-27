import { describe, expect, it } from "vitest";
import { type AudioCue, type AudioPort, EMPTY_INPUT, type EffectDescriptor, type InputFrame, type RenderPort } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { SIM_DT } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";

class FakeRender implements RenderPort {
  effects: EffectDescriptor[] = [];
  spawn() {}
  updateTransform() {}
  despawn() {}
  clear() {}
  setCameraMode() {}
  attachCamera() {}
  playEffect(e: EffectDescriptor) {
    this.effects.push(e);
  }
  setAppearance() {}
}

class FakeAudio implements AudioPort {
  cues: AudioCue[] = [];
  play(c: AudioCue) {
    this.cues.push(c);
  }
  stopAll() {}
}

const setup = () => {
  const ui = createUiStore();
  const render = new FakeRender();
  const audio = new FakeAudio();
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({ render, audio, persistence, ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 9, 27, 22, 0) });
  session.newGame();
  return { session, ui, render, audio, persistence };
};

const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

const steps = (s: GameSession, n: number, input: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(input);
  s.render(0);
};

describe("HUD weapon strip from the game", () => {
  it("shows the starter pistol with 12 of 48 and follows shots and the reload", () => {
    const { session, ui, render } = setup();
    session.render(0);
    const first = ui.getState().weapons;
    expect(first).toMatchObject({ active: "secondary", loaded: 12, magazine: 12, reserve: 48, ammoName: "9 mm", reloading: false });
    expect(first?.slots.map((s) => s.name)).toEqual([null, "Unity-9", null]);
    steps(session, 1);
    // Nothing changed: the same object, so React does not re-render.
    expect(ui.getState().weapons).toBe(first);
    steps(session, Math.ceil(4 / SIM_DT), frame({ fire: true }));
    expect(ui.getState().weapons).toMatchObject({ loaded: 0, reloading: true });
    expect(render.effects).toContainEqual({ kind: "reload", entityId: session.sim.player()!.id, duration: 1.4 });
    steps(session, Math.ceil(1.5 / SIM_DT));
    expect(ui.getState().weapons).toMatchObject({ loaded: 12, reserve: 36, reloading: false });
  });

  it("marks the weapon holstered", () => {
    const { session, ui } = setup();
    steps(session, 1, frame({ toggleWeapon: true }));
    expect(ui.getState().weapons?.holstered).toBe(true);
  });
});
