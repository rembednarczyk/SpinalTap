import {
  LOOT_LIFETIME_SECONDS,
  type LootContainer,
  type LootLine,
  addContainer,
  bestLootRarity,
  type ContractFailure,
  type FactionId,
  type MemoryId,
  MEMORY_CATALOG,
  type ProgressEvent,
  QUEST_DEFINITIONS,
  type ReputationCause,
  changeReputation,
  contractFailedFlag,
  contractKind,
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

export const grantEddies = (ctx: SimContext, base: number): void => {
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

/** Puts a container into the domain (the loot system spawns its bag) and reports it. */
export const dropLoot = (ctx: SimContext, key: string, at: { x: number; y: number; z: number }, lines: readonly LootLine[]): void => {
  const container: LootContainer = {
    key,
    position: { x: at.x, y: 0, z: at.z },
    chunk: ctx.streamer.chunkIdAt(at),
    expiresAtTick: ctx.tick + Math.round(LOOT_LIFETIME_SECONDS / ctx.dt),
    lines,
  };
  const r = addContainer(ctx.state.domain.loot, container);
  ctx.state.domain = { ...ctx.state.domain, loot: r.loot };
  for (const old of r.evicted) ctx.bus.emit("LootExpired", { containerKey: old.key });
  ctx.bus.emit("LootDropped", { containerKey: key, at: container.position, best: bestLootRarity(lines) });
};

/** Marks the running contract's job as done (status "cleared"); the giver pays on the next talk. */
export const clearContract = (ctx: SimContext): void => {
  const contract = ctx.state.domain.contracts.active;
  if (contract?.status !== "active") return;
  const cleared = { ...contract, status: "cleared" as const };
  ctx.state.domain = { ...ctx.state.domain, contracts: { ...ctx.state.domain.contracts, active: cleared } };
  ctx.bus.emit("ContractCleared", { contract: cleared });
};

/**
 * Drops the running contract without pay. Its id is marked failed and never reused, so the
 * dead flags of its gangers cannot leak into a later contract.
 */
export const failContract = (ctx: SimContext, reason: ContractFailure): void => {
  const contract = ctx.state.domain.contracts.active;
  if (!contract) return;
  ctx.state.domain = { ...ctx.state.domain, contracts: { ...ctx.state.domain.contracts, active: null } };
  raiseFlag(ctx, contractFailedFlag(contract.id));
  applyReputationCause(ctx, { type: "contract-failed", kind: contractKind(contract) });
  ctx.bus.emit("ContractFailed", { contract, reason });
};
