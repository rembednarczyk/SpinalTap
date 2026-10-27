import {
  ENEMY_TYPES,
  LOOT_TABLES,
  killedFlag,
  rollLoot,
} from "@seki/core";
import { deriveRandom } from "../rng/derive-random";
import type { Entity } from "../world/components";
import type { System } from "../world/context";
import { applyReputationCause, dropLoot, raiseFlag } from "../world/domain-ops";
import { inCreationOrder } from "../world/ordering";

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
  // Judged by flags, not by the world: targets asleep in an unloaded chunk are still alive.
  const flags = ctx.state.domain.flags;
  for (let i = 0; i < contract.targets; i++) if (!flags.includes(deadFlag(`${contract.id}-g${i}`))) return;
  const cleared = { ...contract, status: "cleared" as const };
  ctx.state.domain = { ...ctx.state.domain, contracts: { ...ctx.state.domain.contracts, active: cleared } };
  ctx.bus.emit("ContractCleared", { contract: cleared });
};

/**
 * Removes killed NPCs (recording it in flags and in their faction's standing, leaving an enemy's bag) and ends the
 * run when the player flatlines.
 */
export const deathSystem: System = {
  name: "death",
  run(ctx) {
    const dead: Entity[] = [];
    for (const e of inCreationOrder(ctx.world.with("health"))) if (e.health.current <= 0) dead.push(e);
    for (const e of dead) {
      if (e.player) {
        if (!ctx.session.gameOver) {
          ctx.session.gameOver = true;
          ctx.bus.emit("PlayerDied", { entityId: e.id });
        }
        continue;
      }
      if (e.key) raiseFlag(ctx, deadFlag(e.key));
      if (e.tag) raiseFlag(ctx, killedFlag(e.tag));
      if (e.faction) applyReputationCause(ctx, { type: "member-killed", faction: e.faction });
      dropEnemyLoot(ctx, e);
      ctx.bus.emit("EntityKilled", { entityId: e.id, tag: e.tag ?? null });
      ctx.world.remove(e);
    }
    if (dead.length > 0) checkContractCleared(ctx);
  },
};
