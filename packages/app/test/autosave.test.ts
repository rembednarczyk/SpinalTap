import { describe, expect, it } from "vitest";
import type { Contract } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { SIM_HZ } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { AUTOSAVE_INTERVAL_TICKS, AUTOSAVE_SLOT } from "../src/controllers/autosave-controller";
import { GameSession, RECALL_CALM_TICKS } from "../src/game-session";
import { type LifecycleDocument, type LifecycleWindow, bindPageHidden } from "../src/page-lifecycle";
import { FakeRender, steps, talkToKaito, teleport } from "./story-helpers";

/** A store that counts the writes of each slot. */
class CountingStore extends MemorySaveStore {
  readonly puts: string[] = [];
  override async put(slot: string, value: string) {
    this.puts.push(slot);
    await super.put(slot, value);
  }
}

/** `document` and `window` as the page lifecycle sees them, driven by hand. */
const fakePage = () => {
  const listeners = new Map<string, Set<() => void>>();
  const add = (type: string, l: () => void) => {
    const set = listeners.get(type) ?? new Set();
    set.add(l);
    listeners.set(type, set);
  };
  const remove = (type: string, l: () => void) => listeners.get(type)?.delete(l);
  const doc = { visibilityState: "visible" as DocumentVisibilityState, addEventListener: add, removeEventListener: remove };
  const win: LifecycleWindow = { addEventListener: add, removeEventListener: remove };
  const fire = (type: string) => listeners.get(type)?.forEach((l) => l());
  return {
    doc: doc as LifecycleDocument & { visibilityState: DocumentVisibilityState },
    win,
    hide: () => {
      doc.visibilityState = "hidden";
      fire("visibilitychange");
    },
    show: () => {
      doc.visibilityState = "visible";
      fire("visibilitychange");
    },
    pagehide: () => fire("pagehide"),
    count: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  };
};

const flush = () => new Promise((r) => setTimeout(r, 0));
const autos = (store: CountingStore) => store.puts.filter((s) => s === AUTOSAVE_SLOT).length;

/** Interval saves in the tests: 10 s of play, not five minutes of the whole city stepped. */
const INTERVAL = 10 * SIM_HZ;

const setup = (store = new CountingStore()) => {
  const ui = createUiStore();
  const audio = { play() {}, stopAll() {} };
  const persistence = new SavePersistence(store);
  const session = new GameSession({ render: new FakeRender(), audio, persistence, ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 9, 27), autosaveIntervalTicks: INTERVAL });
  return { session, ui, store };
};

const start = () => {
  const game = setup();
  game.session.newGame();
  steps(game.session, 2);
  return game;
};

/** Starts from a save with a cleared contract waiting to be paid. */
const withClearedContract = async () => {
  const game = start();
  const snap = game.session.saves.snapshot();
  const contract = { id: "c7", siteId: "car_wash", targets: 2, reward: 500, status: "cleared" } as Contract;
  await new SavePersistence(game.store).save("t", { ...snap, domain: { ...snap.domain, contracts: { active: contract, completed: 0 } } });
  expect(await game.session.saves.loadAsync("t")).toBe(true);
  return game;
};

describe("autosave (P0 of the gap audit)", () => {
  it("waits out the conversation that advanced the quest and saves when the player is free", async () => {
    const { session, ui, store } = start();
    expect(autos(store)).toBe(0);
    talkToKaito(session);
    for (let guard = 0; guard < 10 && !ui.getState().dialogue?.ended; guard++) session.intents.choose(0);
    steps(session, 5);
    // The quest moved on inside the conversation: no save into a dialogue.
    expect(session.sim.domain.character.alias).toBe("Seki Senshi");
    expect(autos(store)).toBe(0);
    session.intents.closeDialogue();
    steps(session, 1);
    await flush();
    expect(autos(store)).toBe(1);
    expect(ui.getState().slots.map((s) => s.slot)).toContain(AUTOSAVE_SLOT);
    expect(ui.getState().toasts.filter((t) => t.title === "Autosaved")).toHaveLength(1);
    // One save covers the triggers: nothing more while nothing new happens.
    steps(session, 30);
    await flush();
    expect(autos(store)).toBe(1);
  });

  it("saves after a contract is paid", async () => {
    const { session, store } = await withClearedContract();
    session.sim.enqueue({ type: "complete-contract" });
    steps(session, 1);
    await flush();
    expect(session.sim.domain.contracts.completed).toBe(1);
    expect(autos(store)).toBe(1);
  });

  it("holds the save through combat and writes it once the fight is over", async () => {
    const { session, store } = await withClearedContract();
    const guard = [...session.sim.world].find((e) => e.health && !e.player);
    expect(guard).toBeDefined();
    session.sim.session.lastThreat = { tick: session.sim.tick, sourceId: guard!.id };
    session.sim.enqueue({ type: "complete-contract" });
    steps(session, 1);
    await flush();
    expect(autos(store)).toBe(0);
    // The page hiding mid-fight does not save a fight either.
    session.pageHidden();
    await flush();
    expect(autos(store)).toBe(0);
    steps(session, RECALL_CALM_TICKS);
    await flush();
    expect(autos(store)).toBe(1);
  });

  it("saves on crossing into another district, not on a load that lands in one", async () => {
    const { session, store } = start();
    expect(session.sim.district).toBe("shinsekai-7");
    teleport(session, 717.5, 296);
    steps(session, 1);
    await flush();
    expect(session.sim.district).toBe("targ");
    expect(autos(store)).toBe(1);
    expect(await session.saves.loadAsync(AUTOSAVE_SLOT)).toBe(true);
    session.newGame();
    steps(session, 2);
    await flush();
    expect(autos(store)).toBe(1);
  });

  it("saves every few minutes of play, counted from the last autosave", async () => {
    expect(AUTOSAVE_INTERVAL_TICKS).toBe(5 * 60 * SIM_HZ);
    const { session, store } = start();
    // `start` stepped twice already.
    steps(session, INTERVAL - 3);
    await flush();
    expect(autos(store)).toBe(0);
    steps(session, 1);
    await flush();
    expect(autos(store)).toBe(1);
    steps(session, INTERVAL - 1);
    await flush();
    expect(autos(store)).toBe(1);
    steps(session, 1);
    await flush();
    expect(autos(store)).toBe(2);
  });

  it("writes at once when the page hides, only once for visibilitychange and pagehide", async () => {
    const { session, ui, store } = start();
    const page = fakePage();
    const unbind = bindPageHidden(page.doc, page.win, () => session.pageHidden());
    page.show();
    expect(autos(store)).toBe(0);
    page.hide();
    // Started in the same task: the write reached the store before any await.
    expect(store.data.has(AUTOSAVE_SLOT)).toBe(true);
    page.pagehide();
    await flush();
    // The page closing after it hid, with nothing played in between: nothing new to write.
    page.pagehide();
    await flush();
    expect(autos(store)).toBe(1);
    // No toast nobody sees.
    expect(ui.getState().toasts.filter((t) => t.title === "Autosaved")).toHaveLength(0);
    // Back, a step played, hidden again: a new save.
    page.show();
    steps(session, 1);
    page.hide();
    await flush();
    expect(autos(store)).toBe(2);
    unbind();
    expect(page.count()).toBe(0);
  });

  it("saves a paused game when the page hides: loading it resumes play", async () => {
    const { session, store } = start();
    session.pause();
    expect(session.screen).toBe("paused");
    session.pageHidden();
    await flush();
    expect(autos(store)).toBe(1);
    expect(await session.saves.loadAsync(AUTOSAVE_SLOT)).toBe(true);
    expect(session.screen).toBe("playing");
  });

  it("never saves on the title screen", async () => {
    const store = new CountingStore();
    const { session } = setup(store);
    session.pageHidden();
    await flush();
    expect(autos(store)).toBe(0);
  });

  it("loads the autosave back into the state it saved", async () => {
    const { session, store } = start();
    session.pageHidden();
    await flush();
    const saved = session.saves.snapshot();
    steps(session, 120);
    expect(session.saves.snapshot().tick).not.toBe(saved.tick);
    expect(await session.saves.loadAsync(AUTOSAVE_SLOT)).toBe(true);
    expect(session.saves.snapshot().domain).toEqual(saved.domain);
    expect(session.saves.snapshot().tick).toBe(saved.tick);
    expect(autos(store)).toBe(1);
  });

  it("does nothing with autosave off in the settings", async () => {
    const { session, store } = await withClearedContract();
    session.intents.changeSettings({ autosave: false });
    session.sim.enqueue({ type: "complete-contract" });
    steps(session, 1);
    session.pageHidden();
    steps(session, INTERVAL * 2);
    await flush();
    expect(autos(store)).toBe(0);
  });
});
