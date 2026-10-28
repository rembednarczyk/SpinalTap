/**
 * Shared vocabulary of wave 2 (ADR-0032): metro, buffs, disguises and contract variations.
 * Kept free of other imports so events, commands and rules can name these without a cycle.
 */

/** One platform per district (ADR-0032). The ride covers the streaming of the destination. */
export type MetroStationId = "shinsekai" | "kanal" | "targ" | "doki";

export const METRO_STATION_IDS: readonly MetroStationId[] = ["shinsekai", "kanal", "targ", "doki"];

/** Short timed effects from food, drinks and implants. */
export type BuffId = "regen" | "quick_cooldown" | "steady";

/**
 * Who the player passes for while wearing a disguise. Only enforcers (a shift boss, someone from
 * the same unit) see through it; anyone sees a forbidden act (a drawn weapon, running, a barrier).
 */
export type DisguiseRole = "hebi" | "tessen_guard" | "tessen_staff";

/** What changes the plan of a templated contract, not just its look (ADR-0032). */
export type ContractModifier = "night_only" | "time_limit" | "bodyguards" | "ambush" | "twin";

/** How hard the site is guarded. */
export type SecurityProfile = "light" | "standard" | "lockdown";

/** A habit or a trait of the target that a hook can reveal and the player can use. */
export type TargetTrait = "paranoid" | "drinker" | "creature_of_habit" | "armored";

/** The plan-changing parts of a contract, rolled once at acceptance from `RandomPort`. */
export interface ContractVariation {
  readonly modifiers: readonly ContractModifier[];
  readonly security: SecurityProfile;
  readonly trait?: TargetTrait;
  /** A rare turn of events: the target is someone else, the client sets the player up. */
  readonly twist?: "wrong_target" | "setup";
}
