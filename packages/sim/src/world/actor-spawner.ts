import { type EntityId, type EntitySnapshot, type GameClock, type Vec3, takenFlag } from "@seki/core";
import type { World } from "miniplex";
import { isPresent } from "../content/builders";
import type { Entity } from "./components";
import { applyEntitySnapshot, isDead, toughen } from "./factory";
import { corpseOf, freshDowned, restoreDowned } from "./bodies";
import { placeOnSchedule } from "./schedule";
import type { GroundField } from "./ground";
import { settle } from "./placement";
import type { StreamCatalog, Template } from "./stream-catalog";

/** What streaming keeps between frames: the resident chunks and who sleeps outside them. */
export interface StreamState {
  readonly resident: Set<string>;
  /** Saved state of keyed entities asleep in unloaded chunks, by key. */
  readonly dormant: Map<string, EntitySnapshot>;
  /** Ids of entities currently asleep in an unloaded chunk (lets the renderer skip exit animations). */
  readonly streamedOut: Set<EntityId>;
}

/**
 * A freshly built entity with its saved state; what is left of a body killed in a takedown
 * (ADR-0065) when the save says so. `restoreDowned` adds the rest once it is in the world.
 */
export const revived = (e: Entity, s: EntitySnapshot): Entity => {
  applyEntitySnapshot(e, s);
  return s.downed?.dead ? corpseOf(e, freshDowned(s.downed.playerAt, s.downed.fought, true)) : e;
};

/**
 * Brings a chunk's content into the ECS world: props as they are, characters new or woken from
 * their sleeping state, on their daily plan (ADR-0017) and with the difficulty's health (ADR-0066).
 */
export class ActorSpawner {
  constructor(
    private readonly state: StreamState,
    private readonly catalog: StreamCatalog,
    private readonly ground: GroundField,
    private readonly chunkIdAt: (p: Vec3) => string,
    private readonly enemyHealth: () => number,
  ) {}

  /** A character as it appears: hostile ones with the difficulty's health (ADR-0066), before any saved state. */
  build(t: Template): Entity {
    return toughen(t.make(), this.enemyHealth());
  }

  spawnProps(world: World<Entity>, chunkId: string): void {
    for (const t of this.catalog.propsOf(chunkId)) {
      world.add(t.make());
      this.state.streamedOut.delete(t.id);
    }
  }

  /** Spawns sleeping or new characters; with a clock, scheduled ones go where their plan says. */
  spawnActors(world: World<Entity>, flags: readonly string[], templates: readonly Template[], clock: GameClock | null): void {
    if (templates.length === 0) return;
    const alive = new Set<string>();
    for (const e of world) if (e.key) alive.add(e.key);
    for (const t of templates) {
      if (t.key === null || flags.includes(takenFlag(t.key)) || alive.has(t.key) || !isPresent(t.when, flags)) continue;
      const saved = this.state.dormant.get(t.key);
      // The dead do not come back, but for a body left lying (ADR-0065).
      if (isDead(flags, t.key) && !saved?.downed?.dead) continue;
      const e = saved ? revived(this.build(t), saved) : this.build(t);
      if (saved) this.state.dormant.delete(t.key);
      if (clock && e.schedule && !saved?.downed) placeOnSchedule(e, e.schedule.def, clock);
      settle(world, this.ground, e);
      world.add(e);
      if (saved?.downed) restoreDowned(world, e, saved.downed);
      this.state.streamedOut.delete(t.id);
    }
  }

  /**
   * Bodies asleep that lie in a chunk just loaded (ADR-0065): carried away from their own chunk,
   * they come back where they lie, as after a load (`bodyHere`), not only with their own chunk.
   */
  wakeBodies(world: World<Entity>, flags: readonly string[], loaded: ReadonlySet<string>, clock: GameClock): void {
    const lying: Template[] = [];
    for (const [key, s] of this.state.dormant) {
      if (!s.downed || !loaded.has(this.chunkIdAt(s.position))) continue;
      const t = this.catalog.placeOf(key, flags);
      if (t) lying.push(t);
    }
    this.spawnActors(world, flags, lying, clock);
  }
}
