import type { BodySnapshot, EntityId, InputFrame } from "@seki/core";
import type { World } from "miniplex";
import type { DownedBody, Entity } from "./components";

/**
 * Bodies (ADR-0065, stage 3): someone knocked out, or killed in a takedown and left lying, that
 * the player can carry and hide. The state lives on the body (`downed`) and is saved with it.
 */

/** The interaction prompts of a body (keys of the content catalogs, ADR-0056). */
export const CARRY_PROMPT = "prompt.body.carry";
export const DROP_PROMPT = "prompt.body.drop";
export const HIDE_PROMPT = "prompt.body.hide";

export type Body = Entity & { downed: DownedBody };

/** A fresh body's state: nobody has seen it, it lies where it fell. */
export const freshDowned = (playerAt: DownedBody["playerAt"], fought: boolean, dead = false): DownedBody => ({
  playerAt: { ...playerAt },
  fought,
  found: false,
  reported: false,
  finder: null,
  wake: 0,
  dead,
  checked: false,
  carried: false,
  hidden: false,
  frame: null,
});

/** Out of everybody's sight: on the player's shoulder or in a hiding place. */
export const stowed = (e: Entity): boolean => !!e.downed && (e.downed.carried || e.downed.hidden);

/** Takes the body out of the street's collisions (carried, hidden); `unstow` gives it back. */
export const stow = (world: World<Entity>, b: Body): void => {
  if (!b.body) return;
  b.downed.frame = b.body;
  world.removeComponent(b, "body");
};

export const unstow = (world: World<Entity>, b: Body): void => {
  const frame = b.downed.frame;
  b.downed.frame = null;
  if (frame && !b.body) world.addComponent(b, "body", frame);
};

export const bodySnapshotOf = (d: DownedBody): BodySnapshot => ({
  playerAt: { ...d.playerAt },
  fought: d.fought,
  found: d.found,
  reported: d.reported,
  dead: d.dead,
  carried: d.carried,
  hidden: d.hidden,
});

/**
 * What is left of someone killed in a takedown, or shot dead while knocked out: the same id,
 * key, chunk, look and place, with nothing alive about it (no health, no mind, no weapon), so no
 * system takes it for a character. It keeps a still velocity: the presentation follows it when
 * it is carried.
 */
export const corpseOf = (e: Entity, downed: DownedBody): Body => {
  const c: Body = {
    id: e.id,
    position: { ...e.position },
    prevPosition: { ...e.position },
    yaw: e.yaw,
    prevYaw: e.yaw,
    pitch: 0,
    velocity: { x: 0, y: 0, z: 0 },
    unconscious: true,
    downed: { ...downed, dead: true, checked: false, finder: null, wake: 0 },
  };
  if (e.key) c.key = e.key;
  if (e.chunk) c.chunk = e.chunk;
  if (e.view) c.view = e.view;
  if (e.body) c.body = e.body;
  if (e.faction) c.faction = e.faction;
  // Its look comes from its type (the presentation); nothing else reads it without health.
  if (e.enemy) c.enemy = e.enemy;
  return c;
};

/**
 * Puts a saved body back onto `e`, already in the world: knocked out (or dead), carried or
 * hidden as it was. A hidden body is not drawn either: it lies inside the hiding place.
 */
export const restoreDowned = (world: World<Entity>, e: Entity, s: BodySnapshot): void => {
  if (!e.unconscious) world.addComponent(e, "unconscious", true);
  const downed: DownedBody = { ...freshDowned(s.playerAt, s.fought, s.dead), found: s.found, reported: s.reported, carried: s.carried, hidden: s.hidden };
  if (e.downed) world.removeComponent(e, "downed");
  world.addComponent(e, "downed", downed);
  const b = e as Body;
  if (e.ai) {
    e.ai.alerted = false;
    e.ai.lastKnown = null;
  }
  if (s.carried || s.hidden) stow(world, b);
  if (s.hidden && e.view) world.removeComponent(e, "view");
};

/**
 * The step's input while the player carries a body (ADR-0065): both hands are full, so no
 * weapon (no shot, no swing, no aim), no sprint and no jump. Applied before every system.
 */
export const withCarry = (carrying: EntityId | null, input: InputFrame): InputFrame => {
  if (carrying === null) return input;
  if (!input.fire && !input.aim && !input.sprint && !input.jump && !input.dash) return input;
  return { ...input, fire: false, aim: false, sprint: false, jump: false, dash: false };
};
