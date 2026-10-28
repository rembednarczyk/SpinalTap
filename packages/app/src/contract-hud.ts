import {
  CONTRACT_BADGES,
  CONTRACT_KINDS,
  type Contract,
  type ContractModifier,
  type ContractVariation,
  type DomainEvents,
  FIXER_STYLE,
  type SecurityProfile,
  type TargetTrait,
  contractGiver,
  contractKind,
} from "@seki/core";
import { variationOf } from "@seki/narrative";
import type { ContractBonusVm, ContractDebriefVm, ContractVariationVm } from "@seki/ui";

/**
 * The debrief card from `ContractDebrief` and the contract it closes (from the preceding
 * `ContractCompleted`, which carries the kind and so the fixer). Every badge is listed, earned
 * or not, with the ones the fixer pays extra for marked.
 */
export const debriefVm = (e: DomainEvents["ContractDebrief"], contract: Contract | null): ContractDebriefVm => {
  const giver = contract ? contractGiver(contract) : null;
  const style: readonly string[] = giver ? FIXER_STYLE[giver.id] : [];
  return {
    contractId: e.contractId,
    title: contract ? CONTRACT_KINDS[contractKind(contract)].title : "Zlecenie",
    fixer: giver?.name ?? null,
    badges: CONTRACT_BADGES.map((id) => ({ id, earned: e.badges.includes(id), style: style.includes(id) })),
    rank: e.rank,
    reward: e.reward,
    bonus: e.bonus,
    styleBonus: e.styleBonus,
    seconds: e.seconds,
    ...variationField(contract),
  };
};

const MODIFIER_TEXT: Readonly<Record<ContractModifier, string>> = {
  night_only: "tylko nocą",
  time_limit: "na czas",
  bodyguards: "ochroniarze",
  ambush: "zasadzka",
  twin: "sobowtór",
};
const SECURITY_TEXT: Readonly<Record<SecurityProfile, string>> = { light: "słaba ochrona", standard: "zwykła ochrona", lockdown: "blokada" };
const TRAIT_TEXT: Readonly<Record<TargetTrait, string>> = { paranoid: "cel paranoik", drinker: "cel pije", creature_of_habit: "cel z nawykami", armored: "cel w pancerzu" };
const TWIST_TEXT: Readonly<Record<NonNullable<ContractVariation["twist"]>, string>> = { wrong_target: "zły cel", setup: "wystawka" };

/**
 * The debrief card's tags for a variation (ADR-0032); the contract's own `variation` is read
 * with the narrative's `variationOf`, which does not assume the field exists yet.
 */
export const variationVm = (v: ContractVariation): ContractVariationVm => ({
  labels: [...v.modifiers.map((m) => MODIFIER_TEXT[m]), SECURITY_TEXT[v.security], ...(v.trait ? [TRAIT_TEXT[v.trait]] : [])],
  twist: v.twist ? TWIST_TEXT[v.twist] : null,
});

const variationField = (contract: Contract | null): { variation?: ContractVariationVm } => {
  const v = variationOf(contract);
  return v ? { variation: variationVm(v) } : {};
};

export const bonusVm = (e: DomainEvents["ContractBonusChanged"]): ContractBonusVm => ({
  label: e.condition.label,
  badge: e.condition.badge,
  bonus: e.condition.bonus,
  kept: e.kept,
});
