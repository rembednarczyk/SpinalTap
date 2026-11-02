import { ENEMY_TYPES, type EnemyTypeId, type EntityId, type ReinforcementsSnapshot, type Vec3 } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "./components";
import type { SessionWatch } from "./context";
import { entitySnapshotOf, gangerEntity, toughen } from "./factory";
import { revived } from "./actor-spawner";
import { restoreDowned } from "./bodies";

/**
 * The `n`-th of the heat's reinforcements (ADR-0029), come in at tick `since`. Whether it is an
 * enforcer follows from `n`, not from its id (G-179): the ids of a loaded game are others, bags
 * taking new ones on loading.
 */
export const reinforcementEntity = (id: EntityId, n: number, since: number, type: EnemyTypeId, at: Vec3, npcHealth: number): Entity => {
  const g: Entity = { ...gangerEntity(n, { key: "", position: at, yaw: 0 }, null, ENEMY_TYPES[type].hp, "", undefined, type), id };
  delete g.key;
  // No chunk either (G-219): sent across the city, it stays in the world as its body does, so one
  // knocked out alive does not fall asleep with the chunk it lies in, unkeyed, gone for good.
  delete g.chunk;
  g.security = { n, since };
  return toughen(g, npcHealth);
};

/**
 * What a reinforcement is remembered by across saves (G-202): its `n` with the tick it came in
 * at, as `n` counts again from 1 in the next heat. Unique for the whole life of a save.
 */
export const securityKey = (s: { readonly n: number; readonly since: number }): string => `security:${s.n}@${s.since}`;

const SECURITY_KEY = /^security:\d+@\d+$/;

/**
 * Is `key` that of a reinforcement no longer in the world (G-209)? It went home, or died leaving
 * no body, and none other ever has its key, so it can never be hacked again.
 */
export const goneReinforcement = (world: World<Entity>): ((key: string) => boolean) => {
  let present: Set<string> | null = null;
  return (key) => {
    if (!SECURITY_KEY.test(key)) return false;
    present ??= new Set(world.with("security").entities.map((e) => securityKey(e.security)));
    return !present.has(key);
  };
};

/** The reinforcements in the world, alive or dead, the count sent and the wait for the next (G-179); null with none of them. */
export const reinforcementsSnapshot = (world: World<Entity>, watch: SessionWatch): ReinforcementsSnapshot | null => {
  const people = [...world.with("security")]
    .sort((a, b) => a.security.n - b.security.n)
    .flatMap((e) => {
      const n = e.security.n;
      // A body of theirs has no mind and so no entry; it is made again where it lies (G-193).
      const home = e.ai?.home ?? e.position;
      return e.enemy ? [{ n, since: e.security.since, type: e.enemy.type, home: { ...home }, state: entitySnapshotOf({ ...e, key: `security:${n}` }) }] : [];
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
    const e = world.add(revived(reinforcementEntity(takeId(), p.n, p.since, p.type, { ...p.home }, npcHealth), p.state));
    if (p.state.downed) restoreDowned(world, e, p.state.downed);
  }
};
