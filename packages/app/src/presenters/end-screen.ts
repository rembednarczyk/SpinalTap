import { type DomainState, RECALL_MEMORIES, STORY_CHOICES, type StoryChoiceId, hasMemory } from "@seki/core";
import type { EndScreenVm } from "@seki/ui";

/** The main thread's choices in story order (act I, II, III), as the end screen lists them. */
const CHOICE_ORDER = Object.keys(STORY_CHOICES) as StoryChoiceId[];

/**
 * The end screen after the epilogue (ADR-0095 stage 2): each act's ending title, the choices made
 * along the thread as catalog keys, and the run's level, contracts and recovered memories.
 */
export const endScreenVm = (domain: DomainState): EndScreenVm => {
  const { story } = domain;
  const acts = [
    { act: "endScreen.act1", id: story.ending },
    { act: "endScreen.act2", id: story.act2Ending },
    { act: "endScreen.act3", id: story.act3Ending },
  ].flatMap(({ act, id }) => (id ? [{ act, ending: `ending.${id}.title` }] : []));
  const choices = CHOICE_ORDER.flatMap((c) => {
    const option = story.choices[c];
    return option ? [`story.choice.${c}.${option}`] : [];
  });
  return {
    acts,
    choices,
    level: domain.progression.level,
    contracts: domain.contracts.completed,
    memories: RECALL_MEMORIES.filter((id) => hasMemory(domain.character, id)).length,
  };
};
