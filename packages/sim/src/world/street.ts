import {
  CONTRACT_KINDS,
  type Contract,
  type ContractGiverId,
  type BreachDaemonId,
  type ContractTally,
  type CrimeKind,
  type DisturbanceKind,
  type EntityId,
  type Vec3,
  contractKind,
  contractTag,
  freshTally,
} from "@seki/core";
import type { World } from "miniplex";
import type { Entity, HackEffects } from "./components";
import type { SimContext } from "./context";

/**
 * The street's log of the current step (ADR-0029): noise everybody may react to and the
 * player's crimes waiting for a witness. Filled by the systems where things happen (combat,
 * melee, death, hacks), read and emptied by the crime system at the end of the step.
 */

/** Something the street notices: emitted at once, reacted to by the crowd at the end of the step. */
export const disturb = (ctx: SimContext, kind: DisturbanceKind, at: Vec3, radius: number, sourceId: EntityId): void => {
  const p = { kind, at: { x: at.x, y: at.y, z: at.z }, radius, sourceId };
  ctx.session.street.disturbances.push(p);
  ctx.bus.emit("Disturbance", p);
};

/** The player did something that is a crime if a civilian, a camera or a patrol sees it. */
export const offend = (ctx: SimContext, crime: CrimeKind, at: Vec3): void => {
  const street = ctx.session.street;
  street.incidents += 1;
  street.offences.push({ crime, at: { x: at.x, y: at.y, z: at.z }, incident: street.incidents });
};

/** Seconds after an enemy's shot near the player during which the player's fire is self-defence. */
const THREAT_SECONDS = 3;
/** An enemy fighting the player this close makes the player's fire part of a fight, not a crime. */
const ENGAGE_RADIUS = 30;

/** Is this one fighting the player (or someone) right now? Hurting it then is no crime. */
export const isEngaged = (e: Entity): boolean => !!e.ai && (e.ai.alerted || !!e.ai.victim) || e.sniper?.phase === "aim";

/** Is the player in a fight: shot at lately, or an enemy close by fighting? */
export const playerEngaged = (ctx: SimContext, player: Entity): boolean => {
  const threat = ctx.session.lastThreat;
  if (threat && (ctx.tick - threat.tick) * ctx.dt <= THREAT_SECONDS) return true;
  for (const e of ctx.world.with("ai")) {
    if (isEngaged(e) && Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) <= ENGAGE_RADIUS) return true;
  }
  return false;
};

/**
 * The player hurt `target`. A civilian (anyone not fighting: no AI, or an AI that was not
 * engaged before the blow) makes it an assault; its death later is a murder.
 */
export const noteViolence = (ctx: SimContext, target: Entity, engagedBefore: boolean, at: Vec3): void => {
  if (engagedBefore || target.player) return;
  target.wronged = true;
  offend(ctx, "assault", at);
};

/** Updates the running contract's debrief counters (no-op without an active contract). */
export const noteTally = (ctx: SimContext, change: (t: ContractTally) => ContractTally): void => {
  const contract = ctx.state.domain.contracts.active;
  if (contract?.status !== "active") return;
  const log = ctx.state.domain.contracts;
  const before = log.tally ?? freshTally(ctx.tick);
  const tally = change(before);
  if (tally === before && log.tally) return;
  ctx.state.domain = { ...ctx.state.domain, contracts: { ...log, tally } };
};

export const noteDetected = (ctx: SimContext): void => noteTally(ctx, (t) => (t.detected ? t : { ...t, detected: true }));
export const noteAlarm = (ctx: SimContext): void => noteTally(ctx, (t) => (t.alarm ? t : { ...t, alarm: true }));
export const noteHacked = (ctx: SimContext): void => noteTally(ctx, (t) => (t.hacked ? t : { ...t, hacked: true }));

/** Was `e` one of the running contract's targets (its crew)? */
export const isContractTarget = (ctx: SimContext, e: Entity): boolean => {
  const c = ctx.state.domain.contracts.active;
  return !!c && !!e.tag && e.tag === contractTag(c.id) && contractKind(c) !== "delivery";
};

/** Situations a fixer texts about (ADR-0029). */
export type PhoneSituation = "offer" | "paid" | "failed";

/** Knot of a phone message, `phone_<fixer>_<situation>` (ADR-0029). */
export const phoneKnot = (giver: ContractGiverId, situation: PhoneSituation): string => `phone_${giver}_${situation}`;

/** A text from a fixer about a contract; `from` is the giver's id. The app renders `knot` from ink. */
export const phoneFromFixer = (ctx: SimContext, giver: ContractGiverId, situation: PhoneSituation): void =>
  ctx.bus.emit("PhoneMessage", { from: giver, kind: "text", knot: phoneKnot(giver, situation), priority: situation === "failed" ? "info" : "contract" });

export const giverOfContract = (c: Contract): ContractGiverId => CONTRACT_KINDS[contractKind(c)].giver;

/** The entity's quickhack effects, added as a component (so the effect query sees it) when missing. */
export const hackFxOf = (world: World<Entity>, e: Entity): HackEffects => {
  if (!e.hackFx) world.addComponent(e, "hackFx", { pinged: 0, blind: 0, crippled: 0 });
  return e.hackFx ?? { pinged: 0, blind: 0, crippled: 0 };
};

/** Daemons a docks terminal offers in Breach Protocol (ADR-0029), in the order they apply. */
export const BREACH_DAEMONS: readonly BreachDaemonId[] = ["icepick", "datamine", "mass_vulnerability"];
