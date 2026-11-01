import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "./components";
import { entitySnapshotOf } from "./factory";
import { inCreationOrder } from "./ordering";
import type { StreamState } from "./actor-spawner";

/**
 * Puts chunks to sleep: their entities leave the ECS world, keyed ones leaving their state
 * behind as a dormant snapshot. An alerted AI and a carried body stay (pinned).
 */
export const unloadChunks = (world: World<Entity>, state: StreamState, chunkIds: ReadonlySet<string>, chunkIdAt: (p: Vec3) => string): void => {
  const staying = (id: string | undefined): boolean => id !== undefined && state.resident.has(id) && !chunkIds.has(id);
  // A character on a daily plan walks out of its chunk (300 m down Grodzka in Lublin, ADR-0045):
  // it sleeps only once neither its own chunk nor the one it stands in stays loaded.
  // A body (ADR-0065) lies where the player left it: it sleeps by the same rule.
  const standing = (e: Entity): string | undefined => (e.schedule || e.downed ? chunkIdAt(e.position) : undefined);
  const leaving = inCreationOrder(
    [...world].filter((e) => e.chunk !== undefined && (chunkIds.has(e.chunk) || chunkIds.has(standing(e) ?? "")) && !staying(e.chunk) && !staying(standing(e))),
  );
  for (const e of leaving) {
    // Chasing or looking for the player (ADR-0029), or on her shoulder (ADR-0065): it stays.
    if (e.ai?.alerted || e.ai?.lastKnown || e.downed?.carried) continue;
    if (e.key) state.dormant.set(e.key, entitySnapshotOf({ ...e, key: e.key }));
    world.remove(e);
    state.streamedOut.add(e.id);
  }
  for (const id of chunkIds) state.resident.delete(id);
};
