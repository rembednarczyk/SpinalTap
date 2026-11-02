import { describe, expect, it } from "vitest";
import {
  type AudioPort,
  EMPTY_INPUT,
  type EntityId,
  type PrepareStage,
  type RenderPort,
  type Vec3,
} from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";

/** The loading screen of ADR-0057, headless: a fake renderer whose `prepare` the test drives. */

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

interface PrepareCall {
  readonly at: Vec3;
  readonly progress: (done: number, stage: PrepareStage) => void;
  resolve(): void;
  reject(err: unknown): void;
}

class PreparingRender extends BareRender {
  readonly calls: PrepareCall[] = [];
  cancelled = 0;
  cancelPrepare() { this.cancelled++; }
  prepare(at: Vec3, progress: (done: number, stage: PrepareStage) => void): Promise<void> {
    return new Promise((resolve, reject) => this.calls.push({ at, progress, resolve, reject }));
  }
}

const silent: AudioPort = { play() {}, stopAll() {} };

const setup = (render: RenderPort) => {
  const ui = createUiStore();
  const session = new GameSession({ render, audio: silent, persistence: new SavePersistence(new MemorySaveStore()), ui, story: STORY_SOURCE, seed: () => 2024, now: () => new Date(2026, 9, 31, 20, 0), scenery: false });
  return { session, ui };
};

/** Lets the promise callbacks of a settled prepare run. */
const settle = () => new Promise((r) => setTimeout(r, 0));

const intro = (ui: ReturnType<typeof createUiStore>) => ui.getState().toasts.filter((t) => t.title === "Krakowskie Przedmieście").length;

describe("loading screen (ADR-0057)", () => {
  it("starts at once with a renderer that prepares nothing", () => {
    const { session, ui } = setup(new BareRender());
    session.newGame();
    expect(session.screen).toBe("playing");
    expect(session.preparing).toBe(false);
    expect(intro(ui)).toBe(1);
    const tick = session.sim.tick;
    session.step(EMPTY_INPUT);
    expect(session.sim.tick).toBe(tick + 1);
  });

  it("holds a new game behind the loading screen, frozen, until every stage is over", async () => {
    const render = new PreparingRender();
    const { session, ui } = setup(render);
    session.newGame();
    expect(session.screen).toBe("loading");
    expect(render.calls).toHaveLength(1);
    const call = render.calls[0]!;
    expect(call.at).toEqual(session.sim.player()!.position);
    expect(ui.getState().loading).toEqual({ progress: 0, stage: "models" });
    // The simulation stands: no tick, and no intro toast before the game is on screen.
    const tick = session.sim.tick;
    for (let i = 0; i < 30; i++) session.step({ ...EMPTY_INPUT, moveZ: 1 });
    expect(session.sim.tick).toBe(tick);
    expect(intro(ui)).toBe(0);
    // The bar never goes back, nor does the stage.
    call.progress(0.5, "city");
    expect(ui.getState().loading).toEqual({ progress: 0.5, stage: "city" });
    call.progress(0.2, "models");
    expect(ui.getState().loading).toEqual({ progress: 0.5, stage: "city" });
    call.progress(Number.NaN, "shaders");
    expect(ui.getState().loading).toEqual({ progress: 0.5, stage: "shaders" });
    call.progress(3, "shaders");
    expect(ui.getState().loading.progress).toBe(1);
    expect(session.screen).toBe("loading");
    call.resolve();
    await settle();
    expect(session.screen).toBe("playing");
    expect(session.preparing).toBe(false);
    expect(intro(ui)).toBe(1);
    session.step(EMPTY_INPUT);
    expect(session.sim.tick).toBe(tick + 1);
  });

  it("starts the game even when preparing fails (the procedural look stays)", async () => {
    const render = new PreparingRender();
    const { session } = setup(render);
    session.newGame();
    render.calls[0]!.reject(new Error("model 404"));
    await settle();
    expect(session.screen).toBe("playing");
  });

  it("loads a save through the loading screen too", async () => {
    const render = new PreparingRender();
    const { session } = setup(render);
    session.newGame();
    render.calls[0]!.resolve();
    await settle();
    expect(await session.saves.saveAsync("slot-1")).toBe(true);
    const saved = session.saves.snapshot();
    expect(await session.saves.loadAsync("slot-1")).toBe(true);
    expect(session.screen).toBe("loading");
    expect(render.calls).toHaveLength(2);
    expect(render.calls[1]!.at).toEqual(session.sim.player()!.position);
    // No saving from behind the loading screen.
    expect(await session.saves.saveAsync("slot-2")).toBe(false);
    render.calls[1]!.resolve();
    await settle();
    expect(session.screen).toBe("playing");
    expect(session.saves.snapshot().domain).toEqual(saved.domain);
  });

  it("a newer start voids the one still loading, and so does going back to the title", async () => {
    const render = new PreparingRender();
    const { session, ui } = setup(render);
    session.newGame();
    session.newGame();
    expect(render.calls).toHaveLength(2);
    render.calls[1]!.progress(0.4, "cityKit");
    // The old start's late reports and its end change nothing.
    render.calls[0]!.progress(0.9, "shaders");
    render.calls[0]!.resolve();
    await settle();
    expect(session.screen).toBe("loading");
    expect(ui.getState().loading).toEqual({ progress: 0.4, stage: "cityKit" });
    render.calls[1]!.resolve();
    await settle();
    expect(session.screen).toBe("playing");
    expect(intro(ui)).toBe(1);

    expect(render.cancelled).toBe(0);
    session.newGame();
    session.quitToTitle();
    // The renderer stops its warm-up frames under the title.
    expect(render.cancelled).toBe(1);
    render.calls[2]!.resolve();
    await settle();
    expect(session.screen).toBe("title");
    expect(ui.getState().loading).toEqual({ progress: 0, stage: null });
  });
});
