import { describe, expect, it } from "vitest";
import { type AudioPort, EMPTY_INPUT, type RenderPort, SECONDS_PER_HOUR, formatClock, textRef } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { gangerEntity } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";

/** Waiting, headless: the window from play and from the pause menu, the `wait` command, and where it is refused. */

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

const setup = () => {
  const ui = createUiStore();
  const session = new GameSession({ render, audio: silent, persistence: new SavePersistence(new MemorySaveStore()), ui, story: STORY_SOURCE, seed: () => 2024, now: () => new Date(2026, 10, 1, 20, 0), scenery: false });
  session.newGame();
  return { session, ui };
};

/** An alerted Tessen guard five metres from the player: a fight is on. */
const startFight = (session: GameSession) => {
  const p = session.sim.player()!.position;
  const g = gangerEntity(90010, { key: "test-guard", position: { ...p, x: p.x - 5 }, yaw: 0 }, null, 1e6, "test", undefined, "tessen_guard");
  g.ai!.alerted = true;
  session.sim.world.add(g);
  return g;
};

describe("waiting in the session", () => {
  it("from play: the window stops the clock, three hours move the game clock by three hours and it closes", () => {
    const { session, ui } = setup();
    const start = session.sim.clock.seconds;
    session.intents.openWait();
    expect(ui.getState().wait).toEqual({ clockSeconds: start });
    expect(session.inControl).toBe(false);
    // The clock stands while the window is up.
    const tick = session.sim.tick;
    session.step(EMPTY_INPUT);
    expect(session.sim.tick).toBe(tick);
    session.intents.waitHours(3);
    expect(session.sim.clock.seconds).toBe(start + 3 * SECONDS_PER_HOUR);
    expect(ui.getState().wait).toBeNull();
    expect(ui.getState().clock).toBe(formatClock(session.sim.clock));
    expect(session.screen).toBe("playing");
    expect(session.inControl).toBe(true);
    // Closed, it waits no more.
    session.intents.waitHours(3);
    expect(session.sim.clock.seconds).toBe(start + 3 * SECONDS_PER_HOUR);
  });

  it("from the pause menu: the window takes its place, past midnight onto the next day", () => {
    const { session, ui } = setup();
    session.pause();
    expect(ui.getState().waitBlocked).toBeNull();
    session.intents.openWait();
    expect(session.screen).toBe("playing");
    expect(ui.getState().wait).not.toBeNull();
    const before = session.sim.clock.seconds;
    session.intents.waitHours(5);
    expect(session.sim.clock.seconds - before).toBe(5 * SECONDS_PER_HOUR);
    // A new game starts at 21:00 of day 1: five hours on it is 02:00 of day 2.
    expect(ui.getState().clock).toBe("02:00");
    expect(ui.getState().day).toBe(2);
  });

  it("Cancel closes without time passing, and the hours stay whole and within a day", () => {
    const { session, ui } = setup();
    const start = session.sim.clock.seconds;
    session.intents.openWait();
    session.intents.closeWait();
    expect(ui.getState().wait).toBeNull();
    expect(session.sim.clock.seconds).toBe(start);
    session.intents.openWait();
    session.intents.waitHours(99);
    expect(session.sim.clock.seconds - start).toBe(24 * SECONDS_PER_HOUR);
  });

  it("in a fight it is refused: the pause menu's entry is off with the reason, the key gives a toast", () => {
    const { session, ui } = setup();
    startFight(session);
    const start = session.sim.clock.seconds;
    session.intents.openWait();
    expect(ui.getState().wait).toBeNull();
    expect(ui.getState().toasts.at(-1)).toMatchObject({ kind: "system", title: textRef("wait.blockedTitle"), text: textRef("wait.blocked.combat") });
    session.pause();
    expect(ui.getState().waitBlocked).toBe("combat");
    session.intents.openWait();
    expect(session.screen).toBe("paused");
    expect(ui.getState().wait).toBeNull();
    session.intents.waitHours(3);
    expect(session.sim.clock.seconds).toBe(start);
  });

  it("hunted by the district's security it is refused as a pursuit", () => {
    const { session, ui } = setup();
    const snap = session.saves.snapshot();
    session.restore({ ...snap, domain: { ...snap.domain, heat: { ...snap.domain.heat, level: 2, faction: "tessen" } } }, false);
    session.pause();
    expect(ui.getState().waitBlocked).toBe("wanted");
    session.intents.openWait();
    expect(ui.getState().wait).toBeNull();
  });

  it("not over another panel: the phone open keeps it shut", () => {
    const { session, ui } = setup();
    session.intents.openPhone();
    session.intents.openWait();
    expect(ui.getState().wait).toBeNull();
    session.intents.closePhone();
    session.intents.openWait();
    expect(ui.getState().wait).not.toBeNull();
  });

  it("the wait key is a binding the settings can change", () => {
    const { session, ui } = setup();
    expect(ui.getState().controls.find((c) => c.action === "wait")?.codes).toEqual(["KeyL"]);
    session.intents.bindKey("wait", "KeyU");
    expect(ui.getState().controls.find((c) => c.action === "wait")?.codes).toEqual(["KeyU"]);
  });
});
