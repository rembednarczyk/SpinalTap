import { type DomainState, QUEST_DEFINITIONS, contractObjective, currentStep } from "@seki/core";

/** Main-quest title and objective for the HUD. */
export const describeObjective = (domain: DomainState): { title: string | null; objective: string | null } => {
  for (const q of QUEST_DEFINITIONS) {
    if (!q.main) continue;
    const progress = domain.quests[q.id];
    if (!progress) continue;
    if (progress.status === "completed") {
      const contract = domain.contracts.active;
      if (contract) return { title: `Kontrakt ${contract.id.slice(1)} · Kaito`, objective: contractObjective(contract) };
      return { title: "Wolna ręka", objective: "Kaito ma kolejne kontrakty. Mori sprzedaje cyberware." };
    }
    return { title: q.title, objective: currentStep(domain.quests, q)?.objective ?? null };
  }
  return { title: null, objective: null };
};

export const saveLabel = (date: Date): string =>
  date.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
