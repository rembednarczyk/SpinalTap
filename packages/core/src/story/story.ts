import { type CharacterState, hasMemory } from "../character/character";
import type { MemoryId } from "../character/memories";
import { type Flags, hasFlag } from "../state/flags";

/**
 * Main-thread choices. Each recovered memory fragment ends with exactly one of them. The first
 * option of every choice is the one where Seki owns the memory; the second keeps it at a distance.
 */
export const STORY_CHOICES = {
  /** courier_case: does she open the Kagami case in the memory? */
  case: ["opened", "sealed"],
  /** operating_table: does she tell the Kagami technician her name? */
  name: ["spoken", "silent"],
  /** crash_night: did she crash the car herself, or follow Ren's voice on the comm? */
  crash: ["wheel", "ren"],
} as const;

export type StoryChoiceId = keyof typeof STORY_CHOICES;
export type StoryOption = (typeof STORY_CHOICES)[StoryChoiceId][number];

export const ENDINGS = {
  /** Keeps the module and takes her old name back. */
  aya: { id: "aya", title: "Aya" },
  /** Has Mori cut the module out and stays the woman from the wreck. */
  seki: { id: "seki", title: "Seki Senshi" },
} as const;

export type EndingId = keyof typeof ENDINGS;

export interface StoryState {
  readonly choices: Readonly<Partial<Record<StoryChoiceId, StoryOption>>>;
  readonly ending: EndingId | null;
}

export const EMPTY_STORY: StoryState = { choices: {}, ending: null };

/** Flag raised by the sim once the act-I ending is resolved; the last quest step waits on it. */
export const ACT_ONE_ENDING_FLAG = "act1_ending";

export const isStoryChoiceId = (id: string): id is StoryChoiceId => Object.hasOwn(STORY_CHOICES, id);

export const isStoryOption = (choice: StoryChoiceId, option: string): option is StoryOption =>
  (STORY_CHOICES[choice] as readonly string[]).includes(option);

export const isEndingId = (id: string): id is EndingId => Object.hasOwn(ENDINGS, id);

/** A choice is made once; the first answer sticks (replaying a scene cannot rewrite the past). */
export const recordChoice = (story: StoryState, choice: StoryChoiceId, option: StoryOption): StoryState =>
  story.choices[choice] !== undefined || !isStoryOption(choice, option) ? story : { ...story, choices: { ...story.choices, [choice]: option } };

/** Two or more fragments taken as her own lead to "aya"; otherwise she lets the past go. */
export const resolveEnding = (choices: StoryState["choices"]): EndingId => {
  const owned = (Object.keys(STORY_CHOICES) as StoryChoiceId[]).filter((c) => choices[c] === STORY_CHOICES[c][0]).length;
  return owned >= 2 ? "aya" : "seki";
};

export const setEnding = (story: StoryState, ending: EndingId): StoryState => (story.ending ? story : { ...story, ending });

/** Memories that come with a playable flashback scene (ink knot `recall_<id>`), in story order. */
export const RECALL_MEMORIES: readonly MemoryId[] = ["courier_case", "operating_table", "crash_night"];

export const recalledFlag = (id: MemoryId): string => `recalled:${id}`;

export const recallDialogueId = (id: MemoryId): string => `recall_${id}`;

/** The first unlocked memory whose flashback has not been played yet. */
export const pendingRecall = (domain: { readonly character: CharacterState; readonly flags: Flags }): MemoryId | null =>
  RECALL_MEMORIES.find((id) => hasMemory(domain.character, id) && !hasFlag(domain.flags, recalledFlag(id))) ?? null;
