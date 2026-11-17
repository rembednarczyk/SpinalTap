import { SHARD_CYBER_CAPACITY, capacityMax, clampItemLevel, hasItemLevel, isInstanceDefId } from "@seki/core";

/*
 * What the migrations to the progression of ADR-0059 give an old save: the XP of v17 for the
 * quests and contracts it finished, the shards that keep its cyberware pool, and the level of a
 * v28 piece. Out of `migrations.ts` for its size (ADR-0031).
 */

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Experience of the quests (ADR-0059): each step's XP and the bonus for the whole quest, as the
 * quests pay it today, so an old save gets what a new game would. Spelled out, like the ids: a
 * migration describes its content. Act I pays 1350 since the balance test of stage 8 (4600 in v17).
 */
const V17_QUEST_XP: Readonly<Record<string, { readonly steps: readonly number[]; readonly quest: number }>> = {
  m0_first_contract: { steps: [100, 300, 250], quest: 600 },
  m3_echo: { steps: [150, 100, 150, 250], quest: 700 },
  m3_lustro: { steps: [600, 1000, 1000, 1500], quest: 3000 },
};

/**
 * XP of an old save's finished contract: the kinds of the finished ones are not kept, so an
 * average job (between a delivery, 500, and a docks job with guards, 1200; an elimination of
 * three is 1000).
 */
export const V17_CONTRACT_XP = 850;

/** The v16 cyberware pool: 12, +3 at 3, 6 and 10 finished contracts, +2 per shard (ADR-0033). */
const v16CapacityMax = (completed: number, shards: number): number =>
  12 + [3, 6, 10].filter((n) => completed >= n).length * 3 + shards * 2;

/**
 * Capacity shards that keep an old save's cyberware pool at least as big as it was: the pool
 * of v17 grows with the level, which a save with many contracts may not have reached yet.
 */
export const compensatingShards = (completed: number, shards: number, level: number): number => {
  const missing = v16CapacityMax(completed, shards) - capacityMax(level, shards);
  return missing > 0 ? Math.ceil(missing / SHARD_CYBER_CAPACITY) : 0;
};

/** XP an old save earned with the quests and contracts it finished (kills and hacks left no record). */
export const retroactiveXp = (domain: Json): number => {
  const quests = isObject(domain.quests) ? domain.quests : {};
  let xp = 0;
  for (const [id, table] of Object.entries(V17_QUEST_XP)) {
    const q = quests[id];
    if (!isObject(q)) continue;
    const done = q.status === "completed" ? table.steps.length : Number.isInteger(q.stepIndex) ? (q.stepIndex as number) : 0;
    xp += table.steps.slice(0, Math.max(0, done)).reduce((a, b) => a + b, 0) + (q.status === "completed" ? table.quest : 0);
  }
  const contracts = isObject(domain.contracts) ? domain.contracts : {};
  const completed = Number.isInteger(contracts.completed) ? Math.max(0, contracts.completed as number) : 0;
  return xp + completed * V17_CONTRACT_XP;
};

/**
 * The level an old piece gets from its tier (ADR-0059): common 1, uncommon 3, rare 5, a unique one
 * the player's level. Spelled out, like the ids: a migration describes the content of its time.
 */
export const V28_LEVEL_OF_TIER: Readonly<Record<string, number>> = { common: 1, uncommon: 3, rare: 5 };

/**
 * A v28 weapon or garment (an instance by `def`, a loot line by `item`) with its v29 level, put
 * right after the tier as a new piece has it. Anything else, or a piece that has one, as it was.
 */
export const withV28Level = (piece: unknown, idKey: "def" | "item", player: number): unknown => {
  if (!isObject(piece) || piece.level !== undefined || !isInstanceDefId(piece[idKey]) || !hasItemLevel(piece[idKey])) return piece;
  const tier = typeof piece.rarity === "string" ? piece.rarity : "common";
  const level = clampItemLevel(tier === "unique" ? player : (V28_LEVEL_OF_TIER[tier] ?? 1));
  const out: Json = {};
  for (const [k, v] of Object.entries(piece)) {
    out[k] = v;
    if (k === "rarity") out.level = level;
  }
  return "level" in out ? out : { ...out, level };
};
