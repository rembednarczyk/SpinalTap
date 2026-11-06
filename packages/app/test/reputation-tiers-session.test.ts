import { describe, expect, it } from "vitest";
import { type EntityId, type ReputationState } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { FLEE_RADIUS, SCHEDULES, SIM_HZ, YIELD_RADIUS } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";
import { FakeRender, frame, steps } from "./story-helpers";

/** A running session whose standings were patched through a save, like a real reload. */
const sessionWith = async (reputation: Partial<ReputationState>, eddies?: number) => {
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
  const wallet = eddies === undefined ? snap.domain.wallet : { eddies };
  await persistence.save("rep", { ...snap, domain: { ...snap.domain, wallet, reputation: { ...snap.domain.reputation, ...reputation } } });
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
    expect(flat(walker!.position, session.sim.player()!.position)).toBeGreaterThanOrEqual(YIELD_RADIUS);
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

// Decision 5.11 (ADR-0070): a hostile street punishes Seki at the counter, not by running from him.
describe("a hostile street in play (ADR-0070)", () => {
  const atOyaji = async () => {
    const { session, ui } = await sessionWith({ civilians: -60 }, 5000);
    const stall = SCHEDULES.oyaji!.stops[0]!.path.at(-1)!;
    placePlayer(session, { x: stall.x, y: stall.y, z: stall.z - 1.4 });
    steps(session, 3 * SIM_HZ);
    return { session, ui, stall, oyaji: [...session.sim.world].find((e) => e.key === "oyaji")! };
  };

  it("Oyaji stays at his stall and sells ammo at half again the price", async () => {
    const { session, ui, stall, oyaji } = await atOyaji();
    expect(flat(oyaji.position, stall)).toBeLessThan(0.3);
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState()).toMatchObject({ shopOpen: true, shopId: "oyaji" });
    const eddies = ui.getState().eddies;
    session.intents.buyItem("44");
    steps(session, 1);
    // Six .44 rounds list at 24 €$; the hostile street charges 36.
    expect(ui.getState().eddies).toBe(eddies - 36);
  });

  it("Oyaji keeps weapons under the counter and says so", async () => {
    const { session, ui } = await atOyaji();
    steps(session, 1, frame({ interact: true }));
    const eddies = ui.getState().eddies;
    session.intents.buyItem("hebi_smg");
    steps(session, 1);
    expect(ui.getState().eddies).toBe(eddies);
    expect(ui.getState().toasts.find((t) => t.title === "Oyaji shakes his head")?.text).toBe("Not for you. Ammo and basics, nothing more.");
  });

  it("a passer-by at the same reputation still runs from Seki", async () => {
    const { session } = await sessionWith({ civilians: -60 });
    const cues: EntityId[] = [];
    session.bus.on("NpcReacted", (e) => cues.push(e.entityId));
    const walker = session.sim.world.with("civilian", "passerby").entities.find((e) => !e.passerby.lane && !e.interactable)!;
    placePlayer(session, { ...walker.position, x: walker.position.x + 2 });
    steps(session, 6 * SIM_HZ);
    expect(flat(walker.position, session.sim.player()!.position)).toBeGreaterThanOrEqual(FLEE_RADIUS);
    expect(cues).toContain(walker.id);
  });
});
