import { type DomainState, type GameClock, QUEST_DEFINITIONS, type QuestTarget, type Vec3, stepTarget } from "@seki/core";
import { type ActorDef, SCHEDULES, WORLD_CHUNKS, isPresent, scheduledPose } from "@seki/sim";
import { shownEntryId } from "./objective";

/** What the minimap needs to mark the target of the shown step: whom, and where to look if they are not in the world. */
export interface QuestMark {
  readonly actor: string;
  readonly spot: Vec3 | null;
}

/**
 * The target of the quest step the HUD shows (`shownEntryId`, the journal's pin included):
 * none for a contract, for a step that marks its own targets, or once the character is dead.
 */
export const shownQuestTarget = (domain: DomainState): QuestTarget | null => {
  const id = shownEntryId(domain);
  const quest = QUEST_DEFINITIONS.find((q) => q.id === id);
  const progress = quest ? domain.quests[quest.id] : undefined;
  const step = quest && progress?.status === "active" ? quest.steps[progress.stepIndex] : undefined;
  const target = step ? stepTarget(step, domain.flags) : undefined;
  return target && !domain.flags.includes(`dead:${target.actor}`) ? target : null;
};

let actorsByKey: Map<string, ActorDef[]> | null = null;

/** The content's characters by key; a key may have one per place, each with its presence condition. */
const actorDefs = (key: string): readonly ActorDef[] => {
  if (!actorsByKey) {
    actorsByKey = new Map();
    for (const chunk of WORLD_CHUNKS) {
      for (const def of chunk.actors) actorsByKey.set(def.spawn.key, [...(actorsByKey.get(def.spawn.key) ?? []), def]);
    }
  }
  return actorsByKey.get(key) ?? [];
};

/**
 * Where a character should be while it is not in the world (its chunk asleep, or not there yet):
 * on its daily plan at this hour, else at the spawn its presence flags pick, else its first one.
 */
export const expectedSpot = (actor: string, flags: readonly string[], clock: GameClock): Vec3 | null => {
  const plan = SCHEDULES[actor];
  if (plan) return scheduledPose(plan, clock).position;
  const defs = actorDefs(actor);
  return (defs.find((d) => isPresent(d.when, flags)) ?? defs[0])?.spawn.position ?? null;
};

/** The mark of the shown step for the minimap, or nothing when it sends the player to no one. */
export const questMark = (domain: DomainState): QuestMark | undefined => {
  const target = shownQuestTarget(domain);
  return target ? { actor: target.actor, spot: expectedSpot(target.actor, domain.flags, domain.clock) } : undefined;
};
