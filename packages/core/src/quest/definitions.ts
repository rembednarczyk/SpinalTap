import type { QuestDefinition } from "./quest-graph";

export const M0_TARGET_TAG = "hebi_courier";

export const QUEST_FIRST_CONTRACT: QuestDefinition = {
  id: "m0_first_contract",
  title: "Pierwsze zlecenie",
  main: true,
  steps: [
    {
      id: "find_fixer",
      objective: "Znajdź fixera przy barze „Neon Koi” [E]",
      completeWhen: { type: "flag", flag: "met_fixer" },
      rewards: [],
    },
    {
      id: "eliminate_courier",
      objective: "Zneutralizuj kuriera Hebi w zaułku na północy",
      completeWhen: { type: "flag", flag: `killed:${M0_TARGET_TAG}` },
      rewards: [{ type: "memory", memoryId: "combat_reflex" }],
    },
    {
      id: "report_back",
      objective: "Wróć do Kaito po zapłatę",
      completeWhen: { type: "flag", flag: "reported_back" },
      rewards: [
        { type: "eddies", amount: 500 },
        { type: "reputation", faction: "fixers", delta: 10 },
      ],
    },
  ],
};

export const QUEST_DEFINITIONS: readonly QuestDefinition[] = [QUEST_FIRST_CONTRACT];

export const findQuest = (id: string): QuestDefinition | undefined => QUEST_DEFINITIONS.find((q) => q.id === id);
