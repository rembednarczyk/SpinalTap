import { ENEMY_TYPES, type EnemyTypeId, type EntityId, type ReinforcementsSnapshot, type Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "./components";
import type { SessionWatch } from "./context";
import { entitySnapshotOf, gangerEntity, toughen } from "./factory";
import { revived } from "./actor-spawner";
import { restoreDowned } from "./bodies";

/**
 * The `n`-th of the heat's reinforcements (ADR-0029). Whether it is an enforcer follows from `n`,
 * not from its id (G-179): the ids of a loaded game are others, bags taking new ones on loading.
 */
export const reinforcementEntity = (id: EntityId, n: number, type: EnemyTypeId, at: Vec3, npcHealth: number): Entity => {
  const g: Entity = { ...gangerEntity(n, { key: "", position: at, yaw: 0 }, null, ENEMY_TYPES[type].hp, "", undefined, type), id };
  delete g.key;
  g.security = { n };
  return toughen(g, npcHealth);
};

/** The reinforcements in the world, alive or dead, the count sent and the wait for the next (G-179); null with none of them. */
export const reinforcementsSnapshot = (world: World<Entity>, watch: SessionWatch): ReinforcementsSnapshot | null => {
  const people = [...world.with("security")]
    .sort((a, b) => a.security.n - b.security.n)
    .flatMap((e) => {
      const n = e.security.n;
      // A body of theirs has no mind and so no entry; it is made again where it lies (G-193).
      const home = e.ai?.home ?? e.position;
      return e.enemy ? [{ n, type: e.enemy.type, home: { ...home }, state: entitySnapshotOf({ ...e, key: `security:${n}` }) }] : [];
    });
  return people.length > 0 || watch.sent > 0 || watch.reinforce > 0 ? { sent: watch.sent, wait: watch.reinforce, people } : null;
};

/** Brings back a save's reinforcements (G-179), in the order they came in, with the count sent and the wait. */
export const restoreReinforcements = (
  world: World<Entity>,
  watch: SessionWatch,
  saved: ReinforcementsSnapshot | undefined,
  takeId: () => EntityId,
  npcHealth: number,
): void => {
  if (!saved) return;
  watch.sent = saved.sent;
  watch.reinforce = saved.wait;
  for (const p of [...saved.people].sort((a, b) => a.n - b.n)) {
    const e = world.add(revived(reinforcementEntity(takeId(), p.n, p.type, { ...p.home }, npcHealth), p.state));
    if (p.state.downed) restoreDowned(world, e, p.state.downed);
  }
};
