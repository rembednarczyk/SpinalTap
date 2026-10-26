import type { DomainState, EntityId, Vec3 } from "@seki/core";
import { World } from "miniplex";
import {
  CIVILIAN_SPAWN,
  DISTRICT_M0_PROPS,
  FIXER_SPAWN,
  GANGER_SPAWNS,
  PLAYER_SPAWN,
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

/**
 * Builds the M0 district. Entities whose `dead:<key>` flag is set are skipped, so the same
 * factory serves both a new game and a load.
 */
export const createDistrictWorld = (domain: DomainState): World<Entity> => {
  const world = new World<Entity>();
  const ids = new IdAllocator();
  const isDead = (key: string): boolean => domain.flags.includes(`dead:${key}`);

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
    interactable: { dialogueId: "fixer", prompt: "Rozmawiaj z Kaito", radius: 2.6 },
  });

  world.add({
    ...actor(ids, CIVILIAN_SPAWN),
    view: { kind: "npc", preset: "civilian" },
    faction: "civilians",
    interactable: { dialogueId: "ume", prompt: "Rozmawiaj z babcią Ume", radius: 2.4 },
  });

  for (const g of GANGER_SPAWNS) {
    if (isDead(g.key)) continue;
    const e: Entity = {
      ...actor(ids, g),
      view: { kind: "enemy", preset: "ganger" },
      faction: "hebi",
      velocity: { x: 0, y: 0, z: 0 },
      health: { current: GANGER_MAX_HP, max: GANGER_MAX_HP },
      combatant: { weapon: "gangerSmg", cooldown: 0 },
      ai: { home: g.position, aggroRange: 17, attackRange: 15, alerted: false },
    };
    if (g.tag) e.tag = g.tag;
    world.add(e);
  }
  return world;
};
