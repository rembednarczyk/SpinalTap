import { type Contract, type DomainState, QUEST_DEFINITIONS, activeMainStep, contractGiver, contractObjective, contractSecondsLeft, hasFlag } from "@seki/core";
import { SIM_HZ } from "@seki/sim";

/** Main steps that are about fixer work: while a contract runs, the HUD shows the contract itself. */
const CONTRACT_STEPS: ReadonlySet<string> = new Set(["echo_contract"]);

/** "Kontrakt 3 · Hana": the number and who gave it. */
export const contractTitle = (c: Contract): string => `Kontrakt ${c.id.slice(1)} · ${contractGiver(c).name}`;

/**
 * Main-quest title and objective for the HUD. With `tick` a running delivery shows its clock;
 * the save label leaves it out.
 */
export const describeObjective = (domain: DomainState, tick: number | null = null): { title: string | null; objective: string | null } => {
  const contract = domain.contracts.active;
  const left = contract && tick !== null ? contractSecondsLeft(contract, tick, SIM_HZ) : null;
  const contractView = contract ? { title: contractTitle(contract), objective: contractObjective(contract, left) } : null;
  const main = activeMainStep(domain.quests, QUEST_DEFINITIONS);
  if (main) {
    if (contractView && CONTRACT_STEPS.has(main.step.id)) return contractView;
    return { title: main.quest.title, objective: main.step.objective };
  }
  const started = QUEST_DEFINITIONS.some((q) => q.main && domain.quests[q.id]);
  if (!started) return { title: null, objective: null };
  const givers = [...(hasFlag(domain.flags, "met_hana") ? ["Hana z targu"] : []), ...(hasFlag(domain.flags, "met_genzo") ? ["Genzō w Dokach"] : [])];
  const work = givers.length > 0 ? `Kaito ma kolejne kontrakty, ${givers.join(" i ")} też.` : "Kaito ma kolejne kontrakty.";
  return contractView ?? { title: "Wolna ręka", objective: `${work} Mori sprzedaje cyberware.` };
};

export const saveLabel = (date: Date): string =>
  date.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
