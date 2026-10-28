import type { ContractModifier, ContractVariation, SecurityProfile, TargetTrait } from "@seki/core";

/**
 * How a fixer sums up the rolled variation of a running contract (ADR-0032). The text goes into
 * the ink variable `contract_variation`; the fixers say it after their own lead-in. The twist is
 * left out on purpose: the fixer does not know about it either.
 */
const MODIFIER_TEXT: Readonly<Record<ContractModifier, string>> = {
  night_only: "Robota tylko po zmroku, za dnia cel siedzi w środku.",
  time_limit: "Klient liczy czas, więc nie zwlekaj.",
  bodyguards: "Cel chodzi z obstawą.",
  ambush: "Coś mi tu pachnie zasadzką, miej oczy dookoła głowy.",
  twin: "Mówią, że jest ich dwóch i wyglądają tak samo.",
};

const SECURITY_TEXT: Readonly<Record<SecurityProfile, string>> = {
  light: "Ochrona jest cienka.",
  standard: "",
  lockdown: "Teren zamknięty na głucho, ochrona w pełnej gotowości.",
};

const TRAIT_TEXT: Readonly<Record<TargetTrait, string>> = {
  paranoid: "Cel jest przewrażliwiony i ogląda się za siebie.",
  drinker: "Cel lubi wypić, wieczorem szukaj go przy barze.",
  creature_of_habit: "Cel chodzi jak w zegarku, zawsze tą samą trasą.",
  armored: "Cel nosi pancerz, zwykłe kule się od niego odbiją.",
};

/** The fixer's sentence about `variation`, or "" when there is nothing worth saying. */
export const describeVariation = (variation: ContractVariation | null | undefined): string => {
  if (!variation) return "";
  const parts = [...variation.modifiers.map((m) => MODIFIER_TEXT[m]), SECURITY_TEXT[variation.security], variation.trait ? TRAIT_TEXT[variation.trait] : ""];
  return parts.filter((p) => p !== "").join(" ");
};

const isVariation = (v: unknown): v is ContractVariation =>
  typeof v === "object" && v !== null && "modifiers" in v && Array.isArray(v.modifiers) && "security" in v && typeof v.security === "string";

/** The variation stored on a contract, once the simulation keeps one there (ADR-0032). */
export const variationOf = (contract: object | null): ContractVariation | undefined => {
  if (!contract || !("variation" in contract)) return undefined;
  return isVariation(contract.variation) ? contract.variation : undefined;
};
