import { type MicroEventKind, SECONDS_PER_HOUR, STREET_CRIME_SLOT_HOURS, crimeSlot, streetCrimesAt, streetDistrusts } from "@seki/core";
import { type BoardCrime, Simulation, crimeBoard, ground, nextCrime } from "../src";
import { collect, run, teleportPlayer } from "./helpers";

/** Scenes of the street's crime tests (ADR-0034, ADR-0091 stage 5): a crime of the board in the Old Town. */

/** After the prologue (Kaito met), at `hour`, with the civilians' standing at `civilians`. */
export const street = (hour: number, seed = 6, civilians = 0): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "t", "");
  const reputation = { ...snap.domain.reputation, civilians };
  const clock = { seconds: hour * SECONDS_PER_HOUR };
  // The street's board (ADR-0091 stage 5) done for the day: these scenes are the encounters' alone.
  const distrusted = streetDistrusts(civilians);
  const done = Array.from({ length: 6 }, (_, k) => crimeBoard(seed, crimeSlot(clock) + k, distrusted).map((c) => c.id)).flat().sort();
  const streetCrimes = { ...streetCrimesAt(clock), done };
  const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation, flags: ["met_fixer"], clock, streetCrimes } });
  run(sim, 1);
  return sim;
};

/** By Brama Krakowska, inside the Old Town: the spot of the street's scenes before the board. */
export const BY_THE_GATE = { x: 528, z: -58 } as const;

/** In Brama Krakowska: where the player came from into those scenes. */
export const IN_THE_GATE = { x: 497, z: -79 } as const;

/**
 * At the start of the first board at `hour`'s hours (of the first day or a later one) whose Old
 * Town has a crime of `kind` (at `spot` when given; the board's other crimes done), with the civilians at `civilians`:
 * the player comes 30 m south of it, and it starts. The events of the step on are collected.
 */
export const enterKanal = (
  kind: MicroEventKind,
  seed = 13,
  civilians = 0,
  hour = 21,
  spot?: { readonly x: number; readonly z: number },
  /** Where the player comes from instead of 30 m south of it: in Brama Krakowska, as the scenes before the board had it. */
  from?: { readonly x: number; readonly z: number },
) => {
  const distrusted = streetDistrusts(civilians);
  const at = (c: BoardCrime) => !spot || Math.hypot(c.at.x - spot.x, c.at.z - spot.z) < 3;
  // The same hours of a later day (a board every 4 hours, six a day): the residents' plans of the day stand as at `hour`.
  const first = crimeSlot({ seconds: hour * SECONDS_PER_HOUR });
  const sameHours = (c: BoardCrime) => (Number(c.id.split(":")[1]) - first) % (24 / STREET_CRIME_SLOT_HOURS) === 0;
  const found = nextCrime(seed, first, (c) => c.kind === kind && c.district === "kanal" && at(c) && sameHours(c), distrusted)!;
  const crime: BoardCrime = found.crime;
  const snap = Simulation.create({ seed }).snapshot(null, "t", "");
  const reputation = { ...snap.domain.reputation, civilians };
  // `hour` itself on that day, a minute in: the residents stand where they did at it.
  const slotSeconds = STREET_CRIME_SLOT_HOURS * SECONDS_PER_HOUR;
  const clock = { seconds: found.slot * slotSeconds + (hour * SECONDS_PER_HOUR - first * slotSeconds) + 60 };
  const done = crimeBoard(seed, found.slot, distrusted)
    .filter((c) => c.id !== crime.id)
    .map((c) => c.id)
    .sort();
  const streetCrimes = { ...streetCrimesAt(clock), done };
  const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation, flags: ["met_fixer"], clock, streetCrimes } });
  run(sim, 1);
  const started = collect<{ encounterId: string; npcId: number }>(sim, "EncounterStarted");
  const ended = collect<{ encounterId: string; outcome: string }>(sim, "EncounterEnded");
  teleportPlayer(sim, from ? ground(from.x, from.z) : ground(crime.at.x, crime.at.z - 30));
  sim.step();
  return { sim, started, ended, crime };
};
