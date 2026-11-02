import { describe, expect, it } from "vitest";
import type { DomainEvents } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { SIM_HZ, Simulation, stateHash } from "@seki/sim";
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

const start = (store = new CountingStore(), interval = true) => {
  const session = new GameSession({
    render: new FakeRender(),
    audio: { play() {}, stopAll() {} },
    persistence: new SavePersistence(store),
    ui: createUiStore(),
    story: STORY_SOURCE,
    seed: () => 77,
    now: () => new Date(2026, 10, 2),
    ...(interval ? { autosaveIntervalTicks: INTERVAL } : {}),
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

  /**
   * A bystander that saw a knockout phones the security (5 s). A knockout deals no damage, so an
   * autosave (a door, a district, a quest step) finds the moment safe straight after it.
   */
  const outcome = async (save: "none" | "autosave" | "quick") => {
    const store = new CountingStore();
    const s = start(store, false);
    const reports: DomainEvents["CrimeReported"][] = [];
    s.bus.on("CrimeReported", (e) => reports.push(e));
    const c = s.sim.world.with("civilian").entities.find((e) => !e.passerby)!;
    c.civilian.crowd = { state: "fleeing", timer: 8, from: c.position, call: { crime: "assault", at: { ...c.position }, incident: 99, left: 5 }, scared: 0 };
    if (save === "autosave") {
      s.bus.emit("InteriorEntered", { interiorId: "x" });
      steps(s, 1);
      await new Promise((r) => setTimeout(r, 0));
      expect(store.puts).toContain(AUTOSAVE_SLOT);
    }
    if (save === "quick") expect(await s.saves.saveAsync("quick")).toBe(true);
    const slot = save === "none" ? null : await new SavePersistence(store).load(save === "quick" ? "quick" : AUTOSAVE_SLOT);
    const loaded = slot ? Simulation.fromSnapshot(slot) : null;
    for (let i = 0; i < 7 * SIM_HZ; i++) {
      s.sim.step();
      loaded?.step();
      if (loaded) expect(stateHash(loaded.snapshot(null, "t", "")), `step ${i}`).toBe(stateHash(s.sim.snapshot(null, "t", "")));
    }
    const heat = s.sim.domain.heat;
    return { reports: reports.map((r) => [r.crime, r.channel, r.witnessId]), heat: [heat.level, heat.faction], loaded: loaded ? [loaded.domain.heat.level, loaded.domain.heat.faction] : null };
  };

  it("the witness's call is not lost to a save: reported as without one, and the loaded game goes on the same", async () => {
    const none = await outcome("none");
    expect(none.reports).toHaveLength(1);
    expect(none.heat[0]).toBeGreaterThan(0);
    for (const save of ["autosave", "quick"] as const) {
      const r = await outcome(save);
      expect(r.reports, save).toEqual(none.reports);
      expect(r.heat, save).toEqual(none.heat);
      expect(r.loaded, save).toEqual(none.heat);
    }
  });
});
