import type { GameClock } from "@seki/core";
import type { World } from "miniplex";
import type { ChunkDef } from "../content/world-map";
import { isPresent } from "../content/builders";
import type { Entity } from "./components";
import type { ActorSpawner, StreamState } from "./actor-spawner";
import type { StreamCatalog } from "./stream-catalog";

export interface PresenceParts {
  readonly state: StreamState;
  readonly catalog: StreamCatalog;
  readonly spawner: ActorSpawner;
  readonly chunks: readonly ChunkDef[];
}

/**
 * Conditional actors follow the flags (ADR-0023): one whose condition starts to hold appears
 * in its resident chunk, one whose condition stops holding leaves the world and forgets its
 * sleeping state. Visits chunks in table order, so it stays deterministic.
 */
export const syncPresence = (world: World<Entity>, flags: readonly string[], clock: GameClock, parts: PresenceParts): void => {
  const { state, catalog, spawner } = parts;
  const live = new Map<string, Entity>();
  for (const e of world) if (e.key) live.set(e.key, e);
  // The contract's people too: a variation's targets come and go with the clock (ADR-0034).
  const conditional = catalog.conditional(parts.chunks);
  // Leaving first: one key may have a place per condition (ADR-0038).
  for (const t of conditional) {
    if (t.key === null || isPresent(t.when, flags)) continue;
    const e = live.get(t.key);
    if (e && e.id !== t.id) continue;
    state.dormant.delete(t.key);
    if (e) {
      world.remove(e);
      live.delete(t.key);
      // It walked off, it did not die: the renderer drops it like an unloaded chunk (G-033).
      state.streamedOut.add(e.id);
    }
  }
  for (const t of conditional) {
    if (t.key === null || !isPresent(t.when, flags)) continue;
    if (state.resident.has(t.chunk) && !live.has(t.key)) spawner.spawnActors(world, flags, [t], clock);
  }
};
