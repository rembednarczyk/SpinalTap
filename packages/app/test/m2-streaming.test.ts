import { describe, expect, it } from "vitest";
import {
  type AudioPort,
  type CameraMode,
  type DespawnReason,
  EMPTY_INPUT,
  type EntityId,
  type RenderPort,
  type ViewDescriptor,
} from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";

class FakeRender implements RenderPort {
  readonly views = new Map<EntityId, ViewDescriptor>();
  readonly unloaded: EntityId[] = [];
  mode: CameraMode = "FPP";
  spawn(id: EntityId, v: ViewDescriptor) {
    this.views.set(id, v);
  }
  updateTransform() {}
  despawn(id: EntityId, reason?: DespawnReason) {
    this.views.delete(id);
    if (reason === "unloaded") this.unloaded.push(id);
  }
  clear() {
    this.views.clear();
  }
  setCameraMode(m: CameraMode) {
    this.mode = m;
  }
  attachCamera() {}
  playEffect() {}
}

const audio: AudioPort = { play() {}, stopAll() {} };

const setup = () => {
  const render = new FakeRender();
  const ui = createUiStore();
  const store = new MemorySaveStore();
  const session = new GameSession({
    render,
    audio,
    persistence: new SavePersistence(store),
    ui,
    story: STORY_SOURCE,
    seed: () => 77,
    now: () => new Date(2026, 9, 27, 21, 0),
  });
  return { session, render, ui, store };
};

const goTo = (s: GameSession, x: number, z: number) => {
  const p = s.sim.player()!;
  p.position = { x, y: 0, z };
  p.prevPosition = p.position;
  s.step(EMPTY_INPUT);
  s.render(0);
};

const toastTitles = (ui: ReturnType<typeof createUiStore>) => ui.getState().toasts.map((t) => t.title);

describe("M2: districts without a reload", () => {
  it("streams the market in and Shinsekai out through the render port, naming each district once", () => {
    const { session, render, ui } = setup();
    session.newGame();
    const before = render.views.size;
    const fixer = session.sim.world.with("interactable").entities.find((e) => e.key === "fixer")!.id;

    goTo(session, 7, 60);
    expect(toastTitles(ui)).toContain("Ulica Kanałowa");
    expect(render.views.size).toBeGreaterThan(before);

    goTo(session, 40, 78);
    goTo(session, 95, 78);
    expect(toastTitles(ui)).toContain("Targ pod estakadą");
    expect(render.views.has(fixer)).toBe(false);
    expect(render.unloaded).toContain(fixer);
    // A step inside the same district does not repeat the toast.
    goTo(session, 96, 78);
    expect(toastTitles(ui).filter((t) => t === "Targ pod estakadą")).toHaveLength(1);
  });

  it("a save in the market loads back into the market, through the real codec", async () => {
    const { session, ui } = setup();
    session.newGame();
    goTo(session, 40, 78);
    goTo(session, 92, 70);
    expect(await session.saveAsync("slot-1")).toBe(true);
    const saved = session.sim.player()!.position;

    session.newGame();
    expect(session.sim.district).toBe("shinsekai-7");
    expect(await session.loadAsync("slot-1")).toBe(true);
    expect(session.sim.player()!.position).toEqual(saved);
    expect(session.sim.district).toBe("targ");
    expect(session.sim.streamer.loadedChunks).toEqual(["kanal", "targ-south", "targ-north"]);
    // Loading is not crossing a border: no district toast.
    expect(toastTitles(ui)).not.toContain("Targ pod estakadą");
  });
});
