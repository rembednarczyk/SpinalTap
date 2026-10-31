import type { ContractModifier, ContractVariation, SecurityProfile, TargetTrait } from "@seki/core";
import { type NarrativeText, keyText } from "./narrative-text";

/**
 * How a fixer sums up the rolled variation of a running contract (ADR-0032). The text goes into
 * the ink variable `contract_variation`; the fixers say it after their own lead-in. The twist is
 * left out on purpose: the fixer does not know about it either. Each line is a catalog key
 * (ADR-0056); standard security says nothing.
 */
const MODIFIER_KEY: Readonly<Record<ContractModifier, string>> = {
  night_only: "brief.modifier.night_only",
  time_limit: "brief.modifier.time_limit",
  bodyguards: "brief.modifier.bodyguards",
  ambush: "brief.modifier.ambush",
  twin: "brief.modifier.twin",
};

const SECURITY_KEY: Readonly<Record<SecurityProfile, string | null>> = { light: "brief.security.light", standard: null, lockdown: "brief.security.lockdown" };

const TRAIT_KEY: Readonly<Record<TargetTrait, string>> = {
  paranoid: "brief.trait.paranoid",
  drinker: "brief.trait.drinker",
  creature_of_habit: "brief.trait.creature_of_habit",
  armored: "brief.trait.armored",
};

/** The keys of the fixer's lines about `variation`, in the order they are said. */
export const variationKeys = (variation: ContractVariation | null | undefined): string[] => {
  if (!variation) return [];
  const keys = [...variation.modifiers.map((m) => MODIFIER_KEY[m]), SECURITY_KEY[variation.security], variation.trait ? TRAIT_KEY[variation.trait] : null];
  return keys.filter((k): k is string => k !== null);
};

/** The fixer's sentence about `variation` written by `text`, or "" when there is nothing worth saying. */
export const describeVariation = (variation: ContractVariation | null | undefined, text: NarrativeText = keyText): string =>
  variationKeys(variation)
    .map((key) => text(key))
    .join(" ");

const isVariation = (v: unknown): v is ContractVariation =>
  typeof v === "object" && v !== null && "modifiers" in v && Array.isArray(v.modifiers) && "security" in v && typeof v.security === "string";

/** The variation stored on a contract, once the simulation keeps one there (ADR-0032). */
export const variationOf = (contract: object | null): ContractVariation | undefined => {
  if (!contract || !("variation" in contract)) return undefined;
  return isVariation(contract.variation) ? contract.variation : undefined;
};
