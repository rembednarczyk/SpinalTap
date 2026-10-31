import type { StatModifiers } from "../character/stats";
import { type AttributeId, ATTRIBUTE_MAX, type Attributes, START_ATTRIBUTES } from "./attributes";
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

/** Adds `amount` XP (negative and fractional parts are dropped); every level gained adds its points. */
export const gainXp = (state: ProgressionState, amount: number): XpGain => {
  const add = Math.max(0, Math.floor(amount));
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

/** A fresh character that earned `xp`: the level from the curve and every point still to spend (old saves). */
export const progressionFromXp = (xp: number): ProgressionState => gainXp(INITIAL_PROGRESSION, xp).state;

/** Maximum health each level above 1 adds. */
export const HP_PER_LEVEL = 3;

/** What the level itself does to the stats: more health. The attributes add theirs in stage 2. */
export const levelModifiers = (state: ProgressionState): StatModifiers => ({ maxHp: (Math.min(MAX_LEVEL, state.level) - MIN_LEVEL) * HP_PER_LEVEL });
