import { type DomainState, MEMORY_CATALOG, QUEST_DEFINITIONS, contractGiver, contractObjective } from "@seki/core";
import { contractTitle } from "./objective";
import type { JournalMemoryVm, JournalQuestVm, JournalVm } from "@seki/ui";

/** Quest log, contracts and recovered memories as the journal shows them. Pure. */
export const buildJournal = (domain: DomainState): JournalVm => {
  const quests: JournalQuestVm[] = [];
  for (const q of QUEST_DEFINITIONS) {
    const progress = domain.quests[q.id];
    if (!progress) continue;
    const reached = progress.status === "completed" ? q.steps.length : progress.stepIndex + 1;
    quests.push({
      id: q.id,
      title: q.title,
      kind: q.main ? "main" : "side",
      status: progress.status,
      steps: q.steps.slice(0, reached).map((s, i) => ({ objective: s.objective, done: progress.status === "completed" || i < progress.stepIndex })),
    });
  }
  const { active, completed } = domain.contracts;
  if (active) {
    quests.push({
      id: `contract-${active.id}`,
      title: contractTitle(active),
      kind: "contract",
      status: "active",
      steps: [
        { objective: contractObjective({ ...active, status: "active" }), done: active.status === "cleared" },
        ...(active.status === "cleared" ? [{ objective: `Wróć do ${contractGiver(active).genitive} po zapłatę`, done: false }] : []),
      ],
    });
  }
  if (completed > 0) {
    quests.push({
      id: "contracts-done",
      title: "Wykonane kontrakty",
      kind: "contract",
      status: "completed",
      steps: [{ objective: `Wykonane i opłacone: ${completed}`, done: true }],
    });
  }
  const memories: JournalMemoryVm[] = domain.character.memories.map((id) => ({ id, title: MEMORY_CATALOG[id].title, description: MEMORY_CATALOG[id].description }));
  return { quests, memories };
};

/**
 * Memoised journal for per-frame HUD syncs. Domain updates replace the sub-objects they touch,
 * so comparing references is enough to know nothing the journal shows has changed.
 */
export const createJournalCache = (): ((domain: DomainState) => JournalVm) => {
  let last: { quests: unknown; contracts: unknown; memories: unknown; vm: JournalVm } | null = null;
  return (domain) => {
    if (last && last.quests === domain.quests && last.contracts === domain.contracts && last.memories === domain.character.memories) return last.vm;
    const vm = buildJournal(domain);
    last = { quests: domain.quests, contracts: domain.contracts, memories: domain.character.memories, vm };
    return vm;
  };
};
