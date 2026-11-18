import { describe, expect, it } from "vitest";
import {
  type AudioCue,
  type DomainState,
  type EffectDescriptor,
  SABOTAGE_LOUD,
  SECONDS_PER_HOUR,
  TESSEN_HUNT,
  type W3StationId,
  contractAlarmFlag,
  contractObjective,
  contractSecondsLeft,
  contractTag,
  gameDayOf,
  stationDownFlag,
  tessenHuntFlag,
  tessenHuntUntil,
  tessenSquadDue,
} from "@seki/core";
import {
  CLINIC_WAKE_SPOT,
  GENZO_SPOT,
  SIM_HZ,
  TESSEN_SQUAD_LATE_SECONDS,
  W3_CORE_BLIND_SPOT,
  W3_STATION_SPOTS,
  W3_VIRUS_TERMINAL,
  W3_Y,
  stateHash,
  stationChargeAt,
  tessenSquadBack,
} from "@seki/sim";
import { translateText } from "@seki/ui";
import { frame, objective, setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";
import { SIREN_PERIOD } from "../src/presenters/w3-mission";

/**
 * W-3's sabotage, the loud way, in a session, headless (ADR-0082 stage 3b): the charges' case in
 * armoury S raises the alarm (its klaxon, the siren while it lasts) and the toast of the way cut
 * off, three charges on the line, the blast out of the hall as explosions over the stations, their
 * sound and the wrecks (stage 3c), out of the zone Genzō pays the loud rate and Tessen hunts her,
 * a toast before each squad; the alarm during the upload turns the job loud; a save with the fuse
 * running loads to the same state; a load after the blast shows the wrecks again from the flags,
 * without a blast.
 */

type Ui = ReturnType<typeof setup>["ui"];
const step = (session: GameSession): string => {
  const c = session.sim.domain.contracts.active;
  return c ? translateText("pl", contractObjective(c, contractSecondsLeft(c, session.sim.tick, SIM_HZ))) : "";
};
const line = (session: GameSession, locale: "en" | "pl"): string => {
  const c = session.sim.domain.contracts.active!;
  return translateText(locale, contractObjective(c, contractSecondsLeft(c, session.sim.tick, SIM_HZ)));
};
const toasts = (u: Ui) => u.getState().toasts.map((t) => `${t.title} | ${t.text}`);

const start = () => {
  const cues: AudioCue[] = [];
  const s = setup(undefined, { play: (c) => cues.push(c), stopAll() {} });
  const effects: EffectDescriptor[] = [];
  const play = s.render.playEffect.bind(s.render);
  s.render.playEffect = (e: EffectDescriptor) => {
    effects.push(e);
    play(e);
  };
  s.session.newGame();
  steps(s.session, 2);
  return { ...s, effects, cues };
};

const acceptSabotage = (session: GameSession, u: Ui) => {
  teleport(session, GENZO_SPOT.x + 0.3, GENZO_SPOT.z - 1.8, 0);
  steps(session, 1);
  steps(session, 1, frame({ interact: true }));
  const choice = (u.getState().dialogue?.choices ?? []).find((c) => c.text.startsWith("Co to za partia dronów"));
  if (!choice) throw new Error("no sabotage offer");
  session.intents.choose(choice.index);
  session.intents.closeDialogue();
  steps(session, 2);
  const job = session.sim.domain.contracts.active;
  if (job?.kind !== "sabotage") throw new Error("no sabotage");
  return job;
};

/** The job's guards out of the way (the waves too, once they came). */
const knockOut = (session: GameSession, id: string) => {
  for (const g of [...session.sim.world].filter((e) => e.tag === contractTag(id) && (e.health?.current ?? 0) > 0)) g.health = { current: 0, max: g.health!.max };
  steps(session, 1);
};
const inHall = (session: GameSession, x: number, z: number, yaw: number) => teleport(session, x, z, yaw, 0, W3_Y);

const plant = (session: GameSession, id: string, s: W3StationId) => {
  const p = W3_STATION_SPOTS[s];
  const north = s === "S3" || s === "S4";
  inHall(session, p.x, p.z + (north ? -0.4 : 0.4), north ? 0 : Math.PI);
  steps(session, 1);
  steps(session, 1, frame({ interact: true }));
  steps(session, Math.round(SABOTAGE_LOUD.plantSeconds * SIM_HZ) + 1);
  knockOut(session, id);
};

const last = <K extends EffectDescriptor["kind"]>(effects: readonly EffectDescriptor[], kind: K) =>
  effects.filter((e): e is Extract<EffectDescriptor, { kind: K }> => e.kind === kind);

type Holder = { holder: { domain: DomainState } };
const setDomain = (session: GameSession, change: (d: DomainState) => DomainState): void => {
  const holder = (session.sim as unknown as Holder).holder;
  holder.domain = change(holder.domain);
};

describe("W-3's sabotage, the loud way, in a session (ADR-0082 stage 3b)", () => {
  it("loud: the charges raise the alarm, three on the line, the blast out of the hall, paid the loud rate, Tessen hunts her", async () => {
    const { session, ui: u, effects, cues } = start();
    const count = (c: AudioCue) => cues.filter((x) => x === c).length;
    const job = acceptSabotage(session, u);
    knockOut(session, job.id);
    expect(last(effects, "line-wrecks").at(-1)?.stations).toEqual([]);
    // Armoury S, by the charges' case.
    inHall(session, 2555, 402, Math.PI);
    steps(session, 1);
    expect(u.getState().prompt ?? "").toMatch(/Take the charges|Weź ładunki/);
    steps(session, 1, frame({ interact: true }));
    expect(session.sim.domain.flags).toContain(contractAlarmFlag(job.id));
    expect(toasts(u).some((t) => /Server room cut off|Serwerownia odcięta/.test(t))).toBe(true);
    expect(last(effects, "alarm-light").at(-1)?.active).toBe(true);
    expect(count("alarm")).toBe(1);
    knockOut(session, job.id);
    // The siren wails while the alarm lasts and she is in the zone, a wail a period: two in two,
    // a frame drawn every step as in the game (the wail goes out with the HUD's frame).
    const wails = count("alarm-siren");
    for (let i = 0; i < 2 * Math.round(SIREN_PERIOD * SIM_HZ); i++) steps(session, 1);
    expect(count("alarm-siren") - wails).toBe(2);
    expect(step(session)).toContain("Podłóż ładunki na stanowiskach linii (0/3");
    // Each charge clamps on with its sound once it is planted (stage 4), not while it is being planted.
    expect(count("charge-plant")).toBe(0);
    plant(session, job.id, "S1");
    expect(step(session)).toContain("(1/3");
    expect(count("charge-plant")).toBe(1);
    plant(session, job.id, "S2");
    plant(session, job.id, "S4");
    expect(count("charge-plant")).toBe(3);
    expect(step(session)).toMatch(/Wyjdź z hali, zanim ładunki wybuchną \((1:00|0:5\d)\)/);
    // A save with the fuse running loads to the same state.
    const hash = stateHash(session.sim.snapshot(null, "t", ""));
    expect(await session.saves.saveAsync("fuse")).toBe(true);
    expect(await session.saves.loadAsync("fuse")).toBe(true);
    expect(stateHash(session.sim.snapshot(null, "t", ""))).toBe(hash);
    // The load sent the line's state again, the wrecks none yet, and set nothing off.
    expect(last(effects, "line-wrecks").at(-1)?.stations).toEqual([]);
    expect(last(effects, "explosion")).toHaveLength(0);
    expect(count("explosion")).toBe(0);
    expect(count("charge-plant")).toBe(3);
    // Out of the hall, in the east yard: the line goes off.
    teleport(session, 2585, 415, 0, 0, W3_Y);
    steps(session, 2);
    for (const s of ["S1", "S2", "S4"] as const) expect(session.sim.domain.flags).toContain(stationDownFlag(s));
    expect(last(effects, "explosion")).toEqual((["S1", "S2", "S4"] as const).map((s) => ({ kind: "explosion", at: stationChargeAt(s), radius: SABOTAGE_LOUD.blastRadius })));
    expect(count("explosion")).toBe(1);
    expect(last(effects, "line-wrecks").at(-1)?.stations).toEqual(["S1", "S2", "S4"]);
    expect(step(session)).toContain("Uciekaj z W-3");
    const eddies = session.sim.domain.wallet.eddies;
    teleport(session, 2527, 384, 0);
    steps(session, 2);
    expect(session.sim.domain.contracts.active).toBeNull();
    const loudPay = Math.round((job.reward * SABOTAGE_LOUD.loudReward) / 2000);
    expect(session.sim.domain.wallet.eddies - eddies).toBeGreaterThanOrEqual(loudPay);
    expect(session.sim.domain.reputation.tessen).toBeLessThanOrEqual(-60);
    expect(tessenHuntUntil(session.sim.domain.flags)).toBe(gameDayOf(session.sim.domain.clock) + TESSEN_HUNT.days);
    // The hunt survives a save: the flag is in it.
    expect(await session.saves.saveAsync("hunt")).toBe(true);
    const blasts = last(effects, "explosion").length;
    const wrecksSent = last(effects, "line-wrecks").length;
    expect(await session.saves.loadAsync("hunt")).toBe(true);
    steps(session, 1);
    expect(tessenHuntUntil(session.sim.domain.flags)).not.toBeNull();
    // The wrecks come back from the stations' flags, without a blast or its sound; the alarm is over.
    expect(last(effects, "line-wrecks").length).toBe(wrecksSent + 1);
    expect(last(effects, "line-wrecks").at(-1)?.stations).toEqual(["S1", "S2", "S4"]);
    expect(last(effects, "explosion")).toHaveLength(blasts);
    expect(count("explosion")).toBe(1);
    const silent = count("alarm-siren");
    steps(session, Math.round(2 * SIREN_PERIOD * SIM_HZ) + 1);
    expect(count("alarm-siren")).toBe(silent);
  });

  it("the alarm during the upload turns the job loud: the toast, the armoury's step, the screens back to idle", () => {
    const { session, ui: u, effects } = start();
    const job = acceptSabotage(session, u);
    knockOut(session, job.id);
    const s = W3_CORE_BLIND_SPOT;
    inHall(session, s.x, s.z, Math.atan2(W3_VIRUS_TERMINAL.x - s.x, W3_VIRUS_TERMINAL.z - s.z));
    steps(session, 1);
    steps(session, 1, frame({ interact: true }));
    session.intents.submitBreach([]);
    steps(session, 5 * SIM_HZ);
    expect(last(effects, "line-screens").at(-1)?.state).toBe("upload");
    setDomain(session, (d) => ({ ...d, flags: [...d.flags, contractAlarmFlag(job.id)] }));
    steps(session, 2);
    expect(session.sim.domain.contracts.active).toMatchObject({ route: "loud", status: "active" });
    expect(toasts(u).some((t) => /Server room cut off|Serwerownia odcięta/.test(t))).toBe(true);
    expect(step(session)).toContain("Serwerownia odcięta. Zostaje zbrojownia");
    expect(last(effects, "line-screens").at(-1)?.state).toBe("idle");
  });

  /** G-906: the loud way's step names where it happens, in both languages, and the HUD writes one of them. */
  const expectPlace = (session: GameSession, u: Ui, en: RegExp, pl: RegExp) => {
    expect([line(session, "en"), line(session, "pl")]).toContain(objective(u));
    expect(line(session, "en")).not.toMatch(/server room N|calibration core/);
    expect(line(session, "pl")).not.toMatch(/serwerowni N|rdzeń kalibracji/);
    expect(line(session, "en")).toMatch(en);
    expect(line(session, "pl")).toMatch(pl);
  };

  it("the loud way names the line's stations once the charges are taken, not server room N (G-906)", () => {
    const { session, ui: u } = start();
    const job = acceptSabotage(session, u);
    knockOut(session, job.id);
    expect(line(session, "en")).toContain("server room N");
    expect(line(session, "pl")).toContain("serwerowni N");
    inHall(session, 2555, 402, Math.PI);
    steps(session, 1);
    steps(session, 1, frame({ interact: true }));
    knockOut(session, job.id);
    expect(session.sim.domain.contracts.active).toMatchObject({ route: "loud", charges: [] });
    expectPlace(session, u, /\(0\/3.*: stations S1–S4 on hall W-3's assembly line$/, /\(0\/3.*: stanowiska S1–S4 na linii montażu hali W-3$/);
    plant(session, job.id, "S1");
    expectPlace(session, u, /\(1\/3.*: stations S1–S4/, /\(1\/3.*: stanowiska S1–S4/);
  });

  it("the server rooms cut off before the charges: the step names the armoury's case, not server room N (G-906)", () => {
    const { session, ui: u } = start();
    const job = acceptSabotage(session, u);
    setDomain(session, (d) => ({ ...d, flags: [...d.flags, contractAlarmFlag(job.id)] }));
    steps(session, 2);
    expect(session.sim.domain.contracts.active).toMatchObject({ route: "loud" });
    expect(session.sim.domain.contracts.active?.charges).toBeUndefined();
    expectPlace(session, u, /^Server room cut off\..*: the case by hall W-3's south corridor$/, /^Serwerownia odcięta\..*: skrzynia przy korytarzu południowym hali W-3$/);
  });

  it("Tessen's hunt warns her on the HUD 20-40 s before the squad comes in (G-911)", () => {
    const { session, ui: u } = start();
    const day = gameDayOf(session.sim.domain.clock);
    setDomain(session, (d) => ({ ...d, flags: [...d.flags, tessenHuntFlag(day + TESSEN_HUNT.days)], reputation: { ...d.reputation, tessen: -60 } }));
    const squad = () => [...session.sim.world].filter((e) => e.security && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);
    const warned = () => toasts(u).filter((t) => /Tessen is on your trail|Tessen na twoim tropie/.test(t)).length;
    // Stare Miasto by the Rynek. Not (600; 30), inside the Trybunał's block, where no way leads (G-922).
    teleport(session, 575, -38, 0);
    steps(session, 2 * SIM_HZ);
    const due = tessenSquadDue(session.sim.domain.flags);
    expect(due).not.toBeNull();
    expect(warned()).toBe(1);
    expect(squad()).toEqual([]);
    expect(due!.tick - session.sim.tick).toBeGreaterThanOrEqual((TESSEN_HUNT.delayMinSeconds - 2) * SIM_HZ);
    steps(session, due!.tick - session.sim.tick - SIM_HZ);
    expect(squad()).toEqual([]);
    steps(session, 2 * SIM_HZ);
    expect(squad().length).toBeGreaterThanOrEqual(TESSEN_HUNT.squadMin);
    expect(warned()).toBe(1);
  });

  it("where no way leads to her from an entry near, the squad waits for her without a warning again and again (G-922)", () => {
    const { session, ui: u } = start();
    const day = gameDayOf(session.sim.domain.clock);
    setDomain(session, (d) => ({ ...d, flags: [...d.flags, tessenHuntFlag(day + TESSEN_HUNT.days)], reputation: { ...d.reputation, tessen: -60 } }));
    // The toasts' pushes: a toast like one on screen only counts on it (G-281).
    const pushes = new Map<number, number>();
    const warned = () => {
      for (const t of u.getState().toasts) if (/Tessen is on your trail/.test(`${t.title} | ${t.text}`)) pushes.set(t.id, Math.max(pushes.get(t.id) ?? 0, t.count ?? 1));
      return [...pushes.values()].reduce((a, b) => a + b, 0);
    };
    // In the kanal by Grodzka: the only entry near in a loaded chunk is Grodzka's, in a closed cell.
    teleport(session, 520, 0, 0);
    for (let s = 0; s < 150; s++) {
      steps(session, SIM_HZ);
      warned();
    }
    expect(warned()).toBe(1);
  });

  it("gone back, the squad is its stretch's: past it the next roll warns her before one comes in (G-934)", () => {
    const { session, ui: u } = start();
    const day = gameDayOf(session.sim.domain.clock);
    setDomain(session, (d) => ({ ...d, flags: [...d.flags, tessenHuntFlag(day + TESSEN_HUNT.days)], reputation: { ...d.reputation, tessen: -60 } }));
    const squad = () => [...session.sim.world].filter((e) => e.security && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);
    const pushes = new Map<number, number>();
    const warned = () => {
      for (const t of u.getState().toasts) if (/Tessen is on your trail/.test(`${t.title} | ${t.text}`)) pushes.set(t.id, Math.max(pushes.get(t.id) ?? 0, t.count ?? 1));
      return [...pushes.values()].reduce((a, b) => a + b, 0);
    };
    const back = () => tessenSquadBack(session.sim.domain.flags);
    // The Trybunał's block: warned, the squad comes in, finds no way to her and goes back.
    teleport(session, 608, -5, 0);
    for (let s = 0; s < 60 && !back(); s++) {
      steps(session, SIM_HZ);
      warned();
    }
    expect(back()).not.toBeNull();
    expect(warned()).toBe(1);
    // A game minute before the stretch's end; the clock takes it on in a second.
    const stretch = TESSEN_HUNT.everyHours * SECONDS_PER_HOUR;
    setDomain(session, (d) => ({ ...d, clock: { ...d.clock, seconds: d.clock.seconds - (d.clock.seconds % stretch) + stretch - 60 } }));
    steps(session, 3 * SIM_HZ);
    teleport(session, 575, -38, 0);
    let came = 0;
    for (let s = 1; s <= 60 && came === 0; s++) {
      steps(session, SIM_HZ);
      warned();
      if (squad().length > 0) came = s;
    }
    expect(back()).toBeNull();
    expect(warned()).toBe(2);
    expect(came).toBeGreaterThanOrEqual(TESSEN_HUNT.delayMinSeconds - 2);
  });

  it("in the clinic the squad on its way finds no entry: no warning again while she stays, a new one once she is out (G-937)", () => {
    const { session, ui: u } = start();
    const day = gameDayOf(session.sim.domain.clock);
    const stretch = TESSEN_HUNT.everyHours * SECONDS_PER_HOUR;
    // A game minute into the next stretch, so its tries fit in it.
    setDomain(session, (d) => ({
      ...d,
      flags: [...d.flags, tessenHuntFlag(day + TESSEN_HUNT.days)],
      reputation: { ...d.reputation, tessen: -60 },
      clock: { ...d.clock, seconds: d.clock.seconds - (d.clock.seconds % stretch) + stretch + 60 },
    }));
    const squad = () => [...session.sim.world].filter((e) => e.security && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);
    const pushes = new Map<number, number>();
    const warned = () => {
      for (const t of u.getState().toasts) if (/Tessen is on your trail/.test(`${t.title} | ${t.text}`)) pushes.set(t.id, Math.max(pushes.get(t.id) ?? 0, t.count ?? 1));
      return [...pushes.values()].reduce((a, b) => a + b, 0);
    };
    const due = () => tessenSquadDue(session.sim.domain.flags);
    const second = (n = 1) => {
      steps(session, n * SIM_HZ);
      warned();
    };
    const startStretch = Math.floor(session.sim.domain.clock.seconds / stretch);
    // By the Rynek a squad is put on its way; in the clinic no entry is near for it (60 m).
    teleport(session, 575, -38, 0);
    for (let s = 0; s < 3 && !due(); s++) second();
    const first = due();
    expect(first).not.toBeNull();
    teleport(session, CLINIC_WAKE_SPOT.x, CLINIC_WAKE_SPOT.z, 0, 0, CLINIC_WAKE_SPOT.y);
    while (due()) second();
    expect(session.sim.tick).toBeGreaterThanOrEqual(first!.tick + TESSEN_SQUAD_LATE_SECONDS * SIM_HZ);
    // Gone, and she stays: no try comes, none of the entries near is for it.
    second(5);
    expect(due()).toBeNull();
    expect(warned()).toBe(1);
    // Out of it, the roll's next try warns her anew.
    teleport(session, 575, -38, 0);
    second();
    expect(due()).not.toBeNull();
    expect(due()!.flag).not.toBe(first!.flag);
    expect(warned()).toBe(2);
    expect(squad()).toEqual([]);
    expect(Math.floor(session.sim.domain.clock.seconds / stretch)).toBe(startStretch);
  });
});
