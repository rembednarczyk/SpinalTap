import { describe, expect, it } from "vitest";
import {
  type AudioCue,
  type DomainState,
  type EffectDescriptor,
  SABOTAGE_LOUD,
  TESSEN_HUNT,
  type W3StationId,
  contractAlarmFlag,
  contractObjective,
  contractSecondsLeft,
  contractTag,
  gameDayOf,
  stationDownFlag,
  tessenHuntUntil,
} from "@seki/core";
import { GENZO_SPOT, SIM_HZ, W3_CORE_BLIND_SPOT, W3_STATION_SPOTS, W3_VIRUS_TERMINAL, W3_Y, stateHash, stationChargeAt } from "@seki/sim";
import { translateText } from "@seki/ui";
import { frame, setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";
import { SIREN_PERIOD } from "../src/presenters/w3-mission";

/**
 * W-3's sabotage, the loud way, in a session, headless (ADR-0082 stage 3b): the charges' case in
 * armoury S raises the alarm (its klaxon, the siren while it lasts) and the toast of the way cut
 * off, three charges on the line, the blast out of the hall as explosions over the stations, their
 * sound and the wrecks (stage 3c), out of the zone Genzō pays the loud rate and Tessen hunts her;
 * the alarm during the upload turns the job loud; a save with the fuse running loads to the same
 * state; a load after the blast shows the wrecks again from the flags, without a blast.
 */

type Ui = ReturnType<typeof setup>["ui"];
const step = (session: GameSession): string => {
  const c = session.sim.domain.contracts.active;
  return c ? translateText("pl", contractObjective(c, contractSecondsLeft(c, session.sim.tick, SIM_HZ))) : "";
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
    // The siren wails while the alarm lasts and she is in the zone, a wail a period.
    const wails = count("alarm-siren");
    steps(session, Math.round(2 * SIREN_PERIOD * SIM_HZ) + 1);
    expect(count("alarm-siren") - wails).toBeGreaterThanOrEqual(1);
    expect(step(session)).toContain("Podłóż ładunki na stanowiskach linii (0/3");
    plant(session, job.id, "S1");
    expect(step(session)).toContain("(1/3");
    plant(session, job.id, "S2");
    plant(session, job.id, "S4");
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
});
