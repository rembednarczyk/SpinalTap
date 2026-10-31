import type { ContractGiverId } from "./kinds";

/**
 * How a contract was done (ADR-0028), counted by the simulation from its own events and reset
 * when a game is loaded. Badges go on the debrief card; a fixer pays extra for the ones that
 * match their style.
 *
 * - `ghost`: never detected (no guard or camera saw the player).
 * - `no_alarm`: no alarm was raised and no heat was gained.
 * - `clean`: only the targets died (no bystanders, no extra guards).
 * - `untouched`: the player took no damage.
 * - `swift`: done within the par time of the template.
 * - `netrunner`: at least one quickhack or breach did part of the job.
 */
export type ContractBadge = "ghost" | "no_alarm" | "clean" | "untouched" | "swift" | "netrunner";

export const CONTRACT_BADGES: readonly ContractBadge[] = ["ghost", "no_alarm", "clean", "untouched", "swift", "netrunner"];

/** The one optional condition a template can carry; meeting it pays `bonus` on top. */
export interface BonusCondition {
  readonly badge: ContractBadge;
  /** Catalog key of the condition as the briefing and the HUD show it (`contract.bonus.<kind>`, ADR-0056). */
  readonly label: string;
  readonly bonus: number;
}

/** What each fixer pays extra for (ADR-0028): Genzō clean work, Kaito speed, Hana the net. */
export const FIXER_STYLE: Readonly<Record<ContractGiverId, readonly ContractBadge[]>> = {
  kaito: ["swift", "untouched"],
  hana: ["netrunner", "no_alarm"],
  genzo: ["ghost", "clean"],
};

/** Overall grade on the card, from the badges earned. */
export type ContractRank = "S" | "A" | "B" | "C";
