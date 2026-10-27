import { type DomainState, QUEST_DEFINITIONS, activeMainStep, contractObjective } from "@seki/core";

/** Main steps that are about fixer work: while a contract runs, the HUD shows the contract itself. */
const CONTRACT_STEPS: ReadonlySet<string> = new Set(["echo_contract"]);

/** Main-quest title and objective for the HUD. */
export const describeObjective = (domain: DomainState): { title: string | null; objective: string | null } => {
  const contract = domain.contracts.active;
  const contractView = contract ? { title: `Kontrakt ${contract.id.slice(1)} · Kaito`, objective: contractObjective(contract) } : null;
  const main = activeMainStep(domain.quests, QUEST_DEFINITIONS);
  if (main) {
    if (contractView && CONTRACT_STEPS.has(main.step.id)) return contractView;
    return { title: main.quest.title, objective: main.step.objective };
  }
  const started = QUEST_DEFINITIONS.some((q) => q.main && domain.quests[q.id]);
  if (!started) return { title: null, objective: null };
  return contractView ?? { title: "Wolna ręka", objective: "Kaito ma kolejne kontrakty. Mori sprzedaje cyberware." };
};

export const saveLabel = (date: Date): string =>
  date.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
