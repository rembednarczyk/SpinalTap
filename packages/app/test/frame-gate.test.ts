import { describe, expect, it } from "vitest";
import { type AudioPort, EMPTY_INPUT, type EntityId, type PrepareStage, type RenderPort, type Vec3 } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { FixedStepLoop } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { createDebugApi } from "../src/debug-api";
import { FrameGate } from "../src/frame-gate";
import { GameSession } from "../src/game-session";

/** Frames on demand in a frozen test (G-226, ADR-0046), headless: a fake renderer and a hand-driven animation frame. */

class BareRender implements RenderPort {
  readonly ids = new Set<EntityId>();
  spawn(id: EntityId) { this.ids.add(id); }
  updateTransform() {}
  despawn(id: EntityId) { this.ids.delete(id); }
  clear() { this.ids.clear(); }
  setCameraMode() {}
  attachCamera() {}
  playEffect() {}
  setAppearance() {}
}

/** A renderer whose start preparation the test finishes by hand (the loading screen, ADR-0057). */
class PreparingRender extends BareRender {
  finish: () => void = () => {};
  prepare(_at: Vec3, _progress: (done: number, stage: PrepareStage) => void): Promise<void> {
    return new Promise((resolve) => (this.finish = resolve));
  }
}

const silent: AudioPort = { play() {}, stopAll() {} };

const perfSample = () => ({ fps: 0, frameTimeMs: 0, drawCalls: 0, activeMeshes: 0, activeTriangles: 0, totalMeshes: 0, materials: 0, particles: 0, byName: {} });

const setup = (render: RenderPort = new BareRender()) => {
  const ui = createUiStore();
  const session = new GameSession({ render, audio: silent, persistence: new SavePersistence(new MemorySaveStore()), ui, story: STORY_SOURCE, seed: () => 2024, now: () => new Date(2026, 10, 2, 20, 0), scenery: false });
  let now = 0;
  let rendered = 0;
  const loop = new FixedStepLoop({ now: () => now }, { update: () => session.step(EMPTY_INPUT), render: () => rendered++ });
  const gate = new FrameGate();
  const debug = createDebugApi(session, ui, loop, perfSample, () => {}, undefined, undefined, undefined, undefined, undefined, gate);
  /** One animation frame as `main.tsx` runs it: the gate first, then the loop; `draws` says whether the pacer let the frame draw. */
  const animationFrame = (draws = true) => {
    now += 1000 / 60;
    if (!gate.runs(session)) return;
    loop.frame();
    if (draws) gate.frameDrawn();
  };
  return { session, debug, gate, animationFrame, rendered: () => rendered };
};

describe("frames on demand in a frozen test (G-226)", () => {
  it("draws every frame unless a test freezes on demand", () => {
    const { session, debug, gate, animationFrame, rendered } = setup();
    session.newGame();
    for (let i = 0; i < 3; i++) animationFrame();
    expect(rendered()).toBe(3);
    // A plain freeze (the other specs) keeps drawing: their screenshots and models need it.
    debug.setPaused(true);
    for (let i = 0; i < 3; i++) animationFrame();
    expect(rendered()).toBe(6);
    expect(gate.drawn).toBe(6);
  });

  it("frozen on demand, draws only the frames asked for, and a skipped draw stays owed", () => {
    const { session, debug, gate, animationFrame, rendered } = setup();
    session.newGame();
    debug.setPaused(true, true);
    const tick = session.sim.tick;
    for (let i = 0; i < 10; i++) animationFrame();
    expect(rendered()).toBe(0);
    const target = debug.draw(2);
    expect(target).toBe(gate.drawn + 2);
    // The pacer holds the first animation frame back (G-029): it updates the scene, draws nothing.
    animationFrame(false);
    expect(gate.drawn).toBe(0);
    for (let i = 0; i < 10; i++) animationFrame();
    expect(gate.drawn).toBe(target);
    expect(rendered()).toBe(3);
    // Frozen: the frames moved no simulation, only a step does.
    expect(session.sim.tick).toBe(tick);
    debug.step(1);
    expect(session.sim.tick).toBe(tick + 1);
    for (let i = 0; i < 5; i++) animationFrame();
    expect(rendered()).toBe(3);
  });

  it("resuming draws every frame again and forgets frames owed", () => {
    const { session, debug, gate, animationFrame, rendered } = setup();
    session.newGame();
    debug.setPaused(true, true);
    debug.draw(5);
    debug.setPaused(false);
    expect(gate.holding).toBe(false);
    debug.setPaused(true, true);
    animationFrame();
    expect(rendered()).toBe(0);
  });

  it("keeps the loading screen running while held: its frames prepare the start (F9, ADR-0057)", async () => {
    const render = new PreparingRender();
    const { session, debug, animationFrame, rendered } = setup(render);
    session.newGame();
    render.finish();
    await new Promise((r) => setTimeout(r, 0));
    expect(session.screen).toBe("playing");
    debug.setPaused(true, true);
    animationFrame();
    expect(rendered()).toBe(0);
    // A quickload goes behind the loading screen: the loop runs until the game is on screen again.
    session.restore(session.saves.snapshot());
    expect(session.preparing).toBe(true);
    for (let i = 0; i < 4; i++) animationFrame();
    expect(rendered()).toBe(4);
    render.finish();
    await new Promise((r) => setTimeout(r, 0));
    expect(session.screen).toBe("playing");
    animationFrame();
    expect(rendered()).toBe(4);
  });
});
