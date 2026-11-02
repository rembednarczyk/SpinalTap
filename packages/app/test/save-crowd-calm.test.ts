import { describe, expect, it } from "vitest";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { createUiStore } from "@seki/ui";
import { AUTOSAVE_SLOT } from "../src/controllers/autosave-controller";
import { GameSession } from "../src/game-session";
import { FakeRender, steps } from "./story-helpers";

/**
 * A save calms the street (G-240): the crowd's fear is not in the save and a loaded game starts
 * calm (ADR-0029), so the game saved from calms down with it, by every way to save (the slot,
 * quicksave, the autosave), and goes on as the loaded one.
 */

class CountingStore extends MemorySaveStore {
  readonly puts: string[] = [];
  override async put(slot: string, value: string) {
    this.puts.push(slot);
    await super.put(slot, value);
  }
}

/** An autosave every few steps of play, so one falls in the street's fright. */
const INTERVAL = 5;

const start = (store = new CountingStore()) => {
  const session = new GameSession({
    render: new FakeRender(),
    audio: { play() {}, stopAll() {} },
    persistence: new SavePersistence(store),
    ui: createUiStore(),
    story: STORY_SOURCE,
    seed: () => 77,
    now: () => new Date(2026, 10, 2),
    autosaveIntervalTicks: INTERVAL,
  });
  session.newGame();
  steps(session, 2);
  return session;
};

const frighten = (session: GameSession): number => {
  const civilians = session.sim.world.with("civilian").entities;
  expect(civilians.length).toBeGreaterThan(0);
  for (const c of civilians) c.civilian.crowd = { state: "fleeing", timer: 6, from: c.position, call: null, scared: 0 };
  return civilians.length;
};

const afraid = (session: GameSession) => session.sim.world.with("civilian").entities.filter((c) => c.civilian.crowd).length;

describe("a save calms the street (G-240)", () => {
  it("the slot save: nobody runs on in the game saved from", async () => {
    const session = start();
    frighten(session);
    expect(await session.saves.saveAsync("quick")).toBe(true);
    expect(afraid(session)).toBe(0);
  });

  it("the autosave too", async () => {
    const store = new CountingStore();
    const session = start(store);
    const before = store.puts.length;
    frighten(session);
    steps(session, INTERVAL + 1);
    await new Promise((r) => setTimeout(r, 0));
    expect(store.puts.slice(before)).toContain(AUTOSAVE_SLOT);
    expect(afraid(session)).toBe(0);
  });
});
