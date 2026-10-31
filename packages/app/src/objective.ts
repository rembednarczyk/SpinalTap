import {
  type Contract,
  type DomainState,
  type Locale,
  QUEST_DEFINITIONS,
  activeMainStep,
  contractGiver,
  contractObjective,
  contractSecondsLeft,
  hasFlag,
  stepObjective,
} from "@seki/core";
import { SIM_HZ } from "@seki/sim";
import { translateText } from "@seki/ui";

/** Main steps that are about fixer work: while a contract runs, the HUD shows the contract itself. */
const CONTRACT_STEPS: ReadonlySet<string> = new Set(["echo_contract"]);

/** "Kontrakt 3 · Hana": the number and who gave it. */
export const contractTitle = (c: Contract): string => `Kontrakt ${c.id.slice(1)} · ${contractGiver(c).name}`;

/** Journal id of the running contract, as the journal lists it. */
export const contractEntryId = (c: Contract): string => `contract-${c.id}`;

type ObjectiveView = { title: string | null; objective: string | null };

/** The entry the player pinned in the journal, while it is still running; null otherwise. */
const pinnedView = (domain: DomainState, locale: Locale, contractView: ObjectiveView | null): { id: string; view: ObjectiveView } | null => {
  const id = domain.preferences.trackedQuest;
  if (!id) return null;
  const contract = domain.contracts.active;
  if (contract && id === contractEntryId(contract) && contractView) return { id, view: contractView };
  const quest = QUEST_DEFINITIONS.find((q) => q.id === id);
  const progress = domain.quests[id];
  const step = quest && progress?.status === "active" ? quest.steps[progress.stepIndex] : undefined;
  return quest && step ? { id, view: { title: translateText(locale, quest.title), objective: translateText(locale, stepObjective(step, domain.flags)) } } : null;
};

/**
 * Journal id of the entry the HUD shows: the one the player pinned while it runs, else the main
 * thread's quest, else the running contract. Null before the story starts.
 */
export const shownEntryId = (domain: DomainState): string | null => {
  const contract = domain.contracts.active;
  const pinned = pinnedView(domain, "en", contract ? { title: null, objective: null } : null);
  if (pinned) return pinned.id;
  const main = activeMainStep(domain.quests, QUEST_DEFINITIONS);
  if (main && !(contract && CONTRACT_STEPS.has(main.step.id))) return main.quest.id;
  return contract ? contractEntryId(contract) : null;
};

/**
 * Title and objective for the HUD in `locale`: the journal entry the player pinned, else the main
 * thread (or the contract it is about), else the running contract. With `tick` a running delivery
 * shows its clock; the save label leaves it out.
 */
export const describeObjective = (domain: DomainState, locale: Locale, tick: number | null = null): ObjectiveView => {
  const contract = domain.contracts.active;
  const left = contract && tick !== null ? contractSecondsLeft(contract, tick, SIM_HZ) : null;
  const contractView = contract ? { title: contractTitle(contract), objective: contractObjective(contract, left) } : null;
  const pinned = pinnedView(domain, locale, contractView);
  if (pinned) return pinned.view;
  const main = activeMainStep(domain.quests, QUEST_DEFINITIONS);
  if (main) {
    if (contractView && CONTRACT_STEPS.has(main.step.id)) return contractView;
    return { title: translateText(locale, main.quest.title), objective: translateText(locale, stepObjective(main.step, domain.flags)) };
  }
  const started = QUEST_DEFINITIONS.some((q) => q.main && domain.quests[q.id]);
  if (!started) return { title: null, objective: null };
  const givers = [...(hasFlag(domain.flags, "met_hana") ? ["Hana z targu na Podzamczu"] : []), ...(hasFlag(domain.flags, "met_genzo") ? ["Genzō na Nabrzeżu"] : [])];
  const work = givers.length > 0 ? `Kaito ma kolejne kontrakty, ${givers.join(" i ")} też.` : "Kaito ma kolejne kontrakty.";
  return contractView ?? { title: "Wolna ręka", objective: `${work} Mori sprzedaje cyberware.` };
};

export const saveLabel = (date: Date): string =>
  date.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
