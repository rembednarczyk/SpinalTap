import { MICRO_EVENT_CHANCE, SECONDS_PER_HOUR } from "@seki/core";
import { Simulation, deriveRandom, ground } from "../src";
import { collect, run, teleportPlayer } from "./helpers";

/** Scenes of the micro-event tests (ADR-0034): a mugging or an aid by Brama Krakowska. */

/** After the prologue (Kaito met), at `hour`, with the civilians' standing at `civilians`. */
export const street = (hour: number, seed = 6, civilians = 0): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "t", "");
  const reputation = { ...snap.domain.reputation, civilians };
  const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, reputation, flags: ["met_fixer"], clock: { seconds: hour * SECONDS_PER_HOUR } } });
  run(sim, 1);
  return sim;
};

/** Where the micro-event roll has to fall: at or above `from`, below `below`. */
export interface RollBand {
  readonly from: number;
  readonly below: number;
}

/** The rolls that start a micro-event at any standing. */
const ALWAYS: RollBand = { from: 0, below: MICRO_EVENT_CHANCE };

/** The first tick from `from` whose micro-event roll falls in `band` and picks `kind`. */
const tickFor = (seed: number, from: number, kind: "mugging" | "aid", band: RollBand): number => {
  for (let t = from; ; t++) {
    const r = deriveRandom(seed, `micro:${t}`);
    const roll = r.next();
    const mugging = r.next() < 0.6;
    if (roll >= band.from && roll < band.below && mugging === (kind === "mugging")) return t;
  }
};

/** On Krakowskie, `sim` walks through Brama Krakowska into the Old Town on the step whose roll starts `kind` (falls in `band`). */
export const walkIntoKanal = (sim: Simulation, kind: "mugging" | "aid", band = ALWAYS) => {
  teleportPlayer(sim, ground(450, -96));
  run(sim, 2);
  const t = tickFor(sim.seed, sim.tick + 1, kind, band);
  while (sim.tick < t) sim.step();
  const started = collect<{ encounterId: string; npcId: number }>(sim, "EncounterStarted");
  const ended = collect<{ encounterId: string; outcome: string }>(sim, "EncounterEnded");
  teleportPlayer(sim, ground(497, -79));
  sim.step();
  return { sim, started, ended };
};

/** In the evening, with the civilians at `civilians`: into the Old Town on the step whose roll starts `kind`. */
export const enterKanal = (kind: "mugging" | "aid", seed = 13, civilians = 0, band = ALWAYS) => walkIntoKanal(street(21, seed, civilians), kind, band);
