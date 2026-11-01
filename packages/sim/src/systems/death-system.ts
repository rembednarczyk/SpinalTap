import { ENEMY_TYPES, LOOT_TABLES, contractKind, killXp, killedFlag, rollLoot } from "@seki/core";
import { deriveRandom } from "../rng/derive-random";
import type { Entity } from "../world/components";
import type { System } from "../world/context";
import { applyReputationCause, clearContract, dropLoot, raiseFlag } from "../world/domain-ops";
import { corpseOf } from "../world/bodies";
import { inCreationOrder } from "../world/ordering";
import { grantXp } from "../world/progression-ops";
import { disturb, isContractTarget, noteTally, offend } from "../world/street";

/** A body is noticed this far (ADR-0029). */
export const BODY_NOISE = 12;

export const deadFlag = (key: string): string => `dead:${key}`;

type Ctx = Parameters<System["run"]>[0];

/**
 * An enemy's bag, rolled once at death from its own stream (seed + key), so it does not
 * depend on anything that happened before and the main stream is untouched.
 */
const dropEnemyLoot = (ctx: Ctx, e: Entity): void => {
  if (!e.enemy || !e.key) return;
  const key = `loot:${e.key}`;
  dropLoot(ctx, key, e.position, rollLoot(LOOT_TABLES[ENEMY_TYPES[e.enemy.type].loot], deriveRandom(ctx.seed, key)));
};

const checkContractCleared = (ctx: Parameters<System["run"]>[0]): void => {
  const contract = ctx.state.domain.contracts.active;
  if (contract?.status !== "active") return;
  // Only eliminations and protection waves are won by killing; stash guards are optional.
  const kind = contractKind(contract);
  if (kind !== "eliminate" && kind !== "protect") return;
  // Judged by flags, not by the world: targets asleep in an unloaded chunk are still alive.
  const flags = ctx.state.domain.flags;
  for (let i = 0; i < contract.targets; i++) if (!flags.includes(deadFlag(`${contract.id}-g${i}`))) return;
  clearContract(ctx);
};

/**
 * Removes killed NPCs (recording it in flags and, when the player did it, in their faction's
 * standing; an enemy leaves its bag whoever killed it) and ends the run when the player flatlines.
 * A body (`downed`: killed in a takedown, or while knocked out) is left lying as a corpse with
 * the same id (ADR-0065).
 */
export const deathSystem: System = {
  name: "death",
  run(ctx) {
    const dead: Entity[] = [];
    for (const e of inCreationOrder(ctx.world.with("health"))) if (e.health.current <= 0) dead.push(e);
    const playerId = ctx.world.with("player").first?.id;
    for (const e of dead) {
      if (e.player) {
        if (!ctx.session.gameOver) {
          ctx.session.gameOver = true;
          ctx.bus.emit("PlayerDied", { entityId: e.id });
        }
        continue;
      }
      if (e.key) raiseFlag(ctx, deadFlag(e.key));
      const byPlayer = playerId !== undefined && e.lastHitBy === playerId;
      // Killing someone who was not fighting is a murder once someone sees it (ADR-0029).
      if (byPlayer && e.wronged) offend(ctx, "murder", e.position);
      if (byPlayer && !isContractTarget(ctx, e)) noteTally(ctx, (t) => ({ ...t, extraKills: t.extraKills + 1 }));
      disturb(ctx, "body", e.position, BODY_NOISE, e.id);
      if (e.tag) raiseFlag(ctx, killedFlag(e.tag));
      // A death the player did not cause (Hebi shooting Oyaji) is not held against them.
      if (e.faction && (e.lastHitBy === undefined || e.lastHitBy === playerId)) applyReputationCause(ctx, { type: "member-killed", faction: e.faction });
      dropEnemyLoot(ctx, e);
      // An enemy the player took down (ADR-0059); its level against the player's comes in stage 5.
      if (byPlayer && e.enemy) grantXp(ctx, killXp(e.enemy.type), "kill");
      ctx.bus.emit("EntityKilled", { entityId: e.id, tag: e.tag ?? null, ...(e.lastHitBy === undefined ? {} : { killerId: e.lastHitBy }) });
      ctx.world.remove(e);
      // Killed in a takedown, or while knocked out (ADR-0065): its body stays to be found, carried, hidden.
      if (e.downed) ctx.world.add(corpseOf(e, e.downed));
    }
    if (dead.length > 0) checkContractCleared(ctx);
  },
};
