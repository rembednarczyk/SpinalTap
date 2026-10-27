import { type LootContainer, bestLootRarity, expireContainers } from "@seki/core";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";

/** How close the player must stand to search a bag (metres). */
export const LOOT_REACH = 1.6;

const bagEntity = (id: number, c: LootContainer): Entity => {
  const position = { x: c.position.x, y: c.position.y, z: c.position.z };
  const e: Entity = {
    id,
    position,
    prevPosition: position,
    yaw: 0,
    prevYaw: 0,
    pitch: 0,
    view: { kind: "loot", style: "bag", best: bestLootRarity(c.lines) },
    lootBag: { key: c.key },
    interactable: { kind: "loot", dialogueId: c.key, prompt: "Przeszukaj", radius: LOOT_REACH },
  };
  if (c.chunk !== "") e.chunk = c.chunk;
  return e;
};

/**
 * Bags in the world follow `domain.loot` (ADR-0015): expired containers go (`LootExpired`), and
 * every container lying in a resident chunk has exactly one bag entity, spawned on load, on
 * streaming in, or when it drops. Taken-empty and expired ones lose their entity. Time runs
 * on in unloaded chunks: an expired bag never comes back.
 */
export const lootSystem: System = {
  name: "loot",
  run(ctx) {
    syncBags(ctx);
  },
};

export const syncBags = (ctx: SimContext): void => {
  const expiry = expireContainers(ctx.state.domain.loot, ctx.tick);
  if (expiry.expired.length > 0) {
    ctx.state.domain = { ...ctx.state.domain, loot: expiry.loot };
    for (const c of expiry.expired) ctx.bus.emit("LootExpired", { containerKey: c.key });
  }
  const containers = ctx.state.domain.loot.containers;
  const live = new Map<string, Entity>();
  for (const e of [...ctx.world.with("lootBag")]) {
    if (containers.some((c) => c.key === e.lootBag.key)) live.set(e.lootBag.key, e);
    else ctx.world.remove(e);
  }
  for (const c of containers) {
    if (live.has(c.key) || (c.chunk !== "" && !ctx.streamer.isLoaded(c.chunk))) continue;
    ctx.world.add(bagEntity(ctx.streamer.takeId(), c));
  }
};
