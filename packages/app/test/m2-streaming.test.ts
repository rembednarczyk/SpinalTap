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
import { ground, market } from "@seki/sim";
import { GameSession } from "../src/game-session";

/** The market floor under the viaduct (ADR-0045). */
const IN_MARKET = market(96, 0, 90);

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
  setAppearance() {}
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
  p.position = ground(x, z);
  p.prevPosition = p.position;
  s.step(EMPTY_INPUT);
  s.render(0);
};

const toastTitles = (ui: ReturnType<typeof createUiStore>) => ui.getState().toasts.map((t) => t.title);

describe("M2: districts without a reload", () => {
  it("streams the market in and the deptak out through the render port, naming each district once", () => {
    const { session, render, ui } = setup();
    session.newGame();
    const before = render.views.size;
    const fixer = session.sim.world.with("interactable").entities.find((e) => e.key === "fixer")!.id;

    // Through Brama Krakowska onto Bramowa (ADR-0045).
    goTo(session, 497, -79);
    expect(toastTitles(ui)).toContain("Stare Miasto");
    expect(render.views.size).toBeGreaterThan(before);

    // Plac Zamkowy, then the market floor under the viaduct.
    goTo(session, 717.5, 296);
    goTo(session, IN_MARKET.x, IN_MARKET.z);
    expect(toastTitles(ui)).toContain("Podzamcze");
    expect(render.views.has(fixer)).toBe(false);
    expect(render.unloaded).toContain(fixer);
    // A step inside the same district does not repeat the toast.
    goTo(session, IN_MARKET.x + 1, IN_MARKET.z);
    expect(toastTitles(ui).filter((t) => t === "Podzamcze")).toHaveLength(1);
  });

  it("a save in the market loads back into the market, through the real codec", async () => {
    const { session, ui } = setup();
    session.newGame();
    goTo(session, 717.5, 296);
    const stalls = market(92, 0, 70);
    goTo(session, stalls.x, stalls.z);
    expect(await session.saves.saveAsync("slot-1")).toBe(true);
    const saved = session.sim.player()!.position;

    session.newGame();
    expect(session.sim.district).toBe("shinsekai-7");
    expect(await session.saves.loadAsync("slot-1")).toBe(true);
    expect(session.sim.player()!.position).toEqual(saved);
    expect(session.sim.district).toBe("targ");
    expect(session.sim.streamer.loadedChunks).toEqual(["podzamcze-1-0"]);
    // Loading is not crossing a border: no district toast.
    expect(toastTitles(ui)).not.toContain("Podzamcze");
  });
});
