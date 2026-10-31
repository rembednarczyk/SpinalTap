import { type Contract, type DomainState, type Locale, MEMORY_CATALOG, QUEST_DEFINITIONS, contractGiver, contractObjective, giverText, stepObjective, textRef } from "@seki/core";
import { contractEntryId, contractTitle, shownEntryId } from "./objective";
import { type JournalMemoryVm, type JournalQuestVm, type JournalVm, translate, translateText } from "@seki/ui";

/** "Go back to the giver for your pay"; the catalog names the giver (the genitive in Polish, ADR-0056). */
export const returnForPay = (locale: Locale, c: Contract): string => translateText(locale, textRef("journal.returnForPay", { giver: giverText(contractGiver(c).id) }));

/**
 * Quest log, contracts and recovered memories as the journal shows them, all in `locale`: the
 * journal's own words and the game data's keys (ADR-0056). Pure.
 */
export const buildJournal = (domain: DomainState, locale: Locale): JournalVm => {
  const quests: JournalQuestVm[] = [];
  for (const q of QUEST_DEFINITIONS) {
    const progress = domain.quests[q.id];
    if (!progress) continue;
    const reached = progress.status === "completed" ? q.steps.length : progress.stepIndex + 1;
    quests.push({
      id: q.id,
      title: translateText(locale, q.title),
      kind: q.main ? "main" : "side",
      status: progress.status,
      steps: q.steps
        .slice(0, reached)
        .map((s, i) => ({ objective: translateText(locale, stepObjective(s, domain.flags)), done: progress.status === "completed" || i < progress.stepIndex })),
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
        { objective: translateText(locale, contractObjective({ ...active, status: "active" })), done: active.status === "cleared" },
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
  const memories: JournalMemoryVm[] = domain.character.memories.map((id) => ({
    id,
    title: translateText(locale, MEMORY_CATALOG[id].title),
    description: translateText(locale, MEMORY_CATALOG[id].description),
  }));
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
