import type { CharacterState } from "../character/character";
import { type Flags, hasFlag } from "../state/flags";
import {
  ACT_ONE_ENDING_FLAG,
  ACT_TWO_ENDING_FLAG,
  ACT_TWO_OPENING,
  endingFlag,
  pendingRecall,
  recallDialogueId,
  recalledFlag,
  seenFlag,
} from "../story/story";
import { type QuestCondition, type QuestDefinition, type QuestLog, progressFlag } from "./quest-graph";

export const M0_TARGET_TAG = "hebi_courier";

export const QUEST_FIRST_CONTRACT: QuestDefinition = {
  id: "m0_first_contract",
  title: "Pierwsze zlecenie",
  main: true,
  steps: [
    {
      id: "find_fixer",
      objective: "Porozmawiaj z Kaito przy fotelu w klinice [E]",
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

/** Raised by Ume (or Mori, after the "seki" ending) when they say where Ren sleeps. */
export const REN_TRAIL_FLAG = "ren_trail";
/** Raised by Ren when he hands over the chip from the case. */
export const MET_REN_FLAG = "met_ren";
/** Raised by Kaito when he tells who pays for the job on Ren. */
export const KAGAMI_JOB_FLAG = "kagami_job";
/** Raised by Kurosawa's talk when Seki turns his offer down: the cleaners come out. */
export const KAGAMI_AMBUSH_FLAG = "kagami_ambush";
/** Kagami's cleaners on the overpass (keyed actors of the market, ADR-0023). */
export const KAGAMI_CLEANER_KEYS = ["kagami-cleaner-1", "kagami-cleaner-2", "kagami-cleaner-3"] as const;

/** Every cleaner is dead (the sim's `dead:<key>` flags). */
export const CLEANERS_DOWN: QuestCondition = { type: "all", of: KAGAMI_CLEANER_KEYS.map((k) => ({ type: "flag", flag: `dead:${k}` })) };

/**
 * Main thread, act II (ADR-0023). Starts after "Echo"; its first step reads differently after
 * the "seki" ending, where Mori sold the module. Ren's chip and Kaito's job each recover a memory
 * whose flashback must be played before the next step can complete. The last step ends when
 * the act-II ending is resolved: by Kurosawa (no fight) or by Ren once the cleaners are down.
 */
export const QUEST_MIRROR: QuestDefinition = {
  id: "m3_lustro",
  title: "Lustro",
  main: true,
  startsAfter: QUEST_ECHO.id,
  steps: [
    {
      id: "ren_trail",
      objective: "Ktoś woła cię przez moduł. Zapytaj babcię Ume o Rena Odagiri",
      variants: [{ when: { type: "flag", flag: endingFlag("seki") }, objective: "Mori sprzedał twój moduł. Zapytaj go, kto go kupił" }],
      completeWhen: { type: "flag", flag: REN_TRAIL_FLAG },
      rewards: [],
    },
    {
      id: "meet_ren",
      objective: "Wejdź schodami pożarowymi na dach nad targiem i znajdź Rena",
      completeWhen: { type: "flag", flag: MET_REN_FLAG },
      rewards: [{ type: "memory", memoryId: "rooftop" }],
    },
    {
      id: "kaito_job",
      objective: "Kaito ma zlecenie na Rena. Dowiedz się, kto za nie płaci",
      completeWhen: { type: "all", of: [{ type: "flag", flag: recalledFlag("rooftop") }, { type: "flag", flag: KAGAMI_JOB_FLAG }] },
      rewards: [{ type: "memory", memoryId: "last_call" }],
    },
    {
      id: "overpass",
      objective: "Kurosawa z Kagami czeka na estakadzie nad targiem. Zdecyduj, co stanie się z archiwum",
      variants: [
        { when: CLEANERS_DOWN, objective: "Czyściciele Kagami leżą. Wróć do Rena na dach nad targiem" },
        { when: { type: "flag", flag: KAGAMI_AMBUSH_FLAG }, objective: "Czyściciele Kagami atakują na estakadzie. Odeprzyj ich" },
      ],
      completeWhen: { type: "all", of: [{ type: "flag", flag: recalledFlag("last_call") }, { type: "flag", flag: ACT_TWO_ENDING_FLAG }] },
      rewards: [],
    },
  ],
};

export const QUEST_DEFINITIONS: readonly QuestDefinition[] = [QUEST_FIRST_CONTRACT, QUEST_ECHO, QUEST_MIRROR];

/**
 * The scene that should play on its own as soon as the player is free: an unplayed memory
 * flashback first, then the act-II opening once that act has started. Driven by domain state,
 * so it survives a save. Returns the ink knot, or null.
 */
export const pendingScene = (domain: { readonly character: CharacterState; readonly flags: Flags; readonly quests: QuestLog }): string | null => {
  const memory = pendingRecall(domain);
  if (memory) return recallDialogueId(memory);
  if (domain.quests[QUEST_MIRROR.id] && !hasFlag(domain.flags, seenFlag(ACT_TWO_OPENING))) return ACT_TWO_OPENING;
  return null;
};

export const findQuest = (id: string): QuestDefinition | undefined => QUEST_DEFINITIONS.find((q) => q.id === id);
