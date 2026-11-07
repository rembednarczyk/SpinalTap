import { WEAPON_CATALOG, type WeaponDefinition, isGarmentId, isWeaponId } from "./catalog";
import { RARITY } from "./rarity";
import type { InstanceDefId, Rarity, TraitId } from "./types";

/**
 * Traits of epic and legendary pieces (ADR-0059). Plain data: the weapon ones change the numbers
 * of `effectiveWeapon`, the garment ones the armor, wear and speed of `armor.ts`, so no system
 * knows a trait by name. The numbers are first guesses, to be tuned in stage 8.
 */
export type TraitTable = "firearm" | "melee" | "garment";

/** What a trait does. Multipliers default to 1, additions to 0. */
export interface TraitEffect {
  /** Weapon damage ×. */
  readonly damage?: number;
  /** Weapon base spread ×. */
  readonly spread?: number;
  /** Seconds between shots ×. */
  readonly interval?: number;
  /** Draw time ×. */
  readonly drawTime?: number;
  /** Alert radius of a shot at most this (metres), like a suppressor without its damage loss. */
  readonly alertRadius?: number;
  /** Reach of a melee weapon + metres. */
  readonly range?: number;
  /** Garment armor + on every zone it covers. */
  readonly armor?: number;
  /** Wear per hit ×. */
  readonly wear?: number;
  /** Walking speed + m/s while worn. */
  readonly moveSpeed?: number;
}

export interface TraitDefinition {
  readonly id: TraitId;
  /** Catalog keys (ADR-0056). */
  readonly label: string;
  readonly description: string;
  readonly table: TraitTable;
  readonly effect: TraitEffect;
}

const trait = (id: TraitId, table: TraitTable, effect: TraitEffect): TraitDefinition => ({
  id,
  label: `trait.${id}.name`,
  description: `trait.${id}.desc`,
  table,
  effect,
});

export const TRAIT_CATALOG: Readonly<Record<TraitId, TraitDefinition>> = {
  silenced: trait("silenced", "firearm", { alertRadius: 10 }),
  match_barrel: trait("match_barrel", "firearm", { spread: 0.85 }),
  hot_loads: trait("hot_loads", "firearm", { damage: 1.1 }),
  quick_draw: trait("quick_draw", "firearm", { drawTime: 0.7 }),
  light_trigger: trait("light_trigger", "firearm", { interval: 0.92 }),
  weighted: trait("weighted", "melee", { damage: 1.12 }),
  balanced: trait("balanced", "melee", { drawTime: 0.7 }),
  long_reach: trait("long_reach", "melee", { range: 0.25 }),
  padded: trait("padded", "garment", { armor: 1 }),
  durable: trait("durable", "garment", { wear: 0.5 }),
  lightweight: trait("lightweight", "garment", { moveSpeed: 0.1 }),
};

export const TRAIT_IDS = Object.keys(TRAIT_CATALOG) as TraitId[];

/** Traits each kind of piece draws from, in catalog order. */
export const TRAIT_TABLES: Readonly<Record<TraitTable, readonly TraitId[]>> = {
  firearm: TRAIT_IDS.filter((t) => TRAIT_CATALOG[t].table === "firearm"),
  melee: TRAIT_IDS.filter((t) => TRAIT_CATALOG[t].table === "melee"),
  garment: TRAIT_IDS.filter((t) => TRAIT_CATALOG[t].table === "garment"),
};

export const isTraitId = (v: unknown): v is TraitId => typeof v === "string" && Object.hasOwn(TRAIT_CATALOG, v);

/** The table a piece draws traits from; null for mods and implants. */
export const traitTableOf = (def: InstanceDefId): TraitTable | null => {
  if (isWeaponId(def)) return (WEAPON_CATALOG[def] as WeaponDefinition).melee ? "melee" : "firearm";
  return isGarmentId(def) ? "garment" : null;
};

/** Index in [0, n) from one random number. */
const indexOf = (r: number, n: number): number => Math.min(n - 1, Math.floor(r * n));

/**
 * The traits a piece of this tier gets from two random numbers: none below epic, one for epic,
 * two different ones for legendary, from the table of its kind.
 */
export const rollTraits = (def: InstanceDefId, rarity: Rarity, r1: number, r2: number): TraitId[] => {
  const table = traitTableOf(def);
  const count = RARITY[rarity].traits;
  if (table === null || count === 0) return [];
  const pool = [...TRAIT_TABLES[table]];
  const first = pool.splice(indexOf(r1, pool.length), 1)[0]!;
  return count === 1 ? [first] : [first, pool[indexOf(r2, pool.length)]!];
};

/** Whether a saved list of traits can belong to this piece: known, of its table, no repeats. */
export const traitsFit = (def: InstanceDefId, traits: readonly unknown[]): boolean => {
  const table = traitTableOf(def);
  return traits.every((t) => isTraitId(t) && TRAIT_CATALOG[t].table === table) && new Set(traits).size === traits.length;
};

/** The effects of a piece's traits, in their order. */
export const traitEffects = (traits: readonly TraitId[] = []): TraitEffect[] => traits.map((t) => TRAIT_CATALOG[t].effect);
