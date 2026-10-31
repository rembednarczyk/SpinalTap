import type { ContractModifier, SecurityProfile, TargetTrait } from "@seki/core";

/** The narrative's own words outside ink, per language (ADR-0056). */
export interface NarrativeText {
  /** The player's name in the dialogue before she has an alias. */
  readonly you: string;
  /** Display names by the speaker code at the start of an ink line (`KAITO: ...`). */
  readonly speakers: Readonly<Record<string, string>>;
  /** How a fixer sums up the rolled variation of a contract (ADR-0032), part by part. */
  readonly modifiers: Readonly<Record<ContractModifier, string>>;
  readonly security: Readonly<Record<SecurityProfile, string>>;
  readonly traits: Readonly<Record<TargetTrait, string>>;
}
