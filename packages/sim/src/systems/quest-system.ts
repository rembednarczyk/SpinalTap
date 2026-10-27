import { QUEST_DEFINITIONS, evaluateQuests, type QuestReward } from "@seki/core";
import type { SimContext, System } from "../world/context";
import { adjustReputation, grantEddies, grantMemory } from "../world/domain-ops";

const applyReward = (ctx: SimContext, reward: QuestReward): void => {
  switch (reward.type) {
    case "eddies":
      grantEddies(ctx, reward.amount);
      break;
    case "reputation":
      adjustReputation(ctx, reward.faction, reward.delta);
      break;
    case "memory":
      grantMemory(ctx, reward.memoryId);
      break;
  }
};

/** Re-evaluates the quest graph whenever flags changed during the step and pays out step rewards. */
export const questSystem: System = {
  name: "quest",
  run(ctx) {
    if (!ctx.state.flagsDirty) return;
    ctx.state.flagsDirty = false;
    const { log, transitions } = evaluateQuests(ctx.state.domain.quests, QUEST_DEFINITIONS, ctx.state.domain.flags);
    if (transitions.length === 0) return;
    ctx.state.domain = { ...ctx.state.domain, quests: log };
    for (const t of transitions) {
      for (const r of t.rewards) applyReward(ctx, r);
      if (t.type !== "completed") ctx.bus.emit("QuestAdvanced", { questId: t.questId, stepId: t.step.id, objective: t.step.objective });
      else ctx.bus.emit("QuestCompleted", { questId: t.questId, title: t.title });
    }
  },
};
