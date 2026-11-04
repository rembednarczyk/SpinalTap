import { afterEach, describe, expect, it, vi } from "vitest";
import { type DomainEvents, type EntityId, EventBus } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { SIM_HZ } from "@seki/sim";
import { type Toast, createUiStore, dismissToast } from "@seki/ui";
import { bindEventPresenter } from "../src/event-presenter";
import { GameSession } from "../src/game-session";
import { FakeRender, frame, steps } from "./story-helpers";

/** As many toasts as the store keeps on screen at once. */
const VISIBLE = 4;

/**
 * A street that fears the player (G-281): walking through a crowd of residents, each passer-by
 * running off used to put up its own toast, every time it stepped back over the flee radius.
 */
const fearedInCrowd = async (locale: "en" | "pl") => {
  const ui = createUiStore();
  ui.setState({ settings: { ...ui.getState().settings, locale } });
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({
    render: new FakeRender(),
    audio: { play() {}, stopAll() {} },
    persistence,
    ui,
    story: STORY_SOURCE,
    seed: () => 77,
    now: () => new Date(2026, 10, 4),
    crowd: "high",
  });
  session.newGame();
  const snap = session.saves.snapshot();
  await persistence.save("feared", { ...snap, domain: { ...snap.domain, reputation: { ...snap.domain.reputation, civilians: -80, hebi: -80 } } });
  await session.saves.loadAsync("feared");
  steps(session, 2);
  return { session, ui };
};

/**
 * Paces up and down beside a resident for `seconds`, two seconds each way. The toasts' own
 * timers run with the play, so they go after their time as in the game.
 */
const paceBy = (session: GameSession, seconds: number) => {
  const resident = session.sim.world.with("civilian", "passerby").entities[0];
  expect(resident, "a resident in the street").toBeDefined();
  const p = session.sim.player()!;
  p.position = { ...resident!.position, x: resident!.position.x + 3 };
  p.prevPosition = p.position;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  for (let s = 0; s < seconds; s++) {
    steps(session, SIM_HZ, frame({ moveZ: s % 4 < 2 ? 0.5 : -0.5 }));
    vi.advanceTimersByTime(1000);
  }
};

const watchToasts = (ui: ReturnType<typeof createUiStore>) => {
  const shown = new Map<number, Toast>();
  let most = 0;
  ui.subscribe((s) => {
    most = Math.max(most, s.toasts.length);
    for (const t of s.toasts) shown.set(t.id, t);
  });
  return { shown, most: () => most };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("a feared player in a crowd (G-281)", () => {
  it("gets one toast for the crowd running off, not one per passer-by and step", async () => {
    const { session, ui } = await fearedInCrowd("en");
    const toasts = watchToasts(ui);
    const cues: EntityId[] = [];
    session.bus.on("NpcReacted", (e) => cues.push(e.entityId));
    paceBy(session, 40);
    const fled = [...toasts.shown.values()].filter((t) => t.title === "Passers-by run away");
    // Somebody did run: the reaction is still there, only not repeated.
    expect(fled.length).toBeGreaterThan(0);
    // Once per quiet gap, however many run and however often.
    expect(fled.length).toBeLessThanOrEqual(2);
    expect(toasts.most()).toBeLessThanOrEqual(VISIBLE);
    // The sim gives one cue per escape: a passer-by hovering at the flee radius does not repeat
    // it (it did, step after step); one that walked off on its routine and came back may run again.
    expect(cues.length).toBeLessThanOrEqual(2 * new Set(cues).size);
  });

  it("counts the runners in the one toast, in Polish too", async () => {
    const { session, ui } = await fearedInCrowd("pl");
    const toasts = watchToasts(ui);
    paceBy(session, 4);
    const fled = [...toasts.shown.values()].filter((t) => t.title === "Przechodnie uciekają");
    expect(fled).toHaveLength(1);
    expect(fled[0]!.count ?? 1).toBeGreaterThan(1);
  });
});

describe("reaction toasts keep a quiet gap of play time (G-281)", () => {
  const presenter = () => {
    const bus = new EventBus<DomainEvents>();
    const ui = createUiStore();
    const clock = { seconds: 100 };
    bindEventPresenter(bus, new FakeRender(), { play() {}, stopAll() {} }, ui, {
      playerId: () => 1,
      playSeconds: () => clock.seconds,
      onDialogue() {},
      onShop() {},
      onLoot() {},
      onPlayerDied() {},
      onDialogueInterrupted() {},
    });
    const shown = watchToasts(ui).shown;
    const flee = (faction: "civilians" | "hebi" = "civilians") => bus.emit("NpcReacted", { entityId: 7, faction, reaction: "flee" });
    const clear = () => {
      for (const t of ui.getState().toasts) dismissToast(ui, t.id);
    };
    return { ui, clock, shown, flee, clear };
  };

  it("after the toast went, the same reaction waits; another faction or the gang's warning does not", () => {
    const { clock, shown, flee, clear } = presenter();
    flee();
    clear();
    clock.seconds += 10;
    flee();
    expect(shown.size).toBe(1);
    flee("hebi");
    expect(shown.size).toBe(2);
    clear();
    clock.seconds += 25;
    flee();
    expect(shown.size).toBe(3);
  });

  it("a load that takes the clock back does not keep the street quiet", () => {
    const { clock, shown, flee, clear } = presenter();
    flee();
    clear();
    clock.seconds = 5;
    flee();
    expect(shown.size).toBe(2);
  });
});
