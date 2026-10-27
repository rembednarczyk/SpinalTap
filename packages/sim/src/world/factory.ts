import { ENEMY_TYPES, type EnemyTypeId, type EntityId, type EntitySnapshot, type Vec3, type WeaponId, npcWeapon } from "@seki/core";
import { PLAYER_SPAWN } from "../content/district-m0";
import type { ActorDef, ActorSpawn, StaticProp } from "../content/builders";
import { SCHEDULES } from "../content/schedules";
import { aabbFromCenter } from "./collision";
import type { Combatant, Entity, MeleeState } from "./components";

const BODY = { radius: 0.38, height: 1.8 } as const;

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

/** Reach of a lift's call button, metres. */
const BUTTON_REACH = 3;

export const propEntity = (id: EntityId, prop: StaticProp, chunk: string): Entity => {
  const e: Entity = { id, ...at(prop.center), view: prop.view, chunk };
  if (prop.solid && prop.view.kind === "block") {
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
  } else if (m?.kind === "button") {
    // Hung about 1.2 m above its level's floor: the interaction's height check keeps it to that level.
    e.interactable = { kind: "elevator", elevator: { key: m.elevator, level: m.level }, dialogueId: m.elevator, prompt: "Winda", radius: BUTTON_REACH };
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
  const e: Entity = {
    ...actor(id, spawn),
    chunk,
    view: { kind: "enemy", preset: "ganger" },
    faction: def.faction,
    enemy: { type },
    velocity: { x: 0, y: 0, z: 0 },
    health: { current: maxHp, max: maxHp },
    combatant: npcCombatant(def.weapon),
    melee: idleMelee(),
    // A melee fighter has to close in: it attacks from inside its weapon's reach.
    ai: { home: spawn.position, aggroRange: 17, attackRange: meleeAttackRange(def.weapon) ?? 15, alerted: false, ...(victim ? { victim } : {}) },
  };
  if (tag) e.tag = tag;
  return e;
};

export const actorEntity = (id: EntityId, def: ActorDef, chunk: string): Entity => {
  const e = def.kind === "ganger" ? gangerEntity(id, def.spawn, def.spawn.tag, GANGER_MAX_HP, chunk) : npcEntity(id, def, chunk);
  const plan = SCHEDULES[def.spawn.key];
  if (plan) e.schedule = { def: plan, own: e.interactable ?? null, pose: null };
  return e;
};

const npcEntity = (id: EntityId, def: ActorDef & { kind: "npc" }, chunk: string): Entity => {
  const e: Entity = { ...actor(id, def.spawn), chunk, view: { kind: "npc", preset: def.preset }, faction: def.faction };
  if (def.interactable) e.interactable = def.interactable;
  if (def.maxHp !== undefined) e.health = { current: def.maxHp, max: def.maxHp };
  if (def.bystander) {
    e.velocity = { x: 0, y: 0, z: 0 };
    e.civilian = { home: def.spawn.position };
  }
  return e;
};

/** Size of a contract crate. */
const CRATE = { x: 0.9, y: 0.6, z: 0.6 } as const;

/** The crate of a retrieval contract: picked up with the interact key, no conversation. */
export const pickupEntity = (id: EntityId, key: string, position: Vec3, chunk: string): Entity => ({
  id,
  key,
  chunk,
  ...at(position),
  view: { kind: "block", size: CRATE, material: "glass" },
  interactable: { kind: "pickup", dialogueId: key, prompt: "Zabierz skrzynkę Hany", radius: 1.8 },
});

/** Contract targets get tougher as Seki completes more jobs. */
export const contractGangerHp = (completed: number): number => GANGER_MAX_HP + Math.min(60, completed * 10);

/** The saveable state of a keyed entity. */
export const entitySnapshotOf = (e: Entity & { key: string }): EntitySnapshot => ({
  key: e.key,
  position: e.position,
  yaw: e.yaw,
  pitch: e.pitch,
  hp: e.health?.current ?? null,
  cooldown: e.combatant?.cooldown ?? 0,
  alerted: e.ai?.alerted ?? false,
});

/** Puts saved state back onto a freshly built entity. */
export const applyEntitySnapshot = (e: Entity, s: EntitySnapshot): void => {
  e.position = s.position;
  e.prevPosition = s.position;
  e.yaw = s.yaw;
  e.prevYaw = s.yaw;
  e.pitch = s.pitch;
  if (e.health && s.hp !== null) e.health = { ...e.health, current: s.hp };
  if (e.combatant) e.combatant.cooldown = s.cooldown;
  if (e.ai) e.ai.alerted = s.alerted;
};
