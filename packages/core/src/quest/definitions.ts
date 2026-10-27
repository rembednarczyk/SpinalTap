import { ACT_ONE_ENDING_FLAG, recalledFlag } from "../story/story";
import { type QuestDefinition, progressFlag } from "./quest-graph";

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

/** Flag raised by the Mori conversation about the module (ink `mori.module`). */
export const MORI_MODULE_FLAG = "mori_module";

/**
 * Main thread, act I. Each step recovers one memory fragment; the flashback scene (ink
 * `recall_<memory>`) must be played before the next step can complete.
 */
export const QUEST_ECHO: QuestDefinition = {
  id: "m3_echo",
  title: "Echo",
  main: true,
  startsAfter: QUEST_FIRST_CONTRACT.id,
  steps: [
    {
      id: "echo_contract",
      objective: "Weź od Kaito kontrakt i doprowadź go do końca",
      completeWhen: { type: "flag", flag: progressFlag("contract_completed", "echo_contract") },
      rewards: [{ type: "memory", memoryId: "courier_case" }],
    },
    {
      id: "ask_mori",
      objective: "Porozmawiaj z doktorem Mori o tym, co widziałaś",
      completeWhen: { type: "all", of: [{ type: "flag", flag: recalledFlag("courier_case") }, { type: "flag", flag: MORI_MODULE_FLAG }] },
      rewards: [{ type: "memory", memoryId: "operating_table" }],
    },
    {
      id: "new_implant",
      objective: "Wszczep u Mori nowy implant. Moduł reaguje na świeży chrom",
      completeWhen: {
        type: "all",
        of: [{ type: "flag", flag: recalledFlag("operating_table") }, { type: "flag", flag: progressFlag("cyberware_installed", "new_implant") }],
      },
      rewards: [{ type: "memory", memoryId: "crash_night" }],
    },
    {
      id: "decide",
      objective: "Wróć do Mori i zdecyduj, co zrobić z modułem",
      completeWhen: { type: "all", of: [{ type: "flag", flag: recalledFlag("crash_night") }, { type: "flag", flag: ACT_ONE_ENDING_FLAG }] },
      rewards: [{ type: "reputation", faction: "civilians", delta: 5 }],
    },
  ],
};

export const QUEST_DEFINITIONS: readonly QuestDefinition[] = [QUEST_FIRST_CONTRACT, QUEST_ECHO];

export const findQuest = (id: string): QuestDefinition | undefined => QUEST_DEFINITIONS.find((q) => q.id === id);
