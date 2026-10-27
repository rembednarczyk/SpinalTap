import type { FactionId } from "../reputation/reputation";
import type { MemoryId } from "../character/memories";
import { type Flags, hasFlag } from "../state/flags";

export type QuestCondition =
  | { readonly type: "flag"; readonly flag: string }
  | { readonly type: "all"; readonly of: readonly QuestCondition[] };

export type QuestReward =
  | { readonly type: "eddies"; readonly amount: number }
  | { readonly type: "reputation"; readonly faction: FactionId; readonly delta: number }
  | { readonly type: "memory"; readonly memoryId: MemoryId };

/** Another wording of a step's objective while `when` holds (the first match wins). */
export interface ObjectiveVariant {
  readonly when: QuestCondition;
  readonly objective: string;
}

export interface QuestStep {
  readonly id: string;
  readonly objective: string;
  /** How the objective reads in another situation, e.g. after a different ending of the act before. */
  readonly variants?: readonly ObjectiveVariant[];
  readonly completeWhen: QuestCondition;
  readonly rewards: readonly QuestReward[];
}

export interface QuestDefinition {
  readonly id: string;
  readonly title: string;
  readonly main: boolean;
  /** Id of the quest whose completion starts this one. Without it the quest is started explicitly. */
  readonly startsAfter?: string;
  readonly steps: readonly QuestStep[];
}

export type QuestProgress =
  | { readonly status: "active"; readonly stepIndex: number }
  | { readonly status: "completed" };

export type QuestLog = Readonly<Record<string, QuestProgress>>;

export type QuestTransition =
  | { readonly type: "started" | "advanced"; readonly questId: string; readonly step: QuestStep; readonly rewards: readonly QuestReward[] }
  | { readonly type: "completed"; readonly questId: string; readonly title: string; readonly rewards: readonly QuestReward[] };

/**
 * Domain facts that only count for the quest step active when they happen ("buy an implant
 * now", not "have bought one at some point"). The sim raises one flag per active step.
 */
export type ProgressEvent = "contract_completed" | "cyberware_installed";

export const progressFlag = (event: ProgressEvent, stepId: string): string => `${event}@${stepId}`;

export const evaluateCondition = (cond: QuestCondition, flags: Flags): boolean =>
  cond.type === "flag" ? hasFlag(flags, cond.flag) : cond.of.every((c) => evaluateCondition(c, flags));

/** The objective of `step` as the player should read it now. */
export const stepObjective = (step: QuestStep, flags: Flags): string =>
  step.variants?.find((v) => evaluateCondition(v.when, flags))?.objective ?? step.objective;

export const startQuest = (log: QuestLog, quest: QuestDefinition): QuestLog =>
  log[quest.id] ? log : { ...log, [quest.id]: { status: "active", stepIndex: 0 } };

/**
 * Advances every active quest as far as the current flags allow. A single call can
 * complete several steps in order; steps are never skipped and "completed" is terminal.
 * Completing a quest starts its follow-ups (`startsAfter`); a follow-up listed later in
 * `definitions` is evaluated in the same call.
 */
export const evaluateQuests = (
  log: QuestLog,
  definitions: readonly QuestDefinition[],
  flags: Flags,
): { log: QuestLog; transitions: QuestTransition[] } => {
  const transitions: QuestTransition[] = [];
  const next: Record<string, QuestProgress> = { ...log };
  for (const quest of definitions) {
    let progress = next[quest.id];
    while (progress?.status === "active") {
      const step = quest.steps[progress.stepIndex];
      if (!step || !evaluateCondition(step.completeWhen, flags)) break;
      const nextIndex = progress.stepIndex + 1;
      const nextStep = quest.steps[nextIndex];
      if (nextStep) {
        progress = { status: "active", stepIndex: nextIndex };
        transitions.push({ type: "advanced", questId: quest.id, step: nextStep, rewards: step.rewards });
      } else {
        progress = { status: "completed" };
        transitions.push({ type: "completed", questId: quest.id, title: quest.title, rewards: step.rewards });
        for (const follow of definitions) {
          const first = follow.steps[0];
          if (follow.startsAfter !== quest.id || next[follow.id] || !first) continue;
          next[follow.id] = { status: "active", stepIndex: 0 };
          transitions.push({ type: "started", questId: follow.id, step: first, rewards: [] });
        }
      }
      next[quest.id] = progress;
    }
  }
  return { log: next, transitions };
};

export const currentStep = (log: QuestLog, quest: QuestDefinition): QuestStep | null => {
  const progress = log[quest.id];
  return progress?.status === "active" ? (quest.steps[progress.stepIndex] ?? null) : null;
};

/** The current step of the active main quest, if any. Main quests run one after another. */
export const activeMainStep = (
  log: QuestLog,
  definitions: readonly QuestDefinition[],
): { readonly quest: QuestDefinition; readonly step: QuestStep } | null => {
  for (const quest of definitions) {
    const step = quest.main ? currentStep(log, quest) : null;
    if (step) return { quest, step };
  }
  return null;
};
