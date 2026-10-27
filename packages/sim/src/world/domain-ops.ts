import {
  type FactionId,
  type MemoryId,
  MEMORY_CATALOG,
  type ProgressEvent,
  QUEST_DEFINITIONS,
  type ReputationCause,
  changeReputation,
  contractPayout,
  credit,
  currentStep,
  progressFlag,
  hasFlag,
  hasMemory,
  reputationEffects,
  setFlag,
  unlockMemory,
} from "@seki/core";
import type { SimContext } from "./context";

/** Domain mutations shared by systems and command handling. Each one emits its own event. */
export const raiseFlag = (ctx: SimContext, flag: string): void => {
  if (hasFlag(ctx.state.domain.flags, flag)) return;
  ctx.state.domain = { ...ctx.state.domain, flags: setFlag(ctx.state.domain.flags, flag) };
  ctx.state.flagsDirty = true;
};

/** Raises the step-scoped flag of `event` for the current step of every active quest. */
export const raiseProgress = (ctx: SimContext, event: ProgressEvent): void => {
  for (const quest of QUEST_DEFINITIONS) {
    const step = currentStep(ctx.state.domain.quests, quest);
    if (step) raiseFlag(ctx, progressFlag(event, step.id));
  }
};

export const grantEddies =(ctx: SimContext, base: number): void => {
  const amount = contractPayout(base, ctx.state.domain.reputation.fixers);
  const r = credit(ctx.state.domain.wallet, amount);
  if (!r.ok) return;
  ctx.state.domain = { ...ctx.state.domain, wallet: r.wallet };
  ctx.bus.emit("EddiesChanged", { balance: r.wallet.eddies, delta: amount });
};

export const adjustReputation = (ctx: SimContext, faction: FactionId, delta: number): void => {
  const before = ctx.state.domain.reputation[faction];
  const reputation = changeReputation(ctx.state.domain.reputation, faction, delta);
  ctx.state.domain = { ...ctx.state.domain, reputation };
  ctx.bus.emit("ReputationChanged", { faction, value: reputation[faction], delta: reputation[faction] - before });
};

/** Applies every faction's reaction to something the player did, in the order the rule table lists them. */
export const applyReputationCause = (ctx: SimContext, cause: ReputationCause): void => {
  for (const { faction, delta } of reputationEffects(cause)) adjustReputation(ctx, faction, delta);
};

export const grantMemory = (ctx: SimContext, id: MemoryId): void => {
  if (hasMemory(ctx.state.domain.character, id)) return;
  ctx.state.domain = { ...ctx.state.domain, character: unlockMemory(ctx.state.domain.character, id) };
  const m = MEMORY_CATALOG[id];
  ctx.bus.emit("MemoryUnlocked", { memoryId: id, title: m.title, description: m.description });
};
