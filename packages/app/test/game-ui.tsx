import { act, cleanup, render as mount } from "@testing-library/react";
import {
  type AppearanceDescriptor,
  type AudioCue,
  type AudioPort,
  type EffectDescriptor,
  type EntityId,
  type InputFrame,
  type RenderPort,
  type Transform,
} from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { FixedStepLoop } from "@seki/sim";
import { GameUi, type PreviewRect, type TouchPadSink, createUiStore } from "@seki/ui";
import type { PreviewHost } from "../src/character-view";
import { type DebugApi, createDebugApi } from "../src/debug-api";
import { GameSession } from "../src/game-session";

/**
 * The game page without a renderer (ADR-0046): the real React UI on the session's store, with
 * the session as its intents, a fake render port and the debug API the e2e specs used. The
 * simulation runs only when a test steps it; no clock, no browser loop.
 */

/** Records what the session hands the renderer: the player's transform and the effects. */
export class FakeRender implements RenderPort {
  readonly effects: EffectDescriptor[] = [];
  readonly transforms = new Map<EntityId, Transform>();
  spawn() {}
  updateTransform(id: EntityId, t: Transform) {
    this.transforms.set(id, t);
  }
  despawn() {}
  clear() {}
  setCameraMode() {}
  attachCamera() {}
  playEffect(e: EffectDescriptor) {
    this.effects.push(e);
  }
  setAppearance() {}
}

export class FakeAudio implements AudioPort {
  readonly cues: AudioCue[] = [];
  play(c: AudioCue) {
    this.cues.push(c);
  }
  stopAll() {}
}

/** What reaches the character menu's 3D preview, as the engine's PreviewStage gets it. */
export class FakePreview implements PreviewHost {
  rect: PreviewRect | null = null;
  look: AppearanceDescriptor | null = null;
  yaw = 0;
  setViewport(rect: PreviewRect | null) {
    this.rect = rect;
  }
  setAppearance(a: AppearanceDescriptor) {
    this.look = a;
  }
  rotate(d: number) {
    this.yaw += d;
  }
  reset() {
    this.yaw = 0;
  }
}

export interface GameOptions {
  readonly seed: number;
  /** The on-screen pad of a phone; the session then uses touch words too. */
  readonly touch?: boolean;
}

export const touchPad = (): TouchPadSink => ({ setStick() {}, look() {}, press() {}, release() {}, reset() {}, selectWeaponSlot() {} });

/** Mounts the title screen of a game with the given seed. Call `cleanup` (or `unmountGame`) after each test. */
export const mountGame = ({ seed, touch = false }: GameOptions) => {
  const ui = createUiStore();
  const render = new FakeRender();
  const audio = new FakeAudio();
  const preview = new FakePreview();
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({ render, audio, persistence, ui, preview, story: STORY_SOURCE, seed: () => seed, now: () => new Date(2026, 9, 27, 21, 0), touch });
  // Never ticks: the clock stands still and nothing calls frame(); the test steps the session.
  const loop = new FixedStepLoop({ now: () => 0 }, { update() {}, render() {} });
  const seki: DebugApi = createDebugApi(session, ui, loop, () => ({ fps: 0, frameTimeMs: 0, drawCalls: 0, activeMeshes: 0, totalMeshes: 0, materials: 0, particles: 0, byName: {} }), () => {});
  const view = mount(<GameUi store={ui} intents={session} touch={touch ? touchPad() : undefined} />);
  /** Steps the simulation as the debug API does, inside act() so React applies the store changes. */
  const step = (n: number, input: Partial<InputFrame> = {}) => act(() => seki.step(n, input));
  return { ui, render, audio, preview, persistence, session, seki, view, step };
};

export type Game = ReturnType<typeof mountGame>;

/** Runs a session or debug call that changes the store, inside act(). */
export const run = <T,>(f: () => T): T => {
  let out: T | undefined;
  act(() => {
    out = f();
  });
  return out as T;
};

export const unmountGame = cleanup;
