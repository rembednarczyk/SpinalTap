import { type LootContainer, addContainer, bestLootRarity, expireContainers, hasFlag } from "@seki/core";
import { WORLD_STASHES } from "../content/world-map";
import { raiseFlag } from "../world/domain-ops";
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
    placeStashes(ctx);
    syncBags(ctx);
  },
};

/** The player comes this close (horizontally) before a roof stash is put in place. */
const STASH_PLACE_RADIUS = 40;

export const stashFlag = (key: string): string => `placed:${key}`;

/**
 * Roof stashes (ADR-0021) are ordinary containers that never expire, put into the domain the
 * first time the player comes near. The flag records it, so a taken stash never comes back and
 * a saved game keeps both without a schema change.
 */
const placeStashes = (ctx: SimContext): void => {
  const player = ctx.world.with("player").first;
  if (!player) return;
  for (const s of WORLD_STASHES) {
    if (Math.hypot(player.position.x - s.at.x, player.position.z - s.at.z) > STASH_PLACE_RADIUS) continue;
    if (hasFlag(ctx.state.domain.flags, stashFlag(s.key))) continue;
    raiseFlag(ctx, stashFlag(s.key));
    const r = addContainer(ctx.state.domain.loot, {
      key: s.key,
      position: { x: s.at.x, y: s.at.y, z: s.at.z },
      chunk: ctx.streamer.chunkIdAt(s.at),
      expiresAtTick: Number.MAX_SAFE_INTEGER,
      lines: s.lines,
    });
    ctx.state.domain = { ...ctx.state.domain, loot: r.loot };
    for (const old of r.evicted) ctx.bus.emit("LootExpired", { containerKey: old.key });
  }
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
