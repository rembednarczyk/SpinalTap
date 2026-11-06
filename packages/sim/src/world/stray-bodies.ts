import { ENEMY_TYPES, type EntityId, type StrayBodySnapshot } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "./components";
import { entitySnapshotOf, gangerEntity, toughen } from "./factory";
import { revived } from "./actor-spawner";
import { restoreDowned } from "./bodies";
import type { EnemyScaling } from "./enemy-grade";

/**
 * Bodies of nobody the content or the heat knows (G-233): the muggers of a won micro-event, whose
 * keys went with it (ADR-0034). Unkeyed, they are saved by themselves, as a reinforcement's body is
 * (G-193): a load has them lying, carried or hidden where they were.
 */

const strays = (world: World<Entity>) => world.with("downed", "enemy").entities.filter((e) => !e.key && !e.security);

export const strayBodiesSnapshot = (world: World<Entity>): StrayBodySnapshot[] =>
  // In the order they came into the world: ids are taken one after another.
  [...strays(world)]
    .sort((a, b) => a.id - b.id)
    .map((e, i) => ({
      type: e.enemy.type,
      enforcer: !!(e.ai?.enforcer ?? (e.view?.kind === "enemy" && e.view.enforcer)),
      home: { ...(e.ai?.home ?? e.position) },
      chunk: e.chunk ?? "",
      state: entitySnapshotOf({ ...e, key: `stray:${i}` }),
    }));

/** A mugger as a micro-event makes it, with what its gone key and id decided (`enforcer`) as saved. */
const strayEntity = (id: EntityId, s: StrayBodySnapshot, scaling: EnemyScaling): Entity => {
  const g = gangerEntity(id, { key: "", position: s.home, yaw: 0 }, null, ENEMY_TYPES[s.type].hp, s.chunk, undefined, s.type);
  delete g.key;
  if (g.view?.kind === "enemy") g.view = { kind: "enemy", preset: g.view.preset, ...(s.enforcer ? { enforcer: true } : {}) };
  if (g.ai) {
    const { enforcer: _enforcer, ...ai } = g.ai;
    g.ai = s.enforcer ? { ...ai, enforcer: true } : ai;
  }
  return toughen(g, scaling);
};

export const restoreStrayBodies = (world: World<Entity>, saved: readonly StrayBodySnapshot[] | undefined, takeId: () => EntityId, scaling: EnemyScaling): void => {
  for (const s of saved ?? []) {
    const e = world.add(revived(strayEntity(takeId(), s, scaling), s.state));
    if (s.state.downed) restoreDowned(world, e, s.state.downed);
  }
};
