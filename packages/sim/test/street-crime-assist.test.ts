import { describe, expect, it } from "vitest";
import {
  ASSIST_SECONDS,
  ASSIST_STANDING,
  CRIME_GETAWAY_SECONDS,
  GRUDGE_STEP,
  SECONDS_PER_HOUR,
  TESSEN_FOIL_STANDING,
  assistPay,
  bandLevel,
  crimeSlot,
  gangStandingKey,
  standingOf,
  streetCrimesAt,
} from "@seki/core";
import { type BoardCrime, DISTRICT_BANDS, type Entity, SIM_HZ, Simulation, crimeBoard, ground } from "../src";
import { GETAWAY_LEAVE_SECONDS } from "../src/world/crime-scenes";
import { run, teleportPlayer } from "./helpers";

/*
 * The gang's side of the street's crimes (ADR-0091 stage 5c, dark jobs): one of a gang's crime in
 * progress offers the player the lookout's part; taken, she keeps watch near it until it is done,
 * the gang pays, likes her better and holds less against her in the district, Tessen and the street
 * think less of her. Going for them turns it into the fight of the foiling side, which the gang
 * holding the district takes badly (+8).
 */

const HOUR = 13;
const SLOT = crimeSlot({ seconds: HOUR * SECONDS_PER_HOUR });
const GRUDGE = 30;

/** The first seed whose board at 13:00 has a crime of `kind` in a district a gang holds (not the docks). */
const find = (kind: BoardCrime["kind"]): { seed: number; crime: BoardCrime } => {
  for (let seed = 1; ; seed++) {
    const crime = crimeBoard(seed, SLOT).find((c) => c.kind === kind && c.district !== "doki");
    if (crime) return { seed, crime };
  }
};

/** After the prologue, at 13:00, the gang holding a grudge of `GRUDGE` in the crime's district; at 30 m of the crime, where it starts. */
const started = (kind: BoardCrime["kind"]) => {
  const { seed, crime } = find(kind);
  const snap = Simulation.create({ seed }).snapshot(null, "t", "");
  const clock = { seconds: HOUR * SECONDS_PER_HOUR };
  const gangStandings = { [gangStandingKey("hebi", crime.district)]: { grudge: GRUDGE, provokedUntil: null } };
  const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, flags: ["met_fixer"], clock, streetCrimes: streetCrimesAt(clock), gangStandings } });
  run(sim, 1);
  teleportPlayer(sim, ground(crime.at.x, crime.at.z - 30), 0);
  run(sim, 2);
  const r = sim.session.street2.micro!;
  expect(r.crime.id).toBe(crime.id);
  return { sim, crime, run: r };
};

const byId = (sim: Simulation, id: number): Entity | undefined => [...sim.world].find((e) => e.id === id);

/** The gang's pay for the crime at its district's level, the first of the day. */
const gangPay = (sim: Simulation, c: BoardCrime): number =>
  assistPay(c.kind as keyof typeof ASSIST_SECONDS, bandLevel(sim.domain.progression.level, DISTRICT_BANDS[c.district]), 0);

/** The player takes the offer, then stands 5 m from the crime. */
const takeJob = (sim: Simulation, c: BoardCrime): void => {
  sim.enqueue({ type: "assist-street-crime" });
  run(sim, 1);
  teleportPlayer(sim, ground(c.at.x, c.at.z - 5), 0);
};

describe("the gang's side of the street's crimes (ADR-0091 stage 5c)", () => {
  it("lets her walk up to a gang's crime: its people tolerate her and the first offers the job", () => {
    const { sim, crime, run: r } = started("extortion");
    const lead = byId(sim, r.attackers[0]!)!;
    expect(lead.interactable).toMatchObject({ kind: "dialogue", dialogueId: "crime_assist_extortion", prompt: "prompt.crime.talk" });
    for (const id of r.attackers) expect(byId(sim, id)!.ai!.crime).toBe(crime.district);
    // Standing 5 m off for 5 s: nobody goes for her.
    teleportPlayer(sim, ground(crime.at.x, crime.at.z - 5), 0);
    const hp = sim.player()!.health!.current;
    run(sim, 5 * SIM_HZ);
    for (const id of r.attackers) expect(byId(sim, id)!.ai!.alerted ?? false).toBe(false);
    expect(sim.player()!.health!.current).toBeGreaterThanOrEqual(hp);
  });

  it("pays a squeeze she kept watch over: the gang's stake, Hebi +3, its grudge in the district −10, Tessen and the street −3", () => {
    const { sim, crime, run: r } = started("extortion");
    const before = { eddies: sim.domain.wallet.eddies, rep: sim.domain.reputation };
    const pay = gangPay(sim, crime);
    takeJob(sim, crime);
    expect(sim.session.street2.micro?.side).toBe("assist");
    expect(byId(sim, r.attackers[0]!)!.interactable).toBeUndefined();
    // The squeezed one pays: nobody goes for it.
    for (const id of r.attackers) expect(byId(sim, id)!.ai!.victim).toBeUndefined();
    run(sim, (ASSIST_SECONDS.extortion - 1) * SIM_HZ);
    expect(sim.session.street2.micro?.crime.id).toBe(crime.id);
    run(sim, 2 * SIM_HZ);
    expect(sim.session.street2.micro?.crime.id).not.toBe(crime.id);
    expect(sim.domain.wallet.eddies - before.eddies).toBe(pay);
    expect(sim.domain.reputation.hebi - before.rep.hebi).toBe(ASSIST_STANDING.gang);
    expect(sim.domain.reputation.tessen - before.rep.tessen).toBe(ASSIST_STANDING.tessen);
    expect(sim.domain.reputation.civilians - before.rep.civilians).toBe(ASSIST_STANDING.civilians);
    expect(standingOf(sim.domain.gangStandings, "hebi", crime.district).grudge).toBe(GRUDGE + GRUDGE_STEP.assist);
    expect(sim.domain.streetCrimes.done).toEqual([crime.id]);
    expect(sim.domain.streetCrimes.paidToday).toBe(1);
    expect(byId(sim, r.victim!)?.health?.current).toBeGreaterThan(0);
  });

  it("counts her watch only within reach: walked off to 40 m, the squeeze waits for her", () => {
    const { sim, crime } = started("extortion");
    takeJob(sim, crime);
    teleportPlayer(sim, ground(crime.at.x, crime.at.z - 40), 0);
    run(sim, (ASSIST_SECONDS.extortion + 5) * SIM_HZ);
    expect(sim.session.street2.micro?.crime.id).toBe(crime.id);
    expect(sim.session.street2.micro?.side).toBe("assist");
  });

  it("is done for the thieves when their drone is away, paid by the gang", () => {
    const { sim, crime } = started("droneTheft");
    const eddies = sim.domain.wallet.eddies;
    const pay = gangPay(sim, crime);
    takeJob(sim, crime);
    run(sim, (CRIME_GETAWAY_SECONDS.droneTheft + GETAWAY_LEAVE_SECONDS + 1) * SIM_HZ);
    expect(sim.session.street2.micro?.crime.id).not.toBe(crime.id);
    expect(sim.domain.wallet.eddies - eddies).toBe(pay);
    expect(sim.domain.streetCrimes.done).toEqual([crime.id]);
  });

  it("turns into a fight when she goes for one of them: the whole crew is on her, and stopping it is Tessen's job, +8 grudge", () => {
    const { sim, crime, run: r } = started("deal");
    takeJob(sim, crime);
    const one = byId(sim, r.attackers[0]!)!;
    one.ai = { ...one.ai!, alerted: true };
    run(sim, 1);
    expect(sim.session.street2.micro?.side).toBeUndefined();
    for (const id of r.attackers) expect(byId(sim, id)!.ai!.alerted).toBe(true);
    const tessen = sim.domain.reputation.tessen;
    for (const id of r.attackers) {
      const e = byId(sim, id)!;
      e.health = { ...e.health!, current: 0 };
      e.lastHitBy = sim.player()!.id;
    }
    run(sim, 2);
    expect(sim.session.street2.micro?.crime.id).not.toBe(crime.id);
    expect(sim.domain.reputation.tessen - tessen).toBe(TESSEN_FOIL_STANDING);
    // The dealers' deaths are no assault on the street: no heat for stopping a crime.
    expect(sim.domain.heat.level).toBe(0);
    expect(standingOf(sim.domain.gangStandings, "hebi", crime.district).grudge).toBeGreaterThanOrEqual(GRUDGE + GRUDGE_STEP.foil);
  });

  it("offers nothing at a mugging: its muggers are no job for her", () => {
    const { sim, run: r } = started("mugging");
    for (const id of r.attackers) expect(byId(sim, id)!.interactable).toBeUndefined();
    sim.enqueue({ type: "assist-street-crime" });
    run(sim, 1);
    expect(sim.session.street2.micro?.side).toBeUndefined();
  });
});
