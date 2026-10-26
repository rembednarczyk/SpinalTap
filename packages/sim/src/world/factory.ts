import { type Contract, type DomainState, type EntityId, type Vec3, contractTag } from "@seki/core";
import { World } from "miniplex";
import {
  CIVILIAN_SPAWN,
  CONTRACT_SITE_SPAWNS,
  DISTRICT_M0_PROPS,
  FIXER_SPAWN,
  GANGER_SPAWNS,
  PLAYER_SPAWN,
  RIPPERDOC_SPAWN,
  type ActorSpawn,
} from "../content/district-m0";
import { aabbFromCenter } from "./collision";
import type { Entity } from "./components";

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

const actor = (ids: IdAllocator, spawn: ActorSpawn): Entity => ({
  id: ids.take(),
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

const isDead = (domain: DomainState, key: string): boolean => domain.flags.includes(`dead:${key}`);

const ganger = (ids: IdAllocator, spawn: ActorSpawn, tag: string | null, maxHp: number): Entity => {
  const e: Entity = {
    ...actor(ids, spawn),
    view: { kind: "enemy", preset: "ganger" },
    faction: "hebi",
    velocity: { x: 0, y: 0, z: 0 },
    health: { current: maxHp, max: maxHp },
    combatant: { weapon: "gangerSmg", cooldown: 0 },
    ai: { home: spawn.position, aggroRange: 17, attackRange: 15, alerted: false },
  };
  if (tag) e.tag = tag;
  return e;
};

/** Contract targets get tougher as Seki completes more jobs. */
export const contractGangerHp = (completed: number): number => GANGER_MAX_HP + Math.min(60, completed * 10);

/** Adds the still-living targets of a contract. Used on acceptance and when rebuilding after a load. */
export const spawnContractTargets = (world: World<Entity>, ids: IdAllocator, domain: DomainState, contract: Contract): void => {
  const points = CONTRACT_SITE_SPAWNS[contract.siteId];
  for (let i = 0; i < contract.targets; i++) {
    const key = `${contract.id}-g${i}`;
    const position = points[i % points.length];
    if (!position || isDead(domain, key)) continue;
    // Face the street centre line.
    const yaw = Math.atan2(-position.x, 0.001);
    world.add(ganger(ids, { key, position, yaw }, contractTag(contract.id), contractGangerHp(domain.contracts.completed)));
  }
};

/**
 * Builds the M0 district. Entities whose `dead:<key>` flag is set are skipped, so the same
 * factory serves both a new game and a load.
 */
export const createDistrictWorld = (domain: DomainState): { world: World<Entity>; ids: IdAllocator } => {
  const world = new World<Entity>();
  const ids = new IdAllocator();

  for (const prop of DISTRICT_M0_PROPS) {
    const e: Entity = { id: ids.take(), ...at(prop.center), view: prop.view };
    if (prop.solid && prop.view.kind === "block") e.solid = aabbFromCenter(prop.center, prop.view.size);
    world.add(e);
  }

  world.add({
    ...actor(ids, PLAYER_SPAWN),
    player: true,
    view: { kind: "heroine" },
    velocity: { x: 0, y: 0, z: 0 },
    health: { current: PLAYER_MAX_HP, max: PLAYER_MAX_HP },
    combatant: { weapon: "pistol", cooldown: 0 },
  });

  world.add({
    ...actor(ids, FIXER_SPAWN),
    view: { kind: "npc", preset: "fixer" },
    faction: "fixers",
    interactable: { kind: "dialogue", dialogueId: "fixer", prompt: "Rozmawiaj z Kaito", radius: 2.6 },
  });

  world.add({
    ...actor(ids, CIVILIAN_SPAWN),
    view: { kind: "npc", preset: "civilian" },
    faction: "civilians",
    interactable: { kind: "dialogue", dialogueId: "ume", prompt: "Rozmawiaj z babcią Ume", radius: 2.4 },
  });

  world.add({
    ...actor(ids, RIPPERDOC_SPAWN),
    view: { kind: "npc", preset: "ripperdoc" },
    faction: "civilians",
    interactable: { kind: "shop", dialogueId: "mori", prompt: "Klinika doktora Mori", radius: 2.4 },
  });

  for (const g of GANGER_SPAWNS) {
    if (isDead(domain, g.key)) continue;
    world.add(ganger(ids, g, g.tag, GANGER_MAX_HP));
  }

  const contract = domain.contracts.active;
  if (contract?.status === "active") spawnContractTargets(world, ids, domain, contract);
  return { world, ids };
};
