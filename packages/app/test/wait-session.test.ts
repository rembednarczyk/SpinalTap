import { describe, expect, it } from "vitest";
import { type AudioPort, EMPTY_INPUT, type RenderPort, SECONDS_PER_HOUR, START_HOUR, TESSEN_HUNT, formatClock, gameDayOf, tessenHuntFlag, tessenSquadFlag, textRef } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { CLINIC_WAKE_SPOT, SIM_HZ, ground, TESSEN_SQUAD_BACK_PREFIX, TESSEN_SQUAD_LATE_SECONDS, gangerEntity, tessenSquadBackFlag } from "@seki/sim";
import { createUiStore, translateText } from "@seki/ui";
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

  /** Tessen's hunt on (ADR-0082 §3.7) with `flags` of it besides, `seconds` on from its start. */
  const hunted = (session: GameSession, flags: readonly string[], seconds = 0) => {
    const snap = session.saves.snapshot();
    const day = gameDayOf(snap.domain.clock);
    const clock = { ...snap.domain.clock, seconds: snap.domain.clock.seconds + seconds };
    session.restore({ ...snap, domain: { ...snap.domain, clock, flags: [...snap.domain.flags, tessenHuntFlag(day + TESSEN_HUNT.days), ...flags] } }, false);
  };
  /** A new game's clock: 21:00 of day 0. */
  const NEW_GAME_CLOCK = { seconds: START_HOUR * SECONDS_PER_HOUR };
  /** The refusal's toast and the pause menu's reason, the clock standing; the toast's text in both languages. */
  const refusedForHunt = (session: GameSession, ui: ReturnType<typeof createUiStore>) => {
    const start = session.sim.clock.seconds;
    session.intents.openWait();
    expect(ui.getState().wait).toBeNull();
    const toast = ui.getState().toasts.at(-1)!;
    expect(toast).toMatchObject({ kind: "system", title: textRef("wait.blockedTitle"), text: textRef("wait.blocked.hunt") });
    expect(translateText("en", toast.text)).toBe("Not with a Tessen squad on your trail.");
    expect(translateText("pl", toast.text)).toBe("Nie, gdy oddział Tessen jest na twoim tropie.");
    session.pause();
    expect(ui.getState().waitBlocked).toBe("hunt");
    session.intents.openWait();
    session.intents.waitHours(3);
    expect(session.sim.clock.seconds).toBe(start);
    session.resume();
  };

  it("with Tessen's squad on its way, or gone back to wait for her, it is refused (ADR-0082, 17.11)", () => {
    for (const flag of [tessenSquadFlag(TESSEN_HUNT.squadMin, 1e7), tessenSquadBackFlag(TESSEN_HUNT.squadMin, NEW_GAME_CLOCK)]) {
      const { session, ui } = setup();
      hunted(session, [flag]);
      refusedForHunt(session, ui);
    }
  });

  /*
   * A new game wakes her in the clinic, 60 m from any entry the hunt may send a squad in by: one on
   * its way does not come in, and its flag waits (G-934, its own fix). It refuses waiting to its tick
   * and 20 s past it (round 3 of 17.11), not for good.
   */
  it("with Tessen's squad on its way and no entry for it by the clinic, it is refused to its tick and 20 s past it, then she waits", () => {
    const { session, ui } = setup();
    const p = session.sim.player()!.position;
    expect(Math.hypot(p.x - CLINIC_WAKE_SPOT.x, p.z - CLINIC_WAKE_SPOT.z)).toBeLessThan(1);
    const due = session.sim.tick + 2 * SIM_HZ;
    const flag = tessenSquadFlag(TESSEN_HUNT.squadMin, due);
    hunted(session, [flag]);
    refusedForHunt(session, ui);
    const late = due + TESSEN_SQUAD_LATE_SECONDS * SIM_HZ;
    while (session.sim.tick < late - 1) session.step(EMPTY_INPUT);
    refusedForHunt(session, ui);
    session.step(EMPTY_INPUT);
    expect(session.sim.domain.flags).toContain(flag);
    session.pause();
    expect(ui.getState().waitBlocked).toBeNull();
    session.intents.openWait();
    expect(ui.getState().wait).not.toBeNull();
    const start = session.sim.clock.seconds;
    session.intents.waitHours(3);
    expect(session.sim.clock.seconds - start).toBe(3 * SECONDS_PER_HOUR);
  });

  /*
   * Gone back (G-922), the squad refuses it to the end of the stretch of the day it went back in
   * (the user's decision of 17.11, round 2): a new game starts at 21:00 of day 0, in the stretch to
   * midnight. A wait cannot start in it, so none runs from it across its end (the clock stands while
   * the window is up, and Wait asks again); from midnight one does, across the next stretch's end too.
   */
  it("with Tessen's squad gone back it is refused to the end of its stretch of the day; from the next she waits across it", () => {
    const back = tessenSquadBackFlag(TESSEN_HUNT.squadMin, NEW_GAME_CLOCK);
    const last = setup();
    hunted(last.session, [back], 3 * SECONDS_PER_HOUR - 1);
    refusedForHunt(last.session, last.ui);
    const { session, ui } = setup();
    hunted(session, [back], 3 * SECONDS_PER_HOUR);
    session.pause();
    expect(ui.getState().waitBlocked).toBeNull();
    session.intents.openWait();
    expect(ui.getState().wait).not.toBeNull();
    const start = session.sim.clock.seconds;
    session.intents.waitHours(8);
    expect(session.sim.clock.seconds - start).toBe(8 * SECONDS_PER_HOUR);
    // The squad still waits for her where a way leads, with no new warning (G-934, its own fix).
    expect(session.sim.domain.flags).toContain(back);
    // A save of v44 kept the squad's size alone: it does not refuse it.
    const old = setup();
    hunted(old.session, [`${TESSEN_SQUAD_BACK_PREFIX}${TESSEN_HUNT.squadMin}`]);
    old.session.intents.openWait();
    expect(old.ui.getState().wait).not.toBeNull();
  });

  it("with Tessen's squad in the city, far off, it is refused; the hunt alone, or over, lets her wait", () => {
    const { session, ui } = setup();
    hunted(session, []);
    session.pause();
    expect(ui.getState().waitBlocked).toBeNull();
    session.resume();
    const p = session.sim.player()!.position;
    const g = gangerEntity(90011, { key: "", position: { ...p, x: p.x - 90 }, yaw: 0 }, null, 100, "", undefined, "tessen_guard");
    delete g.key;
    g.security = { n: 1, since: session.sim.tick };
    g.ai!.alerted = true;
    session.sim.world.add(g);
    refusedForHunt(session, ui);
    // Three days on the hunt is over: its squad no longer keeps her from waiting.
    const over = setup();
    hunted(over.session, [tessenSquadFlag(TESSEN_HUNT.squadMin, 1e7)], TESSEN_HUNT.days * 24 * SECONDS_PER_HOUR);
    over.session.intents.openWait();
    expect(over.ui.getState().wait).not.toBeNull();
  });

  /*
   * G-946: a gang's warning (decision 3 of 18.11) gives her seconds to put the gun away or walk
   * off. Waiting across it ran it out in the jump: the gang provoked, its grudge up, with no
   * chance to answer. At noon by the Bramowa patrol's corner, 3 m in front of it, gun drawn.
   */
  it("with a gang's warning running it is refused; the gun put away and the warning over, she waits", () => {
    const { session, ui } = setup();
    session.intents.openWait();
    session.intents.waitHours(15);
    expect(ui.getState().clock).toBe("12:00");
    const player = session.sim.player()!;
    const put = (x: number, z: number, yaw: number) => {
      player.position = { x, y: ground(x, z).y, z };
      player.prevPosition = player.position;
      player.yaw = yaw;
    };
    put(506, -66, Math.PI);
    session.step(EMPTY_INPUT);
    const g = [...session.sim.world].find((e) => e.key === "hebi-bramowa")!;
    put(g.position.x + Math.sin(g.yaw) * 3, g.position.z + Math.cos(g.yaw) * 3, g.yaw + Math.PI);
    const warned: unknown[] = [];
    const provoked: unknown[] = [];
    session.sim.bus.on("TerritoryWarned", (e) => warned.push(e));
    session.sim.bus.on("TerritoryProvoked", (e) => provoked.push(e));
    if (player.combatant!.holstered) session.step({ ...EMPTY_INPUT, toggleWeapon: true });
    for (let i = 0; i < SIM_HZ && warned.length === 0; i++) session.step(EMPTY_INPUT);
    expect(warned).toHaveLength(1);
    const start = session.sim.clock.seconds;
    session.intents.openWait();
    expect(ui.getState().wait).toBeNull();
    const toast = ui.getState().toasts.at(-1)!;
    expect(toast).toMatchObject({ kind: "system", title: textRef("wait.blockedTitle"), text: textRef("wait.blocked.warned") });
    expect(translateText("en", toast.text)).toBe("Not with a gang warning you: put the weapon away or walk off.");
    expect(translateText("pl", toast.text)).toBe("Nie, gdy gang cię ostrzega: schowaj broń albo odejdź.");
    session.intents.waitHours(1);
    session.step(EMPTY_INPUT);
    expect(session.sim.clock.seconds - start).toBeLessThan(60);
    expect(provoked).toEqual([]);
    // The gun away, the warning is over by the next step: the hour passes and the gang stays calm.
    session.step({ ...EMPTY_INPUT, toggleWeapon: true });
    for (let i = 0; i < SIM_HZ && Object.values(session.sim.domain.gangStandings).some((s) => s?.warnedUntil !== undefined); i++) session.step(EMPTY_INPUT);
    session.pause();
    expect(ui.getState().waitBlocked).toBeNull();
    session.intents.openWait();
    const before = session.sim.clock.seconds;
    session.intents.waitHours(1);
    expect(session.sim.clock.seconds - before).toBe(SECONDS_PER_HOUR);
    session.step(EMPTY_INPUT);
    expect(provoked).toEqual([]);
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
