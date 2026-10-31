import {
  type Contract,
  type ContractSiteId,
  type EnemyTypeId,
  type EntityId,
  type Vec3,
  contractKind,
  hasModifier,
} from "@seki/core";
import type { Presence } from "../content/builders";
import { CONTRACT_SITE_SPAWNS } from "../content/district-m0";
import { SITE_PLANS, drinkerSchedule } from "../content/contract-plans";
import { hooksOfKind } from "../content/contract-hooks";
import type { Entity } from "./components";
import { gangerEntity } from "./factory";

/**
 * How a contract's variation (ADR-0034) changes the spawned job: who stands where, who comes
 * when, how the mark behaves. Pure recipes for the streamer, which reserves the ids; the flags
 * named here are raised and lowered by the contract plan system as the clock goes.
 */

/** Raised by day while a `night_only` job runs: its targets are elsewhere. */
export const dayFlag = (contractId: string): string => `plan:day:${contractId}`;
/** Raised while guard `post` of the job is off its post (a rotation gap). */
export const offPostFlag = (contractId: string, post: number): string => `plan:off:${contractId}:${post}`;
/** Raised once the job is done and the crew by the way out moves in. */
export const ambushFlag = (contractId: string): string => `plan:ambush:${contractId}`;
/** Tag of the look-alike: not a target, so killing it is an extra kill. */
export const decoyTag = (contractId: string): string => `decoy:${contractId}`;
/** Tag of the bodyguards and the ambush: in the job's way, not its targets. */
export const escortTag = (contractId: string): string => `crew:${contractId}`;

/** Key of the observation hook terminal of a job. */
export const hookTerminalKey = (contractId: string, hookId: string): string => `${contractId}-${hookId}`;

/** The mark of a paranoid trait looks around this many times as often as a guard on watch. */
const PARANOID_WATCH_PERIOD = 3;
const PARANOID_SIGHT = 1.25;
const HABIT_SIGHT = 0.75;
const LIGHT_SIGHT = 0.85;
/** An armoured Tessen mark takes this much more. */
const ARMOR_HP = 40;

const docksKind = (c: Contract): boolean => ["escort", "infiltrate", "hack"].includes(contractKind(c));

/** Presence of target `i`: its own condition plus the variation's (night only, rotation gaps). */
export const targetPresence = (c: Contract, i: number, base?: Presence): Presence | undefined => {
  const none = [...(base?.none ?? [])];
  if (hasModifier(c, "night_only")) none.push(dayFlag(c.id));
  for (const h of hooksOfKind(contractKind(c))) if (h.reveal.kind === "rotation_gap" && h.reveal.post === i) none.push(offPostFlag(c.id, i));
  if (none.length === 0) return base;
  return { ...(base?.all ? { all: base.all } : {}), none };
};

/**
 * Where target `i` of a site without fixed posts stands: the extra guard of a lockdown at the
 * lookout, and with a wrong target the mark and its look-alike swapped.
 */
export const targetSpot = (c: Contract, i: number, points: readonly Vec3[]): Vec3 | undefined => {
  const plan = SITE_PLANS[c.siteId];
  if (i === 0 && c.variation?.twist === "wrong_target" && plan?.twin) return plan.twin;
  if (i === points.length && c.variation?.security === "lockdown" && plan?.lookout) return plan.lookout;
  return points[i % points.length];
};

/** The mark's enemy type: an armoured Hebi wears the enforcer's helmet and jacket. */
export const targetType = (c: Contract, i: number, type: EnemyTypeId): EnemyTypeId =>
  i === 0 && c.variation?.trait === "armored" && type === "hebi_ganger" ? "hebi_enforcer" : type;

/** The variation's touch on a spawned target: the mark's trait, the guards' alertness. */
export const decorateTarget = (e: Entity, c: Contract, i: number): Entity => {
  const v = c.variation;
  const ai = e.ai;
  if (!v || !ai) return e;
  let sight = v.security === "light" ? LIGHT_SIGHT : 1;
  let watch = ai.watch ?? (v.security === "lockdown" ? { yaw: e.yaw, phase: i * 1.7 } : undefined);
  if (i === 0 && v.trait === "paranoid") {
    sight *= PARANOID_SIGHT;
    watch = { yaw: e.yaw, phase: 0, period: PARANOID_WATCH_PERIOD };
  }
  if (i === 0 && v.trait === "creature_of_habit") sight *= HABIT_SIGHT;
  if (i === 0 && v.trait === "armored" && e.faction === "tessen" && e.health) {
    e.health = { current: e.health.current + ARMOR_HP, max: e.health.max + ARMOR_HP };
  }
  if (i === 0 && v.trait === "drinker" && !docksKind(c)) {
    const plan = drinkerSchedule(c.siteId, e.yaw);
    if (plan) e.schedule = { def: plan, own: null, pose: null };
  }
  e.ai = { ...ai, aggroRange: ai.aggroRange * sight, ...(watch ? { watch } : {}) };
  return e;
};

/** An extra character of the variation, with its id reserved by the streamer. */
export interface ExtraActor {
  readonly key: string;
  /** Where it stands (the streamer files it under that chunk). */
  readonly at: Vec3;
  readonly make: (id: EntityId, chunk: string) => Entity;
  readonly when?: Presence;
}

export interface ExtraContext {
  readonly chunk: string;
  readonly hp: number;
  readonly type: EnemyTypeId;
  readonly yawAt: (p: Vec3) => number;
}

const crew = (c: Contract, key: string, at: Vec3, x: ExtraContext, tag: string, alerted = false, when?: Presence): ExtraActor => ({
  key,
  at,
  ...(when ? { when } : {}),
  make: (id, chunk) => {
    const g = gangerEntity(id, { key, position: at, yaw: x.yawAt(at) }, tag, x.hp, chunk, undefined, x.type);
    if (g.ai && alerted) g.ai.alerted = true;
    // The crew is not the mark: the security profile applies, the trait does not.
    return decorateTarget(g, c, 1);
  },
});

const hookTerminal = (c: Contract, hookId: string, knot: string, at: Vec3): ExtraActor => {
  const key = hookTerminalKey(c.id, hookId);
  return {
    key,
    at,
    make: (id, chunk) => ({
      id,
      key,
      chunk,
      position: { x: at.x, y: at.y + 0.7, z: at.z },
      prevPosition: { x: at.x, y: at.y + 0.7, z: at.z },
      yaw: 0,
      prevYaw: 0,
      pitch: 0,
      view: { kind: "block", size: { x: 0.6, y: 1.4, z: 0.4 }, material: "glass" },
      interactable: { kind: "read", dialogueId: knot, prompt: "prompt.terminal.read", radius: 1.6 },
    }),
  };
};

/** Does the job end with a crew by the way out (an `ambush`, or the `setup` twist)? */
export const hasAmbush = (c: Contract): boolean => hasModifier(c, "ambush") || c.variation?.twist === "setup";

/** Bodyguards, the look-alike, the ambush crew and the hook terminals of a job, in that order. */
export const planExtras = (c: Contract, x: ExtraContext): ExtraActor[] => {
  const plan: SiteSpots = SITE_PLANS[c.siteId] ?? {};
  const out: ExtraActor[] = [];
  const crewTag = escortTag(c.id);
  if (hasModifier(c, "bodyguards") && plan.guards) plan.guards.forEach((p, i) => out.push(crew(c, `${c.id}-b${i}`, p, x, crewTag)));
  if (hasModifier(c, "twin") && plan.twin) {
    const at = c.variation?.twist === "wrong_target" ? (firstPoint(c) ?? plan.twin) : plan.twin;
    out.push(crew(c, `${c.id}-twin`, at, x, decoyTag(c.id)));
  }
  const ambush = hasModifier(c, "ambush") || c.variation?.twist === "setup";
  const size = c.variation?.twist === "setup" ? 3 : 2;
  if (ambush && plan.ambush) {
    plan.ambush.slice(0, size).forEach((p, i) => out.push(crew(c, `${c.id}-a${i}`, p, x, crewTag, true, { all: [ambushFlag(c.id)] })));
  }
  for (const h of hooksOfKind(contractKind(c))) if ("at" in h.carrier) out.push(hookTerminal(c, h.id, h.knot, h.carrier.at));
  return out;
};

type SiteSpots = NonNullable<(typeof SITE_PLANS)[ContractSiteId]>;

const firstPoint = (c: Contract): Vec3 | undefined => CONTRACT_SITE_SPAWNS[c.siteId][0];
