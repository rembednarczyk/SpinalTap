import type { StatModifiers } from "../character/stats";
import { type AttributeId, ATTRIBUTE_MAX, ATTRIBUTE_START, type Attributes, START_ATTRIBUTES } from "./attributes";
import { MAX_LEVEL, MIN_LEVEL, levelForXp } from "./curve";

/**
 * Character progression (ADR-0059, stage 1): the experience, the level it gives and the points
 * the levels hand out. Every level up gives one attribute point and one perk point; the perk
 * trees come in stage 3, so `perks` stays empty for now. Pure functions on an immutable state.
 */
export interface ProgressionState {
  /** Total experience earned. */
  readonly xp: number;
  readonly level: number;
  readonly attributes: Attributes;
  /** Perk id → rank bought (stage 3). */
  readonly perks: Readonly<Record<string, number>>;
  /** Points earned and not yet spent. */
  readonly unspent: { readonly attribute: number; readonly perk: number };
  /**
   * Keys of the targets whose first quickhack already paid XP, oldest first, at most
   * HACKED_MEMORY of them. Absent until the first one: hacking the same camera again pays nothing.
   */
  readonly hacked?: readonly string[];
}

export const INITIAL_PROGRESSION: ProgressionState = {
  xp: 0,
  level: MIN_LEVEL,
  attributes: START_ATTRIBUTES,
  perks: {},
  unspent: { attribute: 0, perk: 0 },
};

/** Points each level up gives. */
export const ATTRIBUTE_POINTS_PER_LEVEL = 1;
export const PERK_POINTS_PER_LEVEL = 1;

export interface XpGain {
  readonly state: ProgressionState;
  /** Levels gained by this XP (0 most of the time). */
  readonly levelsGained: number;
}

/** Adds `amount` XP (negative, infinite, NaN and fractional parts are dropped); every level gained adds its points. */
export const gainXp = (state: ProgressionState, amount: number): XpGain => {
  const add = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  if (add === 0) return { state, levelsGained: 0 };
  const xp = state.xp + add;
  const level = Math.max(state.level, levelForXp(xp));
  const levelsGained = level - state.level;
  return {
    levelsGained,
    state: {
      ...state,
      xp,
      level,
      unspent: {
        attribute: state.unspent.attribute + levelsGained * ATTRIBUTE_POINTS_PER_LEVEL,
        perk: state.unspent.perk + levelsGained * PERK_POINTS_PER_LEVEL,
      },
    },
  };
};

export type SpendFailure = "no-points" | "at-max";

export type SpendResult = { readonly ok: true; readonly state: ProgressionState } | { readonly ok: false; readonly reason: SpendFailure };

/** Puts one unspent point into `attribute`; refused without a point or at the attribute's cap. */
export const spendAttributePoint = (state: ProgressionState, attribute: AttributeId): SpendResult => {
  if (state.unspent.attribute < 1) return { ok: false, reason: "no-points" };
  if (state.attributes[attribute] >= ATTRIBUTE_MAX) return { ok: false, reason: "at-max" };
  return {
    ok: true,
    state: {
      ...state,
      attributes: { ...state.attributes, [attribute]: state.attributes[attribute] + 1 },
      unspent: { ...state.unspent, attribute: state.unspent.attribute - 1 },
    },
  };
};

/**
 * How many hacked targets are remembered. Far above the keyed devices and guards of the whole
 * city; contract crews get new keys per job, so the oldest are forgotten instead of the list growing.
 */
export const HACKED_MEMORY = 256;

/**
 * The first successful quickhack on target `key` pays XP (ADR-0059: a successful hack, not every
 * upload): returns the state that remembers it, or null when that target already paid. `gone`
 * names the remembered targets that can never be hacked again (G-209: a reinforcement of a heat
 * over, whose key never comes back); they are forgotten first, so they take no room from the rest.
 */
export const rememberHack = (state: ProgressionState, key: string, gone: (key: string) => boolean = () => false): ProgressionState | null => {
  const hacked = state.hacked ?? [];
  if (hacked.includes(key)) return null;
  return { ...state, hacked: [...hacked.filter((k) => !gone(k)), key].slice(-HACKED_MEMORY) };
};

/**
 * Is the state what its XP gives? The level follows the curve, and the points spent on
 * attributes and perks plus those left are exactly the levels gained. A save that fails this
 * was edited or broken.
 */
export const isConsistentProgression = (state: ProgressionState): boolean => {
  if (state.level !== levelForXp(state.xp)) return false;
  const gained = state.level - MIN_LEVEL;
  const spentAttributes = Object.values(state.attributes).reduce((sum, v) => sum + v - ATTRIBUTE_START, 0);
  const spentPerks = Object.values(state.perks).reduce((sum, v) => sum + v, 0);
  return spentAttributes + state.unspent.attribute === gained * ATTRIBUTE_POINTS_PER_LEVEL && spentPerks + state.unspent.perk === gained * PERK_POINTS_PER_LEVEL;
};

/** A fresh character that earned `xp`: the level from the curve and every point still to spend (old saves). */
export const progressionFromXp = (xp: number): ProgressionState => gainXp(INITIAL_PROGRESSION, xp).state;

/** Maximum health each level above 1 adds. */
export const HP_PER_LEVEL = 3;

/** What the level itself does to the stats: more health. The attributes add theirs in stage 2. */
export const levelModifiers = (state: ProgressionState): StatModifiers => ({ maxHp: (Math.min(MAX_LEVEL, state.level) - MIN_LEVEL) * HP_PER_LEVEL });
