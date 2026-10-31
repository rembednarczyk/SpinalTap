import type { ContractVariation, Locale } from "@seki/core";
import { narrativeText } from "./language";

/**
 * The fixer's sentence about `variation` in `language`, or "" when there is nothing worth saying
 * (ADR-0032). The text goes into the ink variable `contract_variation`; the fixers say it after
 * their own lead-in. The twist is left out on purpose: the fixer does not know about it either.
 */
export const describeVariation = (variation: ContractVariation | null | undefined, language: Locale): string => {
  if (!variation) return "";
  const t = narrativeText(language);
  const parts = [...variation.modifiers.map((m) => t.modifiers[m]), t.security[variation.security], variation.trait ? t.traits[variation.trait] : ""];
  return parts.filter((p) => p !== "").join(" ");
};

const isVariation = (v: unknown): v is ContractVariation =>
  typeof v === "object" && v !== null && "modifiers" in v && Array.isArray(v.modifiers) && "security" in v && typeof v.security === "string";

/** The variation stored on a contract, once the simulation keeps one there (ADR-0032). */
export const variationOf = (contract: object | null): ContractVariation | undefined => {
  if (!contract || !("variation" in contract)) return undefined;
  return isVariation(contract.variation) ? contract.variation : undefined;
};
