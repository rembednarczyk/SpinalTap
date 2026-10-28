import { GARMENT_CATALOG, type GarmentDefinition, isGarmentId } from "../items/catalog";
import { type Equipment, type InventoryState, findItem } from "../items/inventory";
import type { FactionId } from "../reputation/reputation";
import type { DisguiseRole } from "../world/wave2";

/**
 * Disguises with the enforcer rule (ADR-0033, after Hitman): a garment with a role passes the
 * player off as one of a faction. Its people do not attack and do not report her. Suspicion
 * grows only in an enforcer (a shift boss, every third Hebi) or in anyone who sees a forbidden
 * act: a drawn weapon, a sprint or a dash, a shot, a no-go zone. Full suspicion blows the
 * disguise, which counts as being detected (ADR-0029).
 */

/** The faction a role belongs to. */
export const DISGUISE_FACTION: Readonly<Record<DisguiseRole, FactionId>> = {
  hebi: "hebi",
  tessen_guard: "tessen",
  tessen_staff: "tessen",
};

/** The office staff belongs in the no-go zones (the Tessen office); a guard's uniform does not. */
export const ZONE_ACCESS: Readonly<Record<DisguiseRole, boolean>> = {
  hebi: false,
  tessen_guard: false,
  tessen_staff: true,
};

export interface DisguiseState {
  /** Who the player passes for; null without a disguise. */
  readonly role: DisguiseRole | null;
  /** Seen through: the disguise protects nobody until the player changes into another one. */
  readonly blown: boolean;
}

export const NO_DISGUISE: DisguiseState = { role: null, blown: false };

/** Role of the garment worn on the torso, or null. */
export const disguiseOf = (inventory: InventoryState, equipment: Equipment): DisguiseRole | null => {
  const uid = equipment.torso;
  const item = uid === null ? undefined : findItem(inventory, uid);
  if (!item || !isGarmentId(item.def)) return null;
  const def: GarmentDefinition = GARMENT_CATALOG[item.def];
  return def.disguise ?? null;
};

/** Does the disguise hold against people of `faction`? */
export const disguiseHolds = (state: DisguiseState, faction: FactionId | undefined): boolean =>
  state.role !== null && !state.blown && faction !== undefined && DISGUISE_FACTION[state.role] === faction;

/** Suspicion per second of an enforcer who sees the player, at the edge of its sight (×1.5 point blank). */
export const ENFORCER_SUSPICION_RATE = 0.4;
/** Suspicion per second of anyone who sees a forbidden act (the same as a guard's, ADR-0024). */
export const FORBIDDEN_SUSPICION_RATE = 1.4;
/** Suspicion drained per second out of sight or with nothing to see. */
export const DISGUISE_SUSPICION_DECAY = 0.5;

/**
 * Change of an observer's suspicion per second: it grows when the observer sees the player and
 * either is an enforcer or sees a forbidden act, faster the closer it is (`distance` against
 * its `sight`); otherwise it drains.
 */
export const disguiseSuspicionRate = (sees: boolean, enforcer: boolean, forbidden: boolean, distance: number, sight: number): number => {
  if (!sees || (!enforcer && !forbidden)) return -DISGUISE_SUSPICION_DECAY;
  const near = 1.5 - Math.min(1, distance / Math.max(1e-6, sight));
  return (forbidden ? FORBIDDEN_SUSPICION_RATE : ENFORCER_SUSPICION_RATE) * near;
};
