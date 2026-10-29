import type { RandomPort } from "../ports/random-port";
import type { ContractModifier, ContractVariation, SecurityProfile, TargetTrait } from "../world/wave2";
import type { Contract, ContractSiteId } from "./contracts";
import type { ContractKind } from "./kinds";

/**
 * Contract variations (ADR-0034): rolled once at acceptance, they change the plan of a
 * templated job, not its look. The modifiers each kind can take are the ones its site and
 * its job make sense for; the plan itself is laid out by the simulation.
 */
export const KIND_MODIFIERS: Readonly<Record<ContractKind, readonly ContractModifier[]>> = {
  eliminate: ["night_only", "time_limit", "bodyguards", "ambush", "twin"],
  delivery: [],
  retrieve: ["time_limit", "bodyguards", "ambush"],
  protect: [],
  escort: [],
  infiltrate: ["time_limit", "bodyguards"],
  hack: ["ambush"],
};

/** Traits of the mark (the first target) a kind can roll. */
export const KIND_TRAITS: Readonly<Record<ContractKind, readonly TargetTrait[]>> = {
  eliminate: ["paranoid", "drinker", "creature_of_habit", "armored"],
  delivery: [],
  retrieve: ["paranoid", "creature_of_habit", "armored"],
  protect: [],
  escort: [],
  infiltrate: ["paranoid", "creature_of_habit"],
  hack: [],
};

/** Sites with a walk to the bar (Neon Koi): only there can the mark be a night drinker. */
export const DRINKER_SITES: readonly ContractSiteId[] = ["east_lot", "koi_back", "car_wash", "south_gate"];

/** The first contracts are plain, so the templates are learned before they are bent. */
export const VARIATION_FROM_COMPLETED = 1;

/** Seconds a `time_limit` job gives from acceptance. */
export const TIME_LIMIT_SECONDS = 240;

/** Chance of a twist of the plot. */
export const TWIST_CHANCE = 0.07;

/** How much harder each part makes the job; the pay grows with the sum (ADR-0034 balance). */
export const MODIFIER_WEIGHT: Readonly<Record<ContractModifier, number>> = {
  night_only: 0.1,
  time_limit: 0.2,
  bodyguards: 0.25,
  ambush: 0.2,
  twin: 0.15,
};
export const SECURITY_WEIGHT: Readonly<Record<SecurityProfile, number>> = { light: -0.15, standard: 0, lockdown: 0.3 };
export const TRAIT_WEIGHT: Readonly<Record<TargetTrait, number>> = { paranoid: 0.1, drinker: -0.05, creature_of_habit: -0.05, armored: 0.2 };
export const TWIST_WEIGHT: Readonly<Record<NonNullable<ContractVariation["twist"]>, number>> = { setup: 0.25, wrong_target: 0.15 };

/** The pay multiplier stays in this band. */
export const VARIATION_PAY_MIN = 0.8;
export const VARIATION_PAY_MAX = 1.9;

/** A plain job: what the first contracts and the kinds without variation get. */
export const PLAIN_VARIATION: ContractVariation = { modifiers: [], security: "standard" };

/** Change of the guard count by the security profile. */
export const SECURITY_GUARDS: Readonly<Record<SecurityProfile, number>> = { light: -1, standard: 0, lockdown: 1 };

const pickFrom = <T>(list: readonly T[], r: number): T | undefined => list[Math.min(list.length - 1, Math.floor(r * list.length))];

const rollModifiers = (pool: readonly ContractModifier[], r1: number, r2: number, r3: number): ContractModifier[] => {
  const count = pool.length === 0 ? 0 : r1 < 0.45 ? 0 : r1 < 0.85 ? 1 : 2;
  const out: ContractModifier[] = [];
  const first = count > 0 ? pickFrom(pool, r2) : undefined;
  if (first) out.push(first);
  const rest = pool.filter((m) => m !== first);
  const second = count > 1 ? pickFrom(rest, r3) : undefined;
  // A deadline and a night-only target together could leave no way to finish: keep the first.
  if (second && !(out.includes("night_only") && second === "time_limit") && !(out.includes("time_limit") && second === "night_only")) out.push(second);
  return out;
};

/**
 * Rolls the variation of a new contract. Always consumes six numbers (count, two modifiers,
 * security, trait, twist), so what follows in the stream does not depend on the outcome.
 */
export const rollContractVariation = (kind: ContractKind, site: ContractSiteId, rng: RandomPort): ContractVariation => {
  const r = [rng.next(), rng.next(), rng.next(), rng.next(), rng.next(), rng.next()] as const;
  const modifiers = rollModifiers(KIND_MODIFIERS[kind], r[0], r[1], r[2]);
  const guarded = kind !== "delivery";
  const security: SecurityProfile = !guarded ? "standard" : r[3] < 0.25 ? "light" : r[3] < 0.8 ? "standard" : "lockdown";
  const traits = KIND_TRAITS[kind].filter((t) => t !== "drinker" || DRINKER_SITES.includes(site));
  const trait = traits.length > 0 && r[4] < 0.6 ? pickFrom(traits, r[4] / 0.6) : undefined;
  const twist = !guarded || r[5] >= TWIST_CHANCE ? undefined : kind === "eliminate" && r[5] >= TWIST_CHANCE / 2 ? "wrong_target" : "setup";
  // A wrong target needs a look-alike to be wrong about.
  if (twist === "wrong_target" && !modifiers.includes("twin")) modifiers.push("twin");
  return { modifiers, security, ...(trait ? { trait } : {}), ...(twist ? { twist } : {}) };
};

/** Sum of the weights of a variation: 0 for a plain job. */
export const variationDifficulty = (v: ContractVariation): number =>
  v.modifiers.reduce((sum, m) => sum + MODIFIER_WEIGHT[m], 0) +
  SECURITY_WEIGHT[v.security] +
  (v.trait ? TRAIT_WEIGHT[v.trait] : 0) +
  (v.twist ? TWIST_WEIGHT[v.twist] : 0);

export const variationPayFactor = (v: ContractVariation): number =>
  Math.min(VARIATION_PAY_MAX, Math.max(VARIATION_PAY_MIN, 1 + variationDifficulty(v)));

export const hasModifier = (c: Contract, m: ContractModifier): boolean => c.variation?.modifiers.includes(m) ?? false;

/** Most guards a varied job can field. */
const MAX_TARGETS = 6;

/**
 * The contract with its variation applied: the guard count by the security profile (never
 * below one, never for a delivery), the pay by the difficulty, a deadline for `time_limit`.
 */
export const applyVariation = (c: Contract, v: ContractVariation, tick: number, ticksPerSecond: number): Contract => {
  const targets = c.targets === 0 ? 0 : Math.max(1, Math.min(MAX_TARGETS, c.targets + SECURITY_GUARDS[v.security]));
  const deadline = v.modifiers.includes("time_limit") && c.deadlineTick === undefined ? { deadlineTick: tick + TIME_LIMIT_SECONDS * ticksPerSecond } : {};
  return { ...c, targets, reward: Math.round(c.reward * variationPayFactor(v)), variation: v, ...deadline };
};

const MODIFIER_LABEL: Readonly<Record<ContractModifier, string>> = {
  night_only: "cel tylko nocą",
  time_limit: "termin",
  bodyguards: "obstawa przy celu",
  ambush: "zasadzka przy wyjściu",
  twin: "sobowtór",
};
const SECURITY_LABEL: Readonly<Record<SecurityProfile, string>> = { light: "ochrona słaba", standard: "ochrona zwykła", lockdown: "ochrona wzmocniona" };
const TRAIT_LABEL: Readonly<Record<TargetTrait, string>> = {
  paranoid: "cel: paranoik",
  drinker: "cel: pije nocą",
  creature_of_habit: "cel: rutyniarz",
  armored: "cel: w pancerzu",
};

/** One line for the briefing and the card; the twist stays a secret until it happens. */
export const variationNote = (v: ContractVariation): string =>
  [...v.modifiers.map((m) => MODIFIER_LABEL[m]), SECURITY_LABEL[v.security], ...(v.trait ? [TRAIT_LABEL[v.trait]] : [])].join(", ");
