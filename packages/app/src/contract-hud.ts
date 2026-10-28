import { CONTRACT_BADGES, CONTRACT_KINDS, type Contract, type DomainEvents, FIXER_STYLE, contractGiver, contractKind } from "@seki/core";
import type { ContractBonusVm, ContractDebriefVm } from "@seki/ui";

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
  };
};

export const bonusVm = (e: DomainEvents["ContractBonusChanged"]): ContractBonusVm => ({
  label: e.condition.label,
  badge: e.condition.badge,
  bonus: e.condition.bonus,
  kept: e.kept,
});
