import { type EntitySnapshot, type Vec3, takenFlag } from "@seki/core";
import type { World } from "miniplex";
import { isPresent } from "../content/builders";
import type { Entity } from "./components";
import { applyEntitySnapshot, isDead } from "./factory";
import { restoreDowned } from "./bodies";
import { type ActorSpawner, type StreamState, revived } from "./actor-spawner";
import type { StreamCatalog, Template } from "./stream-catalog";

export interface RestoreParts {
  readonly state: StreamState;
  readonly catalog: StreamCatalog;
  readonly spawner: ActorSpawner;
  readonly chunkIdAt: (p: Vec3) => string;
  /** Keys of the people of a cleared site (G-195). */
  readonly cleared: ReadonlySet<string>;
}

/** A replaced job's person (G-178): saved only while in the world, so back in it. */
const restoreFormer = (world: World<Entity>, flags: readonly string[], s: EntitySnapshot, t: Template, spawner: ActorSpawner): void => {
  if (isDead(flags, s.key) && !s.downed?.dead) return;
  const e = world.add(revived(spawner.build(t), s));
  if (s.downed) restoreDowned(world, e, s.downed);
};

/** A saved body that is in the world at once (ADR-0065): carried, or lying in a resident chunk. */
const bodyHere = (s: EntitySnapshot, parts: RestoreParts): boolean =>
  !!s.downed && (s.downed.carried || parts.state.resident.has(parts.chunkIdAt(s.position)));

/** Re-applies saved entity state: live entities directly, the rest as pinned or dormant. */
export const restoreEntities = (world: World<Entity>, flags: readonly string[], saved: readonly EntitySnapshot[], parts: RestoreParts): void => {
  const { state, catalog, spawner } = parts;
  const live = new Map<string, Entity>();
  for (const e of world) if (e.key) live.set(e.key, e);
  for (const s of saved) {
    const e = live.get(s.key);
    if (e) {
      applyEntitySnapshot(e, s);
      if (s.downed) restoreDowned(world, e, s.downed);
      continue;
    }
    const former = catalog.formerOf(s.key);
    // A cleared site's sleeper (G-195) in a save from before sites were cleared: gone with his chunk.
    if (former && parts.cleared.has(s.key) && !s.alerted && !s.lastKnown && !bodyHere(s, parts) && !state.resident.has(former.chunk)) continue;
    if (former) {
      restoreFormer(world, flags, s, former, spawner);
      continue;
    }
    const t = catalog.placeOf(s.key, flags);
    // The dead do not come back, but for a body left lying (ADR-0065).
    if (!t || (isDead(flags, s.key) && !s.downed?.dead) || flags.includes(takenFlag(s.key)) || !isPresent(t.when, flags)) continue;
    if (s.alerted || s.lastKnown || bodyHere(s, parts)) {
      // It was chasing (or looking for) the player when the save was made: pinned, alive outside
      // its chunk. A body on her shoulder, or lying in a resident chunk, is there too.
      const pinned = world.add(revived(spawner.build(t), s));
      if (s.downed) restoreDowned(world, pinned, s.downed);
    } else {
      state.dormant.set(s.key, s);
      state.streamedOut.add(t.id);
    }
  }
};
