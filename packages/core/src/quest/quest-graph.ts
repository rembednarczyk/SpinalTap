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

export interface QuestStep {
  readonly id: string;
  readonly objective: string;
  readonly completeWhen: QuestCondition;
  readonly rewards: readonly QuestReward[];
}

export interface QuestDefinition {
  readonly id: string;
  readonly title: string;
  readonly main: boolean;
  readonly steps: readonly QuestStep[];
}

export type QuestProgress =
  | { readonly status: "active"; readonly stepIndex: number }
  | { readonly status: "completed" };

export type QuestLog = Readonly<Record<string, QuestProgress>>;

export type QuestTransition =
  | { readonly type: "advanced"; readonly questId: string; readonly step: QuestStep; readonly rewards: readonly QuestReward[] }
  | { readonly type: "completed"; readonly questId: string; readonly title: string; readonly rewards: readonly QuestReward[] };

export const evaluateCondition = (cond: QuestCondition, flags: Flags): boolean =>
  cond.type === "flag" ? hasFlag(flags, cond.flag) : cond.of.every((c) => evaluateCondition(c, flags));

export const startQuest = (log: QuestLog, quest: QuestDefinition): QuestLog =>
  log[quest.id] ? log : { ...log, [quest.id]: { status: "active", stepIndex: 0 } };

/**
 * Advances every active quest as far as the current flags allow. A single call can
 * complete several steps in order; steps are never skipped and "completed" is terminal.
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
