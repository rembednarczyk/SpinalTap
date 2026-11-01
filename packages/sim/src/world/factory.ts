import { ENEMY_TYPES, type EnemyTypeId, type EntityId, type EntitySnapshot, type Vec3, type WeaponId, npcWeapon } from "@seki/core";
import { PLAYER_SPAWN } from "../content/district-m0";
import { SNIPER_PERCHES } from "../content/district-doki";
import type { ActorDef, ActorSpawn, StaticProp } from "../content/builders";
import { type DeviceDef, deviceView } from "../content/devices";
import { DOOR_CLOSE_DELAY } from "../content/doors";
import { SCHEDULES } from "../content/schedules";
import { aabbFromCenter } from "./collision";
import { type PrismDef, boundsOfPrisms, isConvex, prismsAt } from "./prism";
import type { Combatant, Entity, MeleeState } from "./components";
import { isEnforcer } from "./enforcer";
import { bodySnapshotOf } from "./bodies";

export const BODY = { radius: 0.38, height: 1.8 } as const;

export const GANGER_MAX_HP = 80;
export const PLAYER_MAX_HP = 100;

/** Allocates entity ids in creation order, which is fixed by the content tables. */
export class IdAllocator {
  private next: EntityId = 1;
  take(): EntityId {
    return this.next++;
  }
}

const actor = (id: EntityId, spawn: ActorSpawn): Entity => ({
  id,
  key: spawn.key,
  position: spawn.position,
  prevPosition: spawn.position,
  yaw: spawn.yaw,
  prevYaw: spawn.yaw,
  pitch: 0,
  body: BODY,
});

const at = (p: Vec3): Pick<Entity, "position" | "prevPosition" | "yaw" | "prevYaw" | "pitch"> => ({
  position: p,
  prevPosition: p,
  yaw: 0,
  prevYaw: 0,
  pitch: 0,
});

export const isDead = (flags: readonly string[], key: string): boolean => flags.includes(`dead:${key}`);

/** A combatant standing idle: no swing, no guard, not staggered. */
export const idleMelee = (): MeleeState => ({ phase: "idle", timer: 0, strike: 0, combo: 0, queued: false, stagger: 0, guard: false, parry: 0, parryCooldown: 0, knock: { x: 0, z: 0, time: 0 } });

export const playerEntity = (id: EntityId): Entity => ({
  ...actor(id, PLAYER_SPAWN),
  player: true,
  view: { kind: "heroine" },
  velocity: { x: 0, y: 0, z: 0 },
  health: { current: PLAYER_MAX_HP, max: PLAYER_MAX_HP },
  // Armed from the domain by syncPlayerWeapon.
  combatant: { weapon: null, stats: null, slot: "secondary", loaded: 0, reloading: 0, cooldown: 0, holstered: false, drawing: 0, bloom: 0 },
  melee: idleMelee(),
  posture: { crouched: false, amount: 0, prevAmount: 0, sprinting: false, aiming: false, aim: 0, prevAim: 0 },
});

/** Reach of a ladder's grab points, metres. */
const LADDER_REACH = 1.1;

/** Reach of a lift's call button, metres. */
const BUTTON_REACH = 3;

/**
 * The convex parts of a solid prop (ADR-0043): its own `prisms`, or a building's outline when
 * that is convex. A concave outline without parts is a content error: the importer splits it.
 */
const prismDefsOf = (prop: StaticProp): readonly PrismDef[] | null => {
  if (prop.prisms) return prop.prisms;
  if (prop.view.kind !== "building") return null;
  if (!isConvex(prop.view.outline)) throw new Error(`building outline at ${prop.center.x},${prop.center.z} is concave: give its convex prisms`);
  return [{ points: prop.view.outline, bottom: 0, top: prop.view.height }];
};

export const propEntity = (id: EntityId, prop: StaticProp, chunk: string): Entity => {
  const e: Entity = { id, ...at(prop.center), view: prop.view, chunk };
  // A building of the map is drawn as scenery (ADR-0045): the entity is its solid alone.
  if (prop.scenery) delete e.view;
  if (prop.seeThrough) e.seeThrough = true;
  if (prop.hide) e.hide = prop.hide;
  const parts = prop.solid ? prismDefsOf(prop) : null;
  if (parts) {
    e.prisms = prismsAt(parts, prop.center);
    e.solid = boundsOfPrisms(e.prisms);
  } else if (prop.solid && prop.view.kind === "block") {
    e.solid = aabbFromCenter(prop.center, prop.view.size);
    if (prop.view.slope) e.slope = prop.view.slope;
  }
  const m = prop.mechanism;
  if (m?.kind === "platform" && e.solid) {
    e.elevator = { key: m.key, levels: m.levels, speed: m.speed, target: 0, settled: false };
    e.velocity = { x: 0, y: 0, z: 0 };
  } else if (m?.kind === "gate" && e.solid) {
    e.gate = { elevator: m.elevator, level: m.level, closed: e.solid, travel: m.travel };
    e.velocity = { x: 0, y: 0, z: 0 };
  } else if (m?.kind === "door" && e.solid) {
    const d = m.door;
    e.door = { key: `${d.key}#${m.leaf}`, door: d.key, closed: e.solid, slide: m.slide, sensor: d.at, open: 0, idle: DOOR_CLOSE_DELAY, ...(d.lock ? { lock: d.lock } : {}) };
    // A sealed door never moves: a static solid, so the AI's ground raster sees it as a wall.
    if (d.lock?.kind !== "sealed") e.velocity = { x: 0, y: 0, z: 0 };
  } else if (m?.kind === "door-panel") {
    e.doorPanel = m.door;
  } else if (m?.kind === "button") {
    // Hung about 1.2 m above its level's floor: the interaction's height check keeps it to that level.
    e.interactable = { kind: "elevator", elevator: { key: m.elevator, level: m.level }, dialogueId: m.elevator, prompt: "prompt.elevator", radius: BUTTON_REACH };
  } else if (m?.kind === "ladder") {
    e.ladder = m.ladder;
  } else if (m?.kind === "ladder-end") {
    // A grab point is a place, not a thing: nothing to draw.
    delete e.view;
    e.interactable = {
      kind: "ladder",
      ladder: { key: m.ladder, end: m.end },
      dialogueId: m.ladder,
      prompt: m.end === "bottom" ? "prompt.ladder.up" : "prompt.ladder.down",
      radius: LADDER_REACH,
    };
  }
  return e;
};

/** An NPC with a full magazine of `weapon`, fired through the weapon's NPC profile. */
export const npcCombatant = (weapon: WeaponId): Combatant => {
  const stats = npcWeapon(weapon);
  return { weapon, stats, uid: null, slot: stats.slot, loaded: stats.magazine, reloading: 0, cooldown: 0, holstered: false, drawing: 0, bloom: 0 };
};

/** Distance from which an NPC with a melee weapon starts its swing; null for firearms. */
export const meleeAttackRange = (weapon: WeaponId): number | null => {
  const stats = npcWeapon(weapon);
  return stats.melee ? stats.range * 0.8 : null;
};

/** A Hebi ganger; weapon, outfit and loot come from its enemy type (ADR-0015). */
export const gangerEntity = (
  id: EntityId,
  spawn: ActorSpawn,
  tag: string | null,
  maxHp: number,
  chunk: string,
  victim?: string,
  type: EnemyTypeId = "hebi_ganger",
): Entity => {
  const def = ENEMY_TYPES[type];
  // Enforcers see through disguises (ADR-0033); the HUD marks them through the view.
  const enforcer = isEnforcer(spawn.key, id, def.faction);
  const e: Entity = {
    ...actor(id, spawn),
    chunk,
    view: { kind: "enemy", preset: def.faction === "tessen" ? "corpo" : "ganger", ...(enforcer ? { enforcer: true } : {}) },
    faction: def.faction,
    enemy: { type },
    velocity: { x: 0, y: 0, z: 0 },
    health: { current: maxHp, max: maxHp },
    combatant: npcCombatant(def.weapon),
    melee: idleMelee(),
    // A melee fighter has to close in: it attacks from inside its weapon's reach. Tessen's guards
    // (ADR-0024) see in a cone and fire their rifles from a little further out.
    ai:
      def.faction === "tessen"
        ? { home: spawn.position, aggroRange: GUARD_SIGHT, attackRange: 20, alerted: false, cone: true, ...(victim ? { victim } : {}) }
        : { home: spawn.position, aggroRange: 17, attackRange: meleeAttackRange(def.weapon) ?? 15, alerted: false, ...(victim ? { victim } : {}) },
  };
  if (tag) e.tag = tag;
  if (enforcer && e.ai) e.ai = { ...e.ai, enforcer: true };
  return e;
};

/** How far a corporate guard sees a standing player in front of it, metres. */
export const GUARD_SIGHT = 18;

/** Index of the perch nearest to `p`. */
export const nearestPerch = (perches: readonly Vec3[], p: Vec3): number => {
  let best = 0;
  let bestD = Infinity;
  perches.forEach((q, i) => {
    const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
};

/** A Tessen sniper (ADR-0024): an enemy without a behaviour tree, driven by the sniper system. */
export const sniperEntity = (id: EntityId, spawn: ActorSpawn, tag: string | null, maxHp: number, chunk: string, perches: readonly Vec3[] = SNIPER_PERCHES): Entity => {
  const def = ENEMY_TYPES.tessen_sniper;
  const e: Entity = {
    ...actor(id, spawn),
    chunk,
    view: { kind: "enemy", preset: "corpo" },
    faction: def.faction,
    enemy: { type: "tessen_sniper" },
    velocity: { x: 0, y: 0, z: 0 },
    health: { current: maxHp, max: maxHp },
    combatant: npcCombatant(def.weapon),
    melee: idleMelee(),
    sniper: { perches, phase: "idle", timer: 0, perch: nearestPerch(perches, spawn.position) },
  };
  if (tag) e.tag = tag;
  return e;
};

/** Mika's health: as much as Oyaji, a little less than a guard. */
export const ESCORT_MAX_HP = 110;

/** The defector of an escort job (ADR-0024): a civilian who walks the route while Seki is near. */
export const escortEntity = (id: EntityId, key: string, route: readonly [Vec3, ...Vec3[]], chunk: string): Entity => ({
  ...actor(id, { key, position: route[0], yaw: Math.PI }),
  chunk,
  view: { kind: "npc", preset: "civilian" },
  faction: "civilians",
  velocity: { x: 0, y: 0, z: 0 },
  health: { current: ESCORT_MAX_HP, max: ESCORT_MAX_HP },
  escort: { route },
});

/** Size of a hack job's terminal. */
const TERMINAL = { x: 0.7, y: 1.4, z: 0.5 } as const;

/** A hack job's terminal (ADR-0024): the interact key starts the hack. */
export const terminalEntity = (id: EntityId, key: string, foot: Vec3, chunk: string): Entity => ({
  id,
  key,
  chunk,
  ...at({ x: foot.x, y: foot.y + TERMINAL.y / 2, z: foot.z }),
  view: { kind: "block", size: TERMINAL, material: "glass" },
  interactable: { kind: "terminal", dialogueId: key, prompt: "prompt.terminal.hack", radius: 2 },
});

export const actorEntity = (id: EntityId, def: ActorDef, chunk: string): Entity => {
  const e =
    def.kind === "ganger"
      ? def.enemy
        ? gangerEntity(id, def.spawn, def.spawn.tag, ENEMY_TYPES[def.enemy].hp, chunk, undefined, def.enemy)
        : gangerEntity(id, def.spawn, def.spawn.tag, GANGER_MAX_HP, chunk)
      : npcEntity(id, def, chunk);
  if (def.kind === "ganger" && def.patrol && e.ai) e.ai = { ...e.ai, patrol: true };
  const plan = SCHEDULES[def.spawn.key];
  if (plan) e.schedule = { def: plan, own: e.interactable ?? null, pose: null };
  return e;
};

const npcEntity = (id: EntityId, def: ActorDef & { kind: "npc" }, chunk: string): Entity => {
  const view = def.indoor ? { kind: "npc" as const, preset: def.preset, umbrella: false } : { kind: "npc" as const, preset: def.preset };
  const e: Entity = { ...actor(id, def.spawn), chunk, view, faction: def.faction };
  if (def.interactable) e.interactable = def.interactable;
  if (def.maxHp !== undefined) e.health = { current: def.maxHp, max: def.maxHp };
  if (def.bystander) {
    e.velocity = { x: 0, y: 0, z: 0 };
    e.civilian = { home: def.spawn.position };
  }
  return e;
};

/** A camera or a hackable device (ADR-0029). Not solid, no health: hacks switch it off for a while. */
export const deviceEntity = (id: EntityId, def: DeviceDef): Entity => ({
  id,
  key: def.key,
  chunk: def.chunk,
  position: def.position,
  prevPosition: def.position,
  yaw: def.yaw,
  prevYaw: def.yaw,
  pitch: 0,
  view: deviceView(def.kind),
  faction: def.faction,
  device: {
    kind: def.kind,
    network: def.network,
    faction: def.faction,
    ...(def.restricted ? { restricted: def.restricted } : {}),
    spot: 0,
    cooldown: 0,
    noise: 0,
    broken: 0,
  },
});

/** Size of a contract crate. */
const CRATE = { x: 0.9, y: 0.6, z: 0.6 } as const;

/** Size of the data module of an infiltration. */
const DATA = { x: 0.4, y: 0.12, z: 0.3 } as const;

/**
 * The crate of a retrieval contract, or the data of an infiltration (ADR-0024): picked up with
 * the interact key, no conversation.
 */
export const pickupEntity = (id: EntityId, key: string, position: Vec3, chunk: string, what: "crate" | "data" = "crate"): Entity => ({
  id,
  key,
  chunk,
  ...at(position),
  view: { kind: "block", size: what === "crate" ? CRATE : DATA, material: "glass" },
  interactable: { kind: "pickup", dialogueId: key, prompt: what === "crate" ? "prompt.pickup.crate" : "prompt.pickup.data", radius: 1.8 },
});

/** Contract targets get tougher as Seki completes more jobs. */
export const contractGangerHp = (completed: number): number => GANGER_MAX_HP + Math.min(60, completed * 10);

/**
 * A hostile NPC as it appears in the world (`npcHealth`): its health, full, scaled. Called on a
 * freshly built entity, before any saved state goes back onto it (that keeps its saved health).
 */
export const toughen = (e: Entity, npcHealth: number): Entity => {
  if (e.view?.kind !== "enemy" || !e.health) return e;
  e.baseHp = e.health.max;
  // Whole points, as the content gives them (110 × 1.2 is not quite 132 in floating point).
  const max = Math.max(1, Math.round(e.health.max * npcHealth));
  e.health = { current: max, max };
  return e;
};

/**
 * Health of an enemy loaded from a save whose maximum then was `savedMax` (ADR-0066): the same
 * share of its maximum now, in whole points within 1..max, so a profile changed in between
 * applies to it too. Without a different maximum the saved health stays as it was.
 */
const restoredHealth = (health: NonNullable<Entity["health"]>, hp: number, savedMax: number): number =>
  savedMax === health.max || hp <= 0 ? hp : Math.min(health.max, Math.max(1, Math.round((health.max * hp) / savedMax)));

/** The saveable state of a keyed entity. */
export const entitySnapshotOf = (e: Entity & { key: string }): EntitySnapshot => {
  // A toughened enemy (ADR-0066) keeps the maximum it had, for the share of it on load.
  const max = e.health && e.baseHp !== undefined && e.health.max !== e.baseHp ? e.health.max : null;
  const s: EntitySnapshot = {
    key: e.key,
    position: e.position,
    yaw: e.yaw,
    pitch: e.pitch,
    hp: e.health?.current ?? null,
    ...(max !== null ? { maxHp: max } : {}),
    cooldown: e.combatant?.cooldown ?? 0,
    alerted: e.ai?.alerted ?? false,
  };
  // A body (ADR-0065): knocked out or dead, where the player left it.
  const body = e.downed ? { ...s, downed: bodySnapshotOf(e.downed) } : s;
  // Looking for the player (ADR-0029): where, for how long, and how long out of sight.
  const ai = e.ai;
  if (!ai?.lastKnown) return body;
  return { ...body, lastKnown: { ...ai.lastKnown }, search: ai.search ?? 0, lost: ai.lost ?? 0 };
};

/** Puts saved state back onto a freshly built entity. */
export const applyEntitySnapshot = (e: Entity, s: EntitySnapshot): void => {
  e.position = s.position;
  e.prevPosition = s.position;
  e.yaw = s.yaw;
  e.prevYaw = s.yaw;
  e.pitch = s.pitch;
  if (e.health && s.hp !== null) {
    // An enemy saved at another maximum (another `npcHealth`, ADR-0066): the base one unless saved.
    const savedMax = e.view?.kind === "enemy" ? (s.maxHp ?? e.baseHp ?? e.health.max) : e.health.max;
    e.health = { ...e.health, current: restoredHealth(e.health, s.hp, savedMax) };
  }
  if (e.combatant) e.combatant.cooldown = s.cooldown;
  if (e.ai) {
    e.ai.alerted = s.alerted;
    e.ai.lastKnown = s.lastKnown ? { ...s.lastKnown } : null;
    e.ai.search = s.search ?? 0;
    e.ai.lost = s.lost ?? 0;
  }
};
