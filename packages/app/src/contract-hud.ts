import {
  CONTRACT_BADGES,
  CONTRACT_KINDS,
  type Contract,
  type ContractVariation,
  type DomainEvents,
  type Locale,
  FIXER_STYLE,
  contractGiver,
  contractKind,
} from "@seki/core";
import { variationOf } from "@seki/narrative";
import { type ContractBonusVm, type ContractDebriefVm, type ContractVariationVm, translate } from "@seki/ui";

/**
 * The debrief card from `ContractDebrief` and the contract it closes (from the preceding
 * `ContractCompleted`, which carries the kind and so the fixer). Every badge is listed, earned
 * or not, with the ones the fixer pays extra for marked.
 */
export const debriefVm = (e: DomainEvents["ContractDebrief"], contract: Contract | null, locale: Locale = "en"): ContractDebriefVm => {
  const giver = contract ? contractGiver(contract) : null;
  const style: readonly string[] = giver ? FIXER_STYLE[giver.id] : [];
  return {
    contractId: e.contractId,
    title: contract ? CONTRACT_KINDS[contractKind(contract)].title : translate(locale, "contract.untitled"),
    fixer: giver?.name ?? null,
    badges: CONTRACT_BADGES.map((id) => ({ id, earned: e.badges.includes(id), style: style.includes(id) })),
    rank: e.rank,
    reward: e.reward,
    bonus: e.bonus,
    styleBonus: e.styleBonus,
    seconds: e.seconds,
    ...variationField(e.variation ?? variationOf(contract), locale),
  };
};

/**
 * The debrief card's tags for a variation (ADR-0032); the contract's own `variation` is read
 * with the narrative's `variationOf`, which does not assume the field exists yet.
 */
export const variationVm = (v: ContractVariation, locale: Locale = "en"): ContractVariationVm => ({
  labels: [
    ...v.modifiers.map((m) => translate(locale, `variation.modifier.${m}`)),
    translate(locale, `variation.security.${v.security}`),
    ...(v.trait ? [translate(locale, `variation.trait.${v.trait}`)] : []),
  ],
  twist: v.twist ? translate(locale, `variation.twist.${v.twist}`) : null,
});

const variationField = (v: ContractVariation | null | undefined, locale: Locale): { variation?: ContractVariationVm } => {
  return v ? { variation: variationVm(v, locale) } : {};
};

export const bonusVm = (e: DomainEvents["ContractBonusChanged"]): ContractBonusVm => ({
  label: e.condition.label,
  badge: e.condition.badge,
  bonus: e.condition.bonus,
  kept: e.kept,
});
