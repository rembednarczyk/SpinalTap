import { MICRO_EVENT_CHANCE, SECONDS_PER_HOUR } from "@seki/core";
import { Simulation, deriveRandom, ground } from "../src";
import { collect, run, teleportPlayer } from "./helpers";

/** Scenes of the micro-event tests (ADR-0034): a mugging or an aid by Brama Krakowska. */

/** After the prologue (Kaito met), at `hour`. */
export const street = (hour: number, seed = 6): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, flags: ["met_fixer"], clock: { seconds: hour * SECONDS_PER_HOUR } } });
  run(sim, 1);
  return sim;
};

/** The first tick from `from` whose micro-event roll starts one of `kind`. */
const tickFor = (seed: number, from: number, kind: "mugging" | "aid"): number => {
  for (let t = from; ; t++) {
    const r = deriveRandom(seed, `micro:${t}`);
    const roll = r.next();
    const mugging = r.next() < 0.6;
    if (roll < MICRO_EVENT_CHANCE && mugging === (kind === "mugging")) return t;
  }
};

/** Walks from Krakowskie through Brama Krakowska into the Old Town on the step whose roll starts `kind`. */
export const enterKanal = (kind: "mugging" | "aid", seed = 13) => {
  const sim = street(21, seed);
  teleportPlayer(sim, ground(450, -96));
  run(sim, 2);
  const t = tickFor(sim.seed, sim.tick + 1, kind);
  while (sim.tick < t) sim.step();
  const started = collect<{ encounterId: string; npcId: number }>(sim, "EncounterStarted");
  const ended = collect<{ encounterId: string; outcome: string }>(sim, "EncounterEnded");
  teleportPlayer(sim, ground(497, -79));
  sim.step();
  return { sim, started, ended };
};
