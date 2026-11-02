import type { Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity, GangerAi } from "./components";
import { entitySnapshotOf } from "./factory";
import { inCreationOrder } from "./ordering";
import type { StreamState } from "./actor-spawner";

/**
 * Seconds an AI pinned in the world (ADR-0029) may chase the player outside every loaded chunk
 * before it gives up and falls asleep (G-188): longer than its own giving up (`GIVE_UP` and the
 * search after it), so this calms only one that never would (sent after a victim, or with the
 * player dead).
 */
export const PINNED_AWAY_SECONDS = 30;

/** Takes an entity out of the world, a keyed one leaving its state behind, but a forgotten one. */
const putToSleep = (world: World<Entity>, state: StreamState, e: Entity, forgotten: ReadonlySet<string>): void => {
  // Asleep, it is no longer pinned (G-188).
  if (e.ai?.away !== undefined) delete e.ai.away;
  // A replaced job's person (G-178) never wakes again: he leaves no state behind.
  if (e.key && !forgotten.has(e.key)) state.dormant.set(e.key, entitySnapshotOf({ ...e, key: e.key }));
  world.remove(e);
  state.streamedOut.add(e.id);
};

/**
 * Whether a point is near the player, within the load radius: there, inside the chunks, every
 * chunk is loaded, but outside them the terrain goes on (the nearest chunk's) and she may stand
 * on it (G-201). What is near her stays, as it would in a loaded chunk.
 */
export type NearPlayer = (p: Vec3) => boolean;

/**
 * Puts chunks to sleep: their entities leave the ECS world, keyed ones leaving their state
 * behind as a dormant snapshot. An alerted AI, a carried body and a keyed AI near the player
 * (G-201, then `sleepPinned`'s) stay (pinned).
 */
export const unloadChunks = (
  world: World<Entity>,
  state: StreamState,
  chunkIds: ReadonlySet<string>,
  chunkIdAt: (p: Vec3) => string,
  forgotten: ReadonlySet<string> = new Set(),
  near: NearPlayer = () => false,
): void => {
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
    if (e.ai && e.key && near(e.position)) continue;
    putToSleep(world, state, e, forgotten);
  }
  for (const id of chunkIds) state.resident.delete(id);
};

/** Gives up the chase: nothing seen, nowhere to look. */
const calmDown = (ai: GangerAi): void => {
  ai.alerted = false;
  ai.lastKnown = null;
  ai.search = 0;
  ai.lost = 0;
  ai.suspicion = 0;
};

/**
 * The keyed AIs pinned in the world while their chunk sleeps (G-188), every step. One standing
 * in a loaded chunk or near the player (G-201) stays as it is. Outside every loaded chunk a calm
 * one falls asleep at once, as it would have with its chunk, and one still after the player does after
 * `PINNED_AWAY_SECONDS`, calmed down: the session keeps nobody about for good. `ai.away` (saved)
 * counts that time and marks it pinned, so a save tells it from the sleepers.
 */
export const sleepPinned = (
  world: World<Entity>,
  state: StreamState,
  chunkIdAt: (p: Vec3) => string,
  forgotten: ReadonlySet<string>,
  near: NearPlayer,
  dt: number,
): void => {
  const strays: (Entity & { ai: GangerAi })[] = [];
  for (const e of world.with("ai")) {
    if (!e.key || e.chunk === undefined || state.resident.has(e.chunk)) {
      if (e.ai.away !== undefined) delete e.ai.away;
    } else if (state.resident.has(chunkIdAt(e.position)) || near(e.position)) {
      e.ai.away = 0;
    } else {
      e.ai.away = (e.ai.away ?? 0) + dt;
      if (!e.downed?.carried) strays.push(e);
    }
  }
  for (const e of inCreationOrder(strays)) {
    if ((e.ai.alerted || e.ai.lastKnown) && (e.ai.away ?? 0) < PINNED_AWAY_SECONDS) continue;
    calmDown(e.ai);
    putToSleep(world, state, e, forgotten);
  }
};
