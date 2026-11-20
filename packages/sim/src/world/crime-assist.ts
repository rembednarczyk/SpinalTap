import { ASSIST_SECONDS, ASSIST_WATCH, assistable } from "@seki/core";
import { SIM_HZ } from "../step-rate";
import type { Entity } from "./components";
import type { MicroEventRun, SimContext } from "./context";

/*
 * The gang's side of a street crime (ADR-0091 stage 5c, dark jobs; decision 8 of 18.11): one of a
 * gang's crime in progress (an extortion, a deal, a drone theft, a kidnapping) offers the player a
 * part in it ("Got a minute?", the knot `crime_assist_<kind>`); taken, its people go on with it and
 * she keeps watch within `ASSIST_WATCH` metres, as the lookout of the job. The extortion and the
 * deal are done after their seconds of her watch, the drone and the van when they are away. Going
 * for one of them (or one of them alerted) turns the job into a fight, as if she had never taken
 * it. The pattern is the gig of CP2077 with a lookout's objective ("keep watch", "wait for"):
 * a timed hold within an area, no new state in the save, since the crime's people are transient.
 */

const byId = (ctx: SimContext, id: number): Entity | undefined => [...ctx.world].find((e) => e.id === id);

/** The knot of the gang's offer in a crime of this kind. */
export const assistKnot = (kind: MicroEventRun["kind"]): string => `crime_assist_${kind}`;

/** The gang's people of a new crime: they tolerate her as the district's territory does, and the first offers the job. */
export const offerAssist = (ctx: SimContext, run: MicroEventRun): void => {
  if (!assistable(run.kind)) return;
  for (const id of run.attackers) {
    const e = byId(ctx, id);
    if (e?.ai) e.ai = { ...e.ai, crime: run.crime.district };
  }
  const lead = byId(ctx, run.attackers[0] ?? -1);
  if (lead) ctx.world.addComponent(lead, "interactable", { kind: "dialogue", dialogueId: assistKnot(run.kind), prompt: "prompt.crime.talk", radius: 2.2 });
};

/** Down, gone or alerted: the gang's job turned into a fight. */
const turned = (ctx: SimContext, run: MicroEventRun): boolean =>
  run.attackers.some((id) => {
    const e = byId(ctx, id);
    return !e || !!e.downed || e.ai?.alerted === true;
  });

/** Every one of the crew alerted at once: one going for her makes the rest (a tolerant one does not hear the shots). */
export const alertCrew = (ctx: SimContext, run: MicroEventRun): void => {
  for (const id of run.attackers) {
    const e = byId(ctx, id);
    if (e?.ai && !e.downed && !e.unconscious) e.ai.alerted = true;
  }
};

/** The offer goes once the job is taken or turned. */
const withdrawOffer = (ctx: SimContext, run: MicroEventRun): void => {
  const lead = byId(ctx, run.attackers[0] ?? -1);
  if (lead?.interactable) ctx.world.removeComponent(lead, "interactable");
};

/** A gang's crime the player went for: the whole crew fights, and no job is offered any more. */
export const crewTurned = (ctx: SimContext, run: MicroEventRun): boolean => {
  if (!assistable(run.kind) || !turned(ctx, run)) return false;
  alertCrew(ctx, run);
  withdrawOffer(ctx, run);
  return true;
};

/**
 * The `assist-street-crime` command (from the offer's dialogue): the running crime goes over to the
 * gang's side, unless it is no gang's or has turned to a fight. The extortion's people let their
 * victim be: it pays, so nobody goes for it.
 */
export const assistStreetCrime = (ctx: SimContext): void => {
  const run = ctx.session.street2.micro;
  if (!run || run.side === "assist" || !assistable(run.kind) || turned(ctx, run)) return;
  for (const id of run.attackers) {
    const e = byId(ctx, id);
    if (e?.ai?.victim !== undefined) {
      const { victim: _victim, ...ai } = e.ai;
      e.ai = ai;
    }
  }
  withdrawOffer(ctx, run);
  ctx.session.street2.micro = { ...run, side: "assist", watched: 0 };
};

/**
 * One step of a job taken for the gang: "done" once her watch is over (the extortion, the deal),
 * "turned" when she went for them, else null. The drone and the van are done by their getaway.
 */
export const assistStep = (ctx: SimContext, run: MicroEventRun, player: Entity): "done" | "turned" | null => {
  if (turned(ctx, run)) return "turned";
  if (!assistable(run.kind) || run.kind === "droneTheft" || run.kind === "kidnap") return null;
  const near = Math.hypot(player.position.x - run.at.x, player.position.z - run.at.z) <= ASSIST_WATCH;
  const watched = (run.watched ?? 0) + (near ? 1 : 0);
  if (watched >= ASSIST_SECONDS[run.kind] * SIM_HZ) return "done";
  ctx.session.street2.micro = { ...run, watched };
  return null;
};
