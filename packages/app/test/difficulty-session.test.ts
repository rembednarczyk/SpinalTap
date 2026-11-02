import { describe, expect, it } from "vitest";
import { type AudioPort, DIFFICULTY_PRESETS, EMPTY_INPUT, NORMAL_DIFFICULTY, type RenderPort } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { gangerEntity } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";

/** The difficulty of ADR-0066, stage 2, headless: the new game's choice, the pause menu and the slot label. */

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
const silent: AudioPort = { play() {}, stopAll() {} };

const setup = (store = new MemorySaveStore()) => {
  const ui = createUiStore();
  const session = new GameSession({ render, audio: silent, persistence: new SavePersistence(store), ui, story: STORY_SOURCE, seed: () => 2024, now: () => new Date(2026, 10, 1, 20, 0), scenery: false });
  return { session, ui, store };
};

const { story, hard } = DIFFICULTY_PRESETS;

/** An alerted Tessen guard five metres from the player: a fight is on. */
const startFight = (session: GameSession) => {
  const p = session.sim.player()!.position;
  const g = gangerEntity(90010, { key: "test-guard", position: { ...p, x: p.x - 5 }, yaw: 0 }, null, 1e6, "test", undefined, "tessen_guard");
  g.ai!.alerted = true;
  session.sim.world.add(g);
  return g;
};

describe("difficulty in the session (ADR-0066)", () => {
  it("a new game chosen on Hard plays on the Hard profile; without a choice on Normal", () => {
    const { session, ui } = setup();
    session.intents.newGame(hard);
    expect(session.screen).toBe("playing");
    expect(session.sim.domain.difficulty).toEqual(hard);
    expect(ui.getState().difficulty).toEqual({ profile: hard, pending: null });
    session.intents.newGame();
    expect(session.sim.domain.difficulty).toEqual(NORMAL_DIFFICULTY);
    expect(ui.getState().difficulty.profile).toEqual(NORMAL_DIFFICULTY);
  });

  it("in the pause outside a fight a change is in force at once, the clock standing", () => {
    const { session, ui } = setup();
    session.newGame();
    session.pause();
    const tick = session.sim.tick;
    session.intents.setDifficulty(story);
    expect(session.sim.domain.difficulty).toEqual(story);
    expect(session.sim.tick).toBe(tick);
    expect(ui.getState().difficulty).toEqual({ profile: story, pending: null });
    session.resume();
    session.step(EMPTY_INPUT);
    expect(session.sim.domain.difficulty).toEqual(story);
  });

  it("in a fight it waits for the fight's end, and the pause menu says so", () => {
    const { session, ui } = setup();
    session.newGame();
    const guard = startFight(session);
    session.pause();
    session.intents.setDifficulty(hard);
    expect(session.sim.domain.difficulty).toEqual(NORMAL_DIFFICULTY);
    expect(ui.getState().difficulty).toEqual({ profile: NORMAL_DIFFICULTY, pending: hard });
    session.resume();
    session.step(EMPTY_INPUT);
    expect(session.sim.domain.difficulty).toEqual(NORMAL_DIFFICULTY);
    // The guard goes: the fight is over and the profile takes effect in the next step.
    session.sim.world.remove(guard);
    session.step(EMPTY_INPUT);
    expect(session.sim.domain.difficulty).toEqual(hard);
    session.pause();
    expect(ui.getState().difficulty).toEqual({ profile: hard, pending: null });
  });

  it("asking back for the profile in force in a fight is no waiting change", () => {
    const { session, ui } = setup();
    session.newGame();
    startFight(session);
    session.pause();
    session.intents.setDifficulty(hard);
    session.intents.setDifficulty(NORMAL_DIFFICULTY);
    expect(ui.getState().difficulty.pending).toBeNull();
  });

  it("a saved slot carries the label of its preset, also for a session that did not write it", async () => {
    const { session, ui, store } = setup();
    session.newGame(hard);
    expect(await session.saves.saveAsync("slot-1")).toBe(true);
    session.pause();
    session.intents.setDifficulty({ ...story, npcHealth: 1.1 });
    expect(await session.saves.saveAsync("slot-2")).toBe(true);
    const label = (u: typeof ui) => Object.fromEntries(u.getState().slots.map((s) => [s.slot, s.difficulty]));
    expect(label(ui)).toEqual({ "slot-1": "hard", "slot-2": "custom" });
    // A fresh page over the same store reads the slots it has not written.
    const other = setup(store);
    await other.session.saves.refreshSlots();
    expect(label(other.ui)).toEqual({ "slot-1": "hard", "slot-2": "custom" });
    // A load restores the profile and the pause menu shows it.
    expect(await other.session.saves.loadAsync("slot-1")).toBe(true);
    expect(other.session.sim.domain.difficulty).toEqual(hard);
    expect(other.ui.getState().difficulty.profile).toEqual(hard);
  });

  it("an unreadable slot has no label", async () => {
    const { session, ui, store } = setup();
    store.data.set("slot-3", "{broken");
    await session.saves.refreshSlots();
    expect(ui.getState().slots).toEqual([{ slot: "slot-3", savedAtLabel: "—", objective: "save.corrupt" }]);
  });
});
