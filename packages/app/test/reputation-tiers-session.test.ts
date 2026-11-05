import { describe, expect, it } from "vitest";
import { type EntityId, type ReputationState } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { SCHEDULES, SIM_HZ } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { FakeRender, frame, steps } from "./story-helpers";

/** A running session whose standings were patched through a save, like a real reload. */
const sessionWith = async (reputation: Partial<ReputationState>) => {
  const ui = createUiStore();
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({
    render: new FakeRender(),
    audio: { play() {}, stopAll() {} },
    persistence,
    ui,
    story: STORY_SOURCE,
    seed: () => 77,
    now: () => new Date(2026, 10, 5),
    crowd: "high",
  });
  session.newGame();
  const snap = session.saves.snapshot();
  await persistence.save("rep", { ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, ...reputation } } });
  await session.saves.loadAsync("rep");
  steps(session, 2);
  return { session, ui };
};

const placePlayer = (session: GameSession, at: { x: number; y: number; z: number }) => {
  const p = session.sim.player()!;
  p.position = at;
  p.prevPosition = at;
};

const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("a wary street in play (ADR-0070)", () => {
  it("passers-by make way for Seki without running and without a toast", async () => {
    const { session, ui } = await sessionWith({ civilians: -30 });
    const cues: EntityId[] = [];
    session.bus.on("NpcReacted", (e) => cues.push(e.entityId));
    const walker = session.sim.world.with("civilian", "passerby").entities.find((e) => !e.passerby.lane && !e.interactable);
    expect(walker, "a passer-by at its stop").toBeDefined();
    placePlayer(session, { ...walker!.position, x: walker!.position.x + 2 });
    steps(session, 10 * SIM_HZ);
    expect(flat(walker!.position, session.sim.player()!.position)).toBeGreaterThanOrEqual(3.5);
    expect(cues).toHaveLength(0);
    expect(ui.getState().toasts.map((t) => t.title)).not.toContain("Passers-by run away");
  });

  it("Oyaji stays at his stall and serves a wary customer (G-305)", async () => {
    const { session, ui } = await sessionWith({ civilians: -30 });
    const stall = SCHEDULES.oyaji!.stops[0]!.path.at(-1)!;
    placePlayer(session, { x: stall.x, y: stall.y, z: stall.z - 1.4 });
    steps(session, 2 * SIM_HZ);
    const oyaji = [...session.sim.world].find((e) => e.key === "oyaji")!;
    expect(flat(oyaji.position, stall)).toBeLessThan(0.3);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState()).toMatchObject({ shopOpen: true, shopId: "oyaji" });
  });
});
