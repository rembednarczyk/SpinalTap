import { describe, expect, it } from "vitest";
import { CRIME_GETAWAY_SECONDS, GRUDGE_STEP, QUIET_DEAL_BONUS, SECONDS_PER_HOUR, bandLevel, crimeSlot, standingOf, streetCrimePay, streetCrimesAt } from "@seki/core";
import { type BoardCrime, DISTRICT_BANDS, type Entity, SIM_HZ, Simulation, crimeBoard, ground, inBuilding } from "../src";
import { GETAWAY_LEAVE_SECONDS, vanPlace } from "../src/world/crime-scenes";
import { run, teleportPlayer } from "./helpers";

/*
 * The crimes of ADR-0091 stage 5b: a deal by a crate (taken down with no dealer alerted it pays
 * half again), a drone two thieves break into (it flies off after 60 s), a kidnap by a van (it
 * drives off with the victim after 45 s). Their thing of the street goes with them.
 */

const HOUR = 13;
const SLOT = crimeSlot({ seconds: HOUR * SECONDS_PER_HOUR });

/** The first seed whose board at 13:00 has a crime of `kind` outside the docks (no gang holds them). */
const find = (kind: BoardCrime["kind"]): { seed: number; crime: BoardCrime } => {
  for (let seed = 1; ; seed++) {
    const crime = crimeBoard(seed, SLOT).find((c) => c.kind === kind && c.district !== "doki");
    if (crime) return { seed, crime };
  }
};

const street = (seed: number): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "t", "");
  const clock = { seconds: HOUR * SECONDS_PER_HOUR };
  const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, flags: ["met_fixer"], clock, streetCrimes: streetCrimesAt(clock) } });
  run(sim, 1);
  return sim;
};

/** At 30 m of the crime, where it starts. */
const started = (kind: BoardCrime["kind"]) => {
  const { seed, crime } = find(kind);
  const sim = street(seed);
  teleportPlayer(sim, ground(crime.at.x, crime.at.z - 30), 0);
  run(sim, 2);
  const r = sim.session.street2.micro!;
  expect(r.crime?.id).toBe(crime.id);
  return { sim, crime, run: r };
};

/** What Tessen pays for the crime at its district's level, the first of the day. */
const stake = (sim: Simulation, c: BoardCrime): number =>
  streetCrimePay(c.kind, bandLevel(sim.domain.progression.level, DISTRICT_BANDS[c.district]), 0, sim.domain.reputation.tessen);

const byId = (sim: Simulation, id: number): Entity | undefined => [...sim.world].find((e) => e.id === id);

/** Every one of the gang down at the player's hand, none alerted first. */
const takeDown = (sim: Simulation, ids: readonly number[]): void => {
  for (const id of ids) {
    const e = byId(sim, id)!;
    e.health = { ...e.health!, current: 0 };
    e.lastHitBy = sim.player()!.id;
  }
};

/** The run's clock moved `seconds` back: as if it started that long ago. */
const age = (sim: Simulation, seconds: number): void => {
  const r = sim.session.street2.micro!;
  sim.session.street2.micro = { ...r, since: sim.tick - Math.round(seconds * SIM_HZ) };
};

describe("the crimes round a thing of the street (ADR-0091 stage 5b)", () => {
  it("draws all six kinds on the boards of a day", () => {
    const kinds = new Set(Array.from({ length: 6 }, (_, s) => crimeBoard(6, SLOT + s).map((c) => c.kind)).flat());
    expect([...kinds].sort()).toEqual(["aid", "deal", "droneTheft", "extortion", "kidnap", "mugging"]);
  });

  it("pays a deal taken down quietly half again, and its crate goes with it; the district's gang holds it against her", () => {
    const { sim, crime, run: r } = started("deal");
    expect(r.victim).toBeNull();
    expect(r.attackers).toHaveLength(3);
    expect(r.props).toHaveLength(1);
    const crate = byId(sim, r.props![0]!)!;
    for (const id of r.attackers) expect(Math.hypot(byId(sim, id)!.position.x - crate.position.x, byId(sim, id)!.position.z - crate.position.z)).toBeCloseTo(1.3, 1);
    const eddies = sim.domain.wallet.eddies;
    const pay = stake(sim, crime);
    takeDown(sim, r.attackers);
    run(sim, 2);
    expect(sim.session.street2.micro?.crime?.id).not.toBe(crime.id);
    expect(sim.domain.wallet.eddies - eddies).toBe(Math.round(pay * (1 + QUIET_DEAL_BONUS)));
    expect(byId(sim, crate.id)).toBeUndefined();
    expect(standingOf(sim.domain.gangStandings, "hebi", crime.district).grudge).toBeGreaterThanOrEqual(GRUDGE_STEP.foil);
  });

  it("pays a deal with a dealer alerted only its stake", () => {
    const { sim, crime, run: r } = started("deal");
    const one = byId(sim, r.attackers[0]!)!;
    one.ai = { ...one.ai!, alerted: true };
    run(sim, 1);
    const eddies = sim.domain.wallet.eddies;
    const pay = stake(sim, crime);
    takeDown(sim, r.attackers);
    run(sim, 2);
    expect(sim.domain.wallet.eddies - eddies).toBe(pay);
  });

  it("loses the drone once its 60 s ran out: it rises, then the crime is over and done, unpaid", () => {
    const { sim, crime, run: r } = started("droneTheft");
    expect(r.victim).toBeNull();
    expect(r.attackers).toHaveLength(2);
    const drone = byId(sim, r.props![0]!)!;
    const y0 = drone.position.y;
    const eddies = sim.domain.wallet.eddies;
    age(sim, CRIME_GETAWAY_SECONDS.droneTheft - 1);
    run(sim, SIM_HZ / 2);
    expect(sim.session.street2.micro).not.toBeNull();
    expect(drone.position.y).toBe(y0);
    run(sim, SIM_HZ);
    expect(drone.position.y).toBeGreaterThan(y0 + 0.5);
    run(sim, GETAWAY_LEAVE_SECONDS * SIM_HZ);
    expect(sim.session.street2.micro?.crime?.id).not.toBe(crime.id);
    expect(byId(sim, drone.id)).toBeUndefined();
    expect(sim.domain.streetCrimes.done).toEqual([crime.id]);
    expect(sim.domain.wallet.eddies).toBe(eddies);
  });

  it("parks the kidnappers' van clear of the buildings, and drives it off with the victim after 45 s", () => {
    const { sim, crime, run: r } = started("kidnap");
    expect(r.attackers).toHaveLength(2);
    expect(r.victim).not.toBeNull();
    const van = r.props!.map((id) => byId(sim, id)!)[0];
    const place = vanPlace(crime.at);
    if (place) {
      expect(van?.view?.kind).toBe("vehicle");
      expect(inBuilding(van!.position.x, van!.position.z)).toBe(false);
    } else expect(van).toBeUndefined();
    age(sim, CRIME_GETAWAY_SECONDS.kidnap);
    run(sim, 2);
    expect(byId(sim, r.victim!)).toBeUndefined();
    run(sim, GETAWAY_LEAVE_SECONDS * SIM_HZ);
    expect(sim.session.street2.micro?.crime?.id).not.toBe(crime.id);
    expect(sim.domain.streetCrimes.done).toEqual([crime.id]);
    expect(sim.domain.streetCrimes.paidToday).toBe(0);
  });

  it("pays a kidnap foiled in time, and the victim stays", () => {
    const { sim, crime, run: r } = started("kidnap");
    const eddies = sim.domain.wallet.eddies;
    takeDown(sim, r.attackers);
    run(sim, 2);
    expect(sim.domain.streetCrimes.done).toEqual([crime.id]);
    expect(sim.domain.wallet.eddies - eddies).toBe(stake(sim, crime));
    expect(byId(sim, r.victim!)?.health?.current).toBeGreaterThan(0);
  });

  it("takes its thing away when she walks off", () => {
    const { sim, crime, run: r } = started("droneTheft");
    teleportPlayer(sim, ground(crime.at.x, crime.at.z - 120), 0);
    run(sim, 2);
    expect(sim.session.street2.micro?.crime?.id).not.toBe(crime.id);
    expect(byId(sim, r.props![0]!)).toBeUndefined();
    expect(sim.domain.streetCrimes.done).toEqual([]);
  });
});
