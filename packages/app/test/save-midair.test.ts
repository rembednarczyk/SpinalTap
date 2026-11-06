import { describe, expect, it } from "vitest";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { docks } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { AUTOSAVE_SLOT } from "../src/controllers/autosave-controller";
import { GameSession } from "../src/game-session";
import { FakeRender, frame, steps, teleport } from "./story-helpers";

/**
 * No save in the air (G-335): the save keeps no fall speed, peak or mantle, so a save in a leap
 * loads with her standing still in mid-air and the flight goes another way. The autosave and the
 * page hiding wait for the landing; the player's own save is refused with a toast. Headless
 * (ADR-0046), a leap off the roof over the market.
 */

class CountingStore extends MemorySaveStore {
  readonly puts: string[] = [];
  override async put(slot: string, value: string) {
    this.puts.push(slot);
    await super.put(slot, value);
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const autos = (store: CountingStore) => store.puts.filter((s) => s === AUTOSAVE_SLOT).length;

/** The low container stack in the docks' yard (the market's roofs went with ADR-0063), and the way off its north edge (2.6 m down). */
const ROOF = docks(3, 2.6, 101.2);
const OFF_THE_EDGE = 0;
const RUN = frame({ moveZ: 1, sprint: true });

/** On the container, the docks' district autosave written: the writes count from here. */
const start = async () => {
  const store = new CountingStore();
  const ui = createUiStore();
  const session = new GameSession({ render: new FakeRender(), audio: { play() {}, stopAll() {} }, persistence: new SavePersistence(store), ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 9, 27) });
  session.newGame();
  steps(session, 2);
  for (const g of [...session.sim.world.with("ai")]) session.sim.world.remove(g);
  teleport(session, ROOF.x, ROOF.z, OFF_THE_EDGE, 0, ROOF.y);
  steps(session, 5);
  await flush();
  expect(session.sim.player()!.fall).toBeUndefined();
  store.puts.length = 0;
  return { session, store, ui };
};

/** Runs at the edge and jumps off it: returns once she is in the air, past the edge. */
const leap = (session: GameSession) => {
  const p = session.sim.player()!;
  for (let i = 0; i < 300 && !(p.fall !== undefined && p.position.y < ROOF.y - 0.3); i++) steps(session, 1, frame({ ...RUN, jump: p.fall === undefined }));
  expect(p.fall).toBeDefined();
};

/** Steps the rest of the flight, calling `inAir` after every step still in it; returns the steps flown. */
const land = async (session: GameSession, inAir: () => void) => {
  const p = session.sim.player()!;
  let flown = 0;
  for (; flown < 300 && p.fall !== undefined; flown++) {
    steps(session, 1, RUN);
    await flush();
    if (p.fall !== undefined) inAir();
  }
  expect(p.fall).toBeUndefined();
  expect(p.position.y).toBeLessThan(ROOF.y - 1);
  return flown;
};

describe("no save in the air (G-335)", () => {
  it("holds an autosave asked for in a leap off a roof and writes it on landing", async () => {
    const { session, store } = await start();
    leap(session);
    session.bus.emit("QuestAdvanced", { questId: "g335", stepId: "leap", objective: "g335" });
    const flown = await land(session, () => expect(autos(store)).toBe(0));
    expect(flown).toBeGreaterThan(3);
    steps(session, 1);
    await flush();
    expect(autos(store)).toBe(1);
    // The slot holds her on the floor: loaded, she stands where she landed.
    const y = session.sim.player()!.position.y;
    expect(await session.saves.loadAsync(AUTOSAVE_SLOT)).toBe(true);
    steps(session, 30);
    expect(session.sim.player()!.fall).toBeUndefined();
    expect(session.sim.player()!.position.y).toBeCloseTo(y, 5);
  });

  it("refuses quicksave in the air with its own toast, in both languages, and saves on the floor", async () => {
    const { session, store, ui } = await start();
    leap(session);
    expect(session.saves.canSave()).toBe(false);
    expect(await session.saves.saveAsync("quick")).toBe(false);
    expect(ui.getState().toasts.at(-1)?.title).toBe("Can't save in mid-air");
    session.intents.changeSettings({ locale: "pl" });
    expect(await session.saves.saveAsync("quick")).toBe(false);
    expect(ui.getState().toasts.at(-1)?.title).toBe("Nie można zapisać w powietrzu");
    expect(store.puts.filter((s) => s === "quick")).toHaveLength(0);
    await land(session, () => undefined);
    expect(session.saves.canSave()).toBe(true);
    expect(await session.saves.saveAsync("quick")).toBe(true);
  });

  it("saves a page hidden in the air once she lands, not in the flight", async () => {
    const { session, store } = await start();
    leap(session);
    session.pageHidden();
    await flush();
    expect(autos(store)).toBe(0);
    await land(session, () => expect(autos(store)).toBe(0));
    steps(session, 1);
    await flush();
    expect(autos(store)).toBe(1);
  });

  it("still saves on a ladder: a load puts her back on the rungs (G-313)", async () => {
    const { session, store } = await start();
    teleport(session, docks(3, 0, 99.6).x, docks(3, 0, 99.6).z, 0, 0, docks(3, 0, 99.6).y);
    steps(session, 1, frame({ interact: true }));
    steps(session, 40, frame({ moveZ: 1 }));
    expect(session.sim.player()!.climb?.ladder).toBe("doki-stack-1");
    expect(session.saves.canSave()).toBe(true);
    session.pageHidden();
    await flush();
    expect(autos(store)).toBe(1);
  });
});
