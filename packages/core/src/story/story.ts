import { type CharacterState, hasMemory } from "../character/character";
import type { MemoryId } from "../character/memories";
import type { FactionId } from "../reputation/reputation";
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
  // Act II ("Lustro", ADR-0023). The ending follows from `archive` alone; the others colour the talk.
  /** rooftop: two years ago on the market roof, does she take the Kagami run with Ren or alone? */
  rooftop: ["together", "alone"],
  /** last_call: in the wreck she hears who speaks behind Ren's voice. Does she keep listening? */
  voice: ["listened", "torn"],
  /** Kaito's job on Ren: does she refuse it or take it? */
  job: ["refused", "taken"],
  /** The Kagami archive on the overpass: back to the street, to Ren and Hebi, or to Kagami for her own recording. */
  archive: ["street", "hebi", "kagami"],
  // Act III ("Źródło", ADR-0095). The ending follows from `core` alone.
  /** The Kagami archive's core under the Trinity Chapel, Aya's original recording in it: wiped, let out into the city, or kept by her. */
  core: ["erase", "release", "keep"],
} as const;

/** The choices of act I; only they decide its ending. */
export const ACT_ONE_CHOICES = ["case", "name", "crash"] as const satisfies readonly (keyof typeof STORY_CHOICES)[];

export type StoryChoiceId = keyof typeof STORY_CHOICES;
export type StoryOption = (typeof STORY_CHOICES)[StoryChoiceId][number];

export const ENDINGS = {
  /** Keeps the module and takes her old name back. */
  aya: { id: "aya", title: "ending.aya.title" },
  /** Has Mori cut the module out and stays the woman from the wreck. */
  seki: { id: "seki", title: "ending.seki.title" },
} as const;

export type EndingId = keyof typeof ENDINGS;

export interface ActTwoEnding {
  readonly id: string;
  /** Catalog key of the title (`ending.<id>.title`, ADR-0056). */
  readonly title: string;
  /** Standing changes applied when the ending is reached. */
  readonly reputation: readonly { readonly faction: FactionId; readonly delta: number }[];
  /** A memory that comes with the ending (and its flashback). */
  readonly memory?: MemoryId;
}

/** Act II ("Lustro"): what happens to the Kagami archive. The ids are the options of `archive`. */
export const ACT_TWO_ENDINGS = {
  /** The chips go back to the people whose lives are on them; Kagami sends its cleaners. */
  street: {
    id: "street",
    title: "ending.street.title",
    reputation: [
      { faction: "civilians", delta: 15 },
      { faction: "hebi", delta: -5 },
      { faction: "kagami", delta: -20 },
    ],
  },
  /** Ren keeps the archive and sells it through Hebi; Kagami sends its cleaners. */
  hebi: {
    id: "hebi",
    title: "ending.hebi.title",
    reputation: [
      { faction: "hebi", delta: 15 },
      { faction: "civilians", delta: -5 },
      { faction: "kagami", delta: -20 },
    ],
  },
  /** She hands Ren and the archive to Kagami and gets her full recording. No fight. */
  kagami: {
    id: "kagami",
    title: "ending.kagami.title",
    reputation: [
      { faction: "kagami", delta: 20 },
      { faction: "fixers", delta: 10 },
      { faction: "hebi", delta: -10 },
      { faction: "civilians", delta: -5 },
    ],
    memory: "mirror",
  },
} as const satisfies Record<(typeof STORY_CHOICES)["archive"][number], ActTwoEnding>;

export type ActTwoEndingId = keyof typeof ACT_TWO_ENDINGS;

/** Act III ("Źródło", ADR-0095): what becomes of the Kagami archive's core. The ids are the options of `core`. */
export const ACT_THREE_ENDINGS = {
  /** "Silence": she wipes the archive, Aya's original with it. */
  erase: {
    id: "erase",
    title: "ending.erase.title",
    reputation: [
      { faction: "kagami", delta: -30 },
      { faction: "civilians", delta: 5 },
    ],
  },
  /** "The city's echo": the archive goes out on the city's net; everyone gets their memories back, wanted or not. */
  release: {
    id: "release",
    title: "ending.release.title",
    reputation: [
      { faction: "civilians", delta: 15 },
      { faction: "hebi", delta: 5 },
      { faction: "kagami", delta: -30 },
    ],
  },
  /** "The keeper": she stays by the core and decides who gets what back. */
  keep: {
    id: "keep",
    title: "ending.keep.title",
    reputation: [
      { faction: "kagami", delta: 20 },
      { faction: "fixers", delta: 10 },
      { faction: "civilians", delta: -10 },
    ],
  },
} as const satisfies Record<(typeof STORY_CHOICES)["core"][number], ActTwoEnding>;

export type ActThreeEndingId = keyof typeof ACT_THREE_ENDINGS;

export interface StoryState {
  readonly choices: Readonly<Partial<Record<StoryChoiceId, StoryOption>>>;
  /** Act I. */
  readonly ending: EndingId | null;
  readonly act2Ending: ActTwoEndingId | null;
  readonly act3Ending: ActThreeEndingId | null;
}

export const EMPTY_STORY: StoryState = { choices: {}, ending: null, act2Ending: null, act3Ending: null };

/** Flag raised by the sim once the act-I ending is resolved; the last quest step waits on it. */
export const ACT_ONE_ENDING_FLAG = "act1_ending";

/** Flag raised by the sim once the act-II ending is resolved. */
export const ACT_TWO_ENDING_FLAG = "act2_ending";

/** Flag raised by the sim once the act-III ending is resolved. */
export const ACT_THREE_ENDING_FLAG = "act3_ending";

/** Which ending was reached, as a flag (`ending:aya`), so quest steps and NPC presence can follow it. */
export const endingFlag = (id: EndingId | ActTwoEndingId | ActThreeEndingId): string => `ending:${id}`;

export const isStoryChoiceId = (id: string): id is StoryChoiceId => Object.hasOwn(STORY_CHOICES, id);

export const isStoryOption = (choice: StoryChoiceId, option: string): option is StoryOption =>
  (STORY_CHOICES[choice] as readonly string[]).includes(option);

export const isEndingId = (id: string): id is EndingId => Object.hasOwn(ENDINGS, id);

export const isActTwoEndingId = (id: string): id is ActTwoEndingId => Object.hasOwn(ACT_TWO_ENDINGS, id);

export const isActThreeEndingId = (id: string): id is ActThreeEndingId => Object.hasOwn(ACT_THREE_ENDINGS, id);

/** A choice is made once; the first answer sticks (replaying a scene cannot rewrite the past). */
export const recordChoice = (story: StoryState, choice: StoryChoiceId, option: StoryOption): StoryState =>
  story.choices[choice] !== undefined || !isStoryOption(choice, option) ? story : { ...story, choices: { ...story.choices, [choice]: option } };

/** Two or more fragments taken as her own lead to "aya"; otherwise she lets the past go. */
export const resolveEnding = (choices: StoryState["choices"]): EndingId => {
  const owned = ACT_ONE_CHOICES.filter((c) => choices[c] === STORY_CHOICES[c][0]).length;
  return owned >= 2 ? "aya" : "seki";
};

export const setEnding = (story: StoryState, ending: EndingId): StoryState => (story.ending ? story : { ...story, ending });

/** Act II ends where the archive goes; null until that choice is made. */
export const resolveActTwoEnding = (choices: StoryState["choices"]): ActTwoEndingId | null => {
  const archive = choices.archive;
  return archive !== undefined && isActTwoEndingId(archive) ? archive : null;
};

export const setActTwoEnding = (story: StoryState, act2Ending: ActTwoEndingId): StoryState =>
  story.act2Ending ? story : { ...story, act2Ending };

/** Act III ends with what she does to the core; null until that choice is made. */
export const resolveActThreeEnding = (choices: StoryState["choices"]): ActThreeEndingId | null => {
  const core = choices.core;
  return core !== undefined && isActThreeEndingId(core) ? core : null;
};

export const setActThreeEnding = (story: StoryState, act3Ending: ActThreeEndingId): StoryState =>
  story.act3Ending ? story : { ...story, act3Ending };

/** Memories that come with a playable flashback scene (ink knot `recall_<id>`), in story order. */
export const RECALL_MEMORIES: readonly MemoryId[] = ["courier_case", "operating_table", "crash_night", "rooftop", "last_call", "mirror", "chapel"];

export const recalledFlag = (id: MemoryId): string => `recalled:${id}`;

export const recallDialogueId = (id: MemoryId): string => `recall_${id}`;

/** The first unlocked memory whose flashback has not been played yet. */
export const pendingRecall = (domain: { readonly character: CharacterState; readonly flags: Flags }): MemoryId | null =>
  RECALL_MEMORIES.find((id) => hasMemory(domain.character, id) && !hasFlag(domain.flags, recalledFlag(id))) ?? null;

/** Scenes that play once, on their own, when the player is free (ink knot of the same name). */
export const ACT_TWO_OPENING = "act2_opening";
/** Act III's opening (ADR-0095) and its epilogue, once the ending is reached. */
export const ACT_THREE_OPENING = "act3_opening";
export const ACT_THREE_EPILOGUE = "act3_epilogue";

export const seenFlag = (scene: string): string => `seen:${scene}`;
