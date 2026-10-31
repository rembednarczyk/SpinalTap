import { type Contract, type DomainState, type Locale, MEMORY_CATALOG, QUEST_DEFINITIONS, contractGiver, contractObjective, stepObjective } from "@seki/core";
import { contractEntryId, contractTitle, shownEntryId } from "./objective";
import { type JournalMemoryVm, type JournalQuestVm, type JournalVm, translate } from "@seki/ui";

/** "Go back to the giver for your pay"; Polish names the giver in the genitive (ADR-0056). */
export const returnForPay = (locale: Locale, c: Contract): string => {
  const giver = contractGiver(c);
  return translate(locale, "journal.returnForPay", { giver: locale === "pl" ? giver.genitive : giver.name });
};

/**
 * Quest log, contracts and recovered memories as the journal shows them, the journal's own words
 * in `locale`; quest titles and step objectives come from the game data as they are. Pure.
 */
export const buildJournal = (domain: DomainState, locale: Locale): JournalVm => {
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
      steps: q.steps
        .slice(0, reached)
        .map((s, i) => ({ objective: stepObjective(s, domain.flags), done: progress.status === "completed" || i < progress.stepIndex })),
    });
  }
  const { active, completed } = domain.contracts;
  if (active) {
    quests.push({
      id: contractEntryId(active),
      title: contractTitle(active, locale),
      kind: "contract",
      status: "active",
      steps: [
        { objective: contractObjective({ ...active, status: "active" }), done: active.status === "cleared" },
        ...(active.status === "cleared" ? [{ objective: returnForPay(locale, active), done: false }] : []),
      ],
    });
  }
  if (completed > 0) {
    quests.push({
      id: "contracts-done",
      title: translate(locale, "journal.contractsDone"),
      kind: "contract",
      status: "completed",
      steps: [{ objective: translate(locale, "journal.contractsPaid", { count: completed }), done: true }],
    });
  }
  // Mark the entry the HUD follows, and whether the player chose it.
  const shown = shownEntryId(domain);
  const pinned = domain.preferences.trackedQuest;
  const marked = quests.map((q) => (q.status === "active" && q.id === shown ? { ...q, tracked: true, pinned: q.id === pinned } : q));
  const memories: JournalMemoryVm[] = domain.character.memories.map((id) => ({ id, title: MEMORY_CATALOG[id].title, description: MEMORY_CATALOG[id].description }));
  return { quests: marked, memories };
};

/**
 * Memoised journal for per-frame HUD syncs. Domain updates replace the sub-objects they touch,
 * so comparing references is enough to know nothing the journal shows has changed.
 */
export const createJournalCache = (): ((domain: DomainState, locale: Locale) => JournalVm) => {
  let last: { quests: unknown; contracts: unknown; memories: unknown; flags: unknown; prefs: unknown; locale: Locale; vm: JournalVm } | null = null;
  return (domain, locale) => {
    // Flags too: a step's objective can read differently as the story moves (ADR-0023).
    if (
      last &&
      last.quests === domain.quests &&
      last.contracts === domain.contracts &&
      last.memories === domain.character.memories &&
      last.flags === domain.flags &&
      last.prefs === domain.preferences &&
      last.locale === locale
    ) {
      return last.vm;
    }
    const vm = buildJournal(domain, locale);
    last = { quests: domain.quests, contracts: domain.contracts, memories: domain.character.memories, flags: domain.flags, prefs: domain.preferences, locale, vm };
    return vm;
  };
};
