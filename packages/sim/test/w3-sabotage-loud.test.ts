import { describe, expect, it } from "vitest";
import {
  type Contract,
  type DomainState,
  SABOTAGE_LOUD,
  type SaveSnapshot,
  TESSEN_HUNT,
  type W3StationId,
  contractAlarmFlag,
  contractObjective,
  contractSecondsLeft,
  contractTag,
  gameDayOf,
  sabotagePay,
  secondWaveFlag,
  stationDownFlag,
  tessenHuntFlag,
  tessenHuntUntil,
} from "@seki/core";
import { CLINIC_WAKE_SPOT, SIM_HZ, Simulation, W3_CORE_BLIND_SPOT, W3_STATION_SPOTS, W3_TECHNICIANS, W3_VIRUS_TERMINAL, ground, stateHash, w3 } from "../src";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

/**
 * W-3's sabotage, the loud way (ADR-0082 §1 "Droga głośna", stage 3b), stepped headless: the
 * charges taken from armoury S raise the alarm and bring the waves, three planted on the line in
 * 2.5 s each light the fuse, leaving the hall blows the line, out of the zone Genzō pays the loud
 * rate and Tessen hunts her in the city; the alarm before the virus turns the quiet way loud; the
 * line's technicians report her; a save with two charges and with the fuse running loads the same.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
/** A save as the game makes it: the street's and the technicians' fright settled first (G-240). */
const reload = (sim: Simulation): Simulation => {
  sim.calmForSave();
  return Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "mid", "")));
};
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
type Holder = { holder: { domain: DomainState } };
const setDomain = (sim: Simulation, change: (d: DomainState) => DomainState): void => {
  const holder = (sim as unknown as Holder).holder;
  holder.domain = change(holder.domain);
};
const active = (sim: Simulation) => sim.domain.contracts.active;

const accept = (sim: Simulation): Contract => {
  teleportPlayer(sim, W3_CORE_BLIND_SPOT, 0);
  sim.step();
  sim.enqueue({ type: "accept-contract", kind: "sabotage" });
  sim.step();
  const c = active(sim);
  if (c?.kind !== "sabotage") throw new Error("no sabotage");
  return c;
};
const crew = (sim: Simulation, c: Contract) => [...sim.world].filter((e) => e.tag === contractTag(c.id) && (e.health?.current ?? 0) > 0);
/** The job's guards out of the way, waves included (the loud way's own rules, nobody shooting). */
const knockOut = (sim: Simulation, c: Contract) => {
  for (const e of crew(sim, c)) e.health = { current: 0, max: e.health!.max };
  sim.step();
};
const technicians = (sim: Simulation) => [...sim.world].filter((e) => e.staff);
/** In armoury S facing the charges' case on its stand. */
const atCase = (sim: Simulation) => teleportPlayer(sim, w3(2555, 0, 402), Math.PI);
/** On the aisle by a station, facing it. */
const atStation = (sim: Simulation, s: W3StationId) => {
  const p = W3_STATION_SPOTS[s];
  const north = s === "S3" || s === "S4";
  teleportPlayer(sim, w3(p.x, 0, p.z + (north ? -0.4 : 0.4)), north ? 0 : Math.PI);
};
const takeCharges = (sim: Simulation, c: Contract) => {
  knockOut(sim, c);
  atCase(sim);
  sim.step();
  sim.step(input({ interact: true }));
  knockOut(sim, c);
};
const plant = (sim: Simulation, c: Contract, s: W3StationId) => {
  atStation(sim, s);
  sim.step();
  sim.step(input({ interact: true }));
  run(sim, Math.round(SABOTAGE_LOUD.plantSeconds * SIM_HZ) + 1);
  knockOut(sim, c);
};

describe("W-3's sabotage, the loud way (ADR-0082 stage 3b)", () => {
  it("the charges' case raises the alarm whatever was before: the job turns loud and three men come in at once, three more a minute later", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    const routes = collect<{ route: string }>(sim, "SabotageRouteChosen");
    knockOut(sim, c);
    expect(sim.domain.flags).not.toContain(contractAlarmFlag(c.id));
    atCase(sim);
    sim.step();
    sim.step(input({ interact: true }));
    expect(sim.domain.flags).toContain(contractAlarmFlag(c.id));
    expect(active(sim)).toMatchObject({ route: "loud", charges: [] });
    expect(routes.map((r) => r.route)).toEqual(["loud"]);
    expect(crew(sim, c)).toHaveLength(3);
    expect(crew(sim, c).every((g) => g.ai?.alerted)).toBe(true);
    knockOut(sim, c);
    run(sim, SABOTAGE_LOUD.secondWaveSeconds * SIM_HZ - 5);
    expect(crew(sim, c)).toHaveLength(0);
    run(sim, 10);
    expect(sim.domain.flags).toContain(secondWaveFlag(c.id));
    expect(crew(sim, c)).toHaveLength(3);
    // The case is gone, its charges in her bag: the objective counts them on the line.
    expect(byKey(sim, `${c.id}-charges`)).toBeUndefined();
    expect(contractObjective(active(sim)!, null).params).toMatchObject({ planted: 0, needed: 3 });
    // The arms chest by it opens too (16.11: its loot counts): an AR-5, 5.56 and a medkit, kept for good.
    const chest = sim.domain.loot.containers.find((l) => l.key === `stash:w3-armoury-${c.id}`);
    expect(chest?.lines.map((l) => (l.kind === "item" || l.kind === "stack" ? l.item : l.kind))).toEqual(["tessen_ar5", "ammo", "medkit"]);
    expect(chest?.expiresAtTick).toBe(Number.MAX_SAFE_INTEGER);
    expect([...sim.world].some((e) => e.lootBag?.key === chest?.key)).toBe(true);
  });

  it("the alarm during the upload cuts the server room off and turns the job loud; the upload stops, paused", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    knockOut(sim, c);
    const uploads = collect<{ progress: number; paused: boolean }>(sim, "VirusUploadChanged");
    const routes = collect<{ route: string }>(sim, "SabotageRouteChosen");
    teleportPlayer(sim, W3_CORE_BLIND_SPOT, Math.atan2(W3_VIRUS_TERMINAL.x - W3_CORE_BLIND_SPOT.x, W3_VIRUS_TERMINAL.z - W3_CORE_BLIND_SPOT.z));
    sim.step(input({ interact: true }));
    run(sim, 10 * SIM_HZ);
    expect(uploads.filter((u) => !u.paused).length).toBeGreaterThanOrEqual(10);
    setDomain(sim, (d) => ({ ...d, flags: [...d.flags, contractAlarmFlag(c.id)] }));
    run(sim, 2 * SIM_HZ);
    expect(routes.map((r) => r.route)).toEqual(["quiet", "loud"]);
    expect(active(sim)).toMatchObject({ route: "loud" });
    expect(uploads.at(-1)).toMatchObject({ paused: true });
    const job = active(sim)!;
    expect(contractObjective(job, contractSecondsLeft(job, sim.tick, SIM_HZ)).key).toBe("contract.objective.sabotageCutOffTimed");
    // The switch is no failure: the clock to 06:00 still runs, the loud way is open.
    expect(job.status).toBe("active");
  });

  it("a charge takes 2.5 s by its station, a hit starts it over, the third lights the 60 s fuse", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    takeCharges(sim, c);
    atStation(sim, "S1");
    sim.step();
    sim.step(input({ interact: true }));
    run(sim, SIM_HZ);
    expect(active(sim)?.planting).toMatchObject({ station: "S1" });
    const me = sim.player()!;
    me.health = { ...me.health!, current: me.health!.current - 5 };
    sim.step();
    expect(active(sim)?.planting).toBeUndefined();
    expect(active(sim)?.charges).toEqual([]);
    sim.step(input({ interact: true }));
    run(sim, Math.round(SABOTAGE_LOUD.plantSeconds * SIM_HZ) + 1);
    expect(active(sim)?.charges).toEqual(["S1"]);
    expect(byKey(sim, `${c.id}-charge-S1`)?.view?.kind).toBe("block");
    plant(sim, c, "S2");
    expect(active(sim)?.fuseTick).toBeUndefined();
    plant(sim, c, "S3");
    const job = active(sim)!;
    expect(job.charges).toEqual(["S1", "S2", "S3"]);
    expect(job.fuseTick! - sim.tick).toBeGreaterThan((SABOTAGE_LOUD.fuseSeconds - 2) * SIM_HZ);
    // The fourth station takes no charge: three is all she has.
    atStation(sim, "S4");
    sim.step();
    sim.step(input({ interact: true }));
    expect(active(sim)?.planting).toBeUndefined();
  });

  it("out of the hall the line blows: wrecks, the technicians by it hurt; out of the zone the loud rate, Tessen at -60 and the hunt for three days", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    takeCharges(sim, c);
    for (const s of ["S1", "S2", "S3"] as const) plant(sim, c, s);
    const hurt = collect<{ targetId: number; amount: number }>(sim, "DamageDealt");
    const techs = technicians(sim).map((t) => t.id);
    // The east yard: in the zone, out of the hall.
    teleportPlayer(sim, w3(2585, 0, 415), 0);
    sim.step();
    expect(active(sim)).toMatchObject({ detonated: true, status: "active" });
    for (const s of ["S1", "S2", "S3"] as const) expect(sim.domain.flags).toContain(stationDownFlag(s));
    expect(sim.domain.flags).not.toContain(stationDownFlag("S4"));
    expect(byKey(sim, `${c.id}-wreck-S2`)?.view?.kind).toBe("block");
    expect(byKey(sim, `${c.id}-charge-S2`)).toBeUndefined();
    expect(hurt.some((h) => techs.includes(h.targetId) && h.amount > 0 && h.amount < 60)).toBe(true);
    // Seki is far beyond the blast.
    expect(hurt.some((h) => h.targetId === sim.player()!.id)).toBe(false);
    expect(contractObjective(active(sim)!, null).key).toBe("contract.objective.sabotageEscape");
    const before = sim.domain.wallet.eddies;
    const phone = collect<{ from: string }>(sim, "PhoneMessage");
    teleportPlayer(sim, ground(2527, 384), 0);
    sim.step();
    expect(active(sim)).toBeNull();
    expect(sim.domain.contracts.completed).toBe(1);
    expect(sim.domain.wallet.eddies - before).toBeGreaterThanOrEqual(sabotagePay({ ...c, route: "loud" }));
    expect(phone.some((m) => m.from === "genzo")).toBe(true);
    expect(sim.domain.reputation.tessen).toBeLessThanOrEqual(-60);
    expect(tessenHuntUntil(sim.domain.flags)).toBe(gameDayOf(sim.domain.clock) + TESSEN_HUNT.days);
  });

  it("the fuse runs out in the hall too: the charges go off at its tick", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    takeCharges(sim, c);
    for (const s of ["S1", "S3", "S4"] as const) plant(sim, c, s);
    // Over in the chamber, out of the blast's reach and line.
    teleportPlayer(sim, w3(2565, 0, 418), 0);
    const fuse = active(sim)!.fuseTick!;
    run(sim, fuse - sim.tick - 1);
    expect(active(sim)?.detonated).toBeUndefined();
    run(sim, 2);
    expect(active(sim)?.detonated).toBe(true);
    expect(sim.domain.flags).toContain(stationDownFlag("S4"));
  });

  it("a technician who sees her on the line without a disguise reports her after 2 s: the job's alarm, not the street's heat", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    knockOut(sim, c);
    const [tech] = W3_TECHNICIANS;
    // In front of the technician at S2, two metres off.
    teleportPlayer(sim, w3(tech!.at.x - 1.5, 0, 413.3), 0);
    run(sim, SIM_HZ);
    expect(sim.domain.flags).not.toContain(contractAlarmFlag(c.id));
    run(sim, 1.5 * SIM_HZ);
    expect(sim.domain.flags).toContain(contractAlarmFlag(c.id));
    expect(sim.domain.heat.level).toBe(0);

    const calm = Simulation.create({ seed: 3 });
    const d = accept(calm);
    knockOut(calm, d);
    for (const t of technicians(calm)) t.health = { current: 0, max: t.health!.max };
    teleportPlayer(calm, w3(tech!.at.x - 1.5, 0, 413.3), 0);
    run(calm, 4 * SIM_HZ);
    expect(calm.domain.flags).not.toContain(contractAlarmFlag(d.id));
  });

  it("a save with two charges planted, and one with the fuse running, load to the same state and go on the same", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    takeCharges(sim, c);
    plant(sim, c, "S1");
    plant(sim, c, "S2");
    for (const at of ["two", "fuse"]) {
      if (at === "fuse") plant(sim, c, "S4");
      const restored = reload(sim);
      expect(hash(restored)).toBe(hash(sim));
      expect(active(restored)).toEqual(active(sim));
      expect(byKey(restored, `${c.id}-charge-S2`)?.view?.kind).toBe("block");
      run(sim, 300);
      run(restored, 300);
      expect(hash(restored)).toBe(hash(sim));
    }
  });

  /** Saved in the step itself, loaded, and both stepped on: the same, step by step. */
  const sameAfter = (sim: Simulation, steps: number) => {
    const restored = reload(sim);
    for (let i = 0; i < steps; i++) {
      sim.step();
      restored.step();
      expect(hash(restored), `step ${i}`).toBe(hash(sim));
    }
  };

  it("a save in the step of the blast, or of a technician's report, goes on the same after a load (G-891)", () => {
    const sim = Simulation.create({ seed: 3 });
    const c = accept(sim);
    takeCharges(sim, c);
    for (const s of ["S1", "S2", "S3"] as const) plant(sim, c, s);
    teleportPlayer(sim, w3(2585, 0, 415), 0);
    sim.step();
    expect(active(sim)?.detonated).toBe(true);
    sameAfter(sim, 30);

    const seen = Simulation.create({ seed: 3 });
    const d = accept(seen);
    knockOut(seen, d);
    const [tech] = W3_TECHNICIANS;
    teleportPlayer(seen, w3(tech!.at.x - 1.5, 0, 413.3), 0);
    for (let i = 0; i < 4 * SIM_HZ && !seen.domain.flags.includes(contractAlarmFlag(d.id)); i++) seen.step();
    expect(seen.domain.flags).toContain(contractAlarmFlag(d.id));
    sameAfter(seen, 30);
  });

  it("Tessen's hunt: a squad of 2-3 comes in on Stare Miasto 45 m and more away, never by the clinic, one at a time; three days on it is over", () => {
    const sim = Simulation.create({ seed: 3 });
    const day = gameDayOf(sim.domain.clock);
    setDomain(sim, (d) => ({ ...d, flags: [...d.flags, tessenHuntFlag(day + TESSEN_HUNT.days)], reputation: { ...d.reputation, tessen: -60 } }));
    // The Rynek of Stare Miasto, in the day.
    teleportPlayer(sim, ground(600, 30), 0);
    run(sim, 3 * SIM_HZ);
    const squad = () => [...sim.world].filter((e) => e.security && e.enemy?.type === "tessen_guard" && (e.health?.current ?? 0) > 0);
    const first = squad();
    expect(first.length).toBeGreaterThanOrEqual(2);
    expect(first.length).toBeLessThanOrEqual(3);
    const me = sim.player()!.position;
    for (const g of first) {
      expect(Math.hypot(g.position.x - me.x, g.position.z - me.z)).toBeGreaterThan(TESSEN_HUNT.minDistance - 5);
      expect(Math.hypot(g.position.x - CLINIC_WAKE_SPOT.x, g.position.z - CLINIC_WAKE_SPOT.z)).toBeGreaterThan(TESSEN_HUNT.clinicClear - 5);
      expect(g.ai?.alerted).toBe(true);
    }
    // Another district while they are out: no second squad.
    teleportPlayer(sim, ground(300, -90), 0);
    run(sim, 3 * SIM_HZ);
    expect(squad().length).toBeLessThanOrEqual(first.length);
    // Three days on, the hunt is over and its flags gone.
    setDomain(sim, (d) => ({ ...d, clock: { ...d.clock, seconds: (day + TESSEN_HUNT.days) * 86_400 + 3600 } }));
    run(sim, 2);
    expect(tessenHuntUntil(sim.domain.flags)).toBeNull();
    expect(sim.domain.flags.some((f) => f.startsWith("tessen-hunt"))).toBe(false);
  });
});
