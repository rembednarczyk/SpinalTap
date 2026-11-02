import type { EntityId } from "@seki/core";
import { type Body, stow, stowed, unstow } from "../world/bodies";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import type { Aabb } from "../world/collision";
import { inCreationOrder } from "../world/ordering";
import { playerHeld } from "../world/takedown";

/** How close a body has to lie to be picked up, metres between the centres on the ground (ADR-0065). */
export const CARRY_REACH = 1.6;
/** The player's walk speed with a body on her shoulder: 0.6 of her walk. */
export const CARRY_SPEED = 0.6;
/** How close to a hiding place's side the player has to stand to put a body in, metres. */
export const HIDE_REACH = 1;
/** Most height between the feet: no body is picked up through a floor. */
const CARRY_REACH_Y = 0.8;
/** One body per hiding place: another one lies at its centre already. */
const SAME_SPOT = 0.05;

type Spot = Entity & { hide: NonNullable<Entity["hide"]>; solid: Aabb };

/** The body on the player's shoulder, if any. */
export const carriedBody = (ctx: SimContext): Body | null => {
  const id = ctx.session.carrying;
  if (id === null) return null;
  return ctx.world.with("downed").entities.find((b) => b.id === id) ?? null;
};

/** The player is free to pick a body up: on her feet, not held, hands empty. */
const freeHands = (ctx: SimContext, player: Entity): boolean =>
  !playerHeld(ctx) && ctx.session.carrying === null && !player.climb && !player.mantle && player.fall === undefined;

/** The nearest body lying in reach (knocked out or dead, not hidden); ties go to the older one. */
export const bodyCandidate = (ctx: SimContext, player: Entity): { body: Body; distance: number } | null => {
  if (!freeHands(ctx, player)) return null;
  let best: { body: Body; distance: number } | null = null;
  for (const b of inCreationOrder(ctx.world.with("downed"))) {
    if (stowed(b) || Math.abs(b.position.y - player.position.y) > CARRY_REACH_Y) continue;
    const distance = Math.hypot(b.position.x - player.position.x, b.position.z - player.position.z);
    if (distance <= CARRY_REACH && (!best || distance < best.distance)) best = { body: b, distance };
  }
  return best;
};

/** Ground distance from (x, z) to the box's footprint; 0 inside it. */
const toFootprint = (box: Aabb, x: number, z: number): number =>
  Math.hypot(Math.max(box.min.x - x, 0, x - box.max.x), Math.max(box.min.z - z, 0, z - box.max.z));

const spotCentre = (s: Spot): { x: number; y: number; z: number } => ({ x: (s.solid.min.x + s.solid.max.x) / 2, y: s.solid.min.y, z: (s.solid.min.z + s.solid.max.z) / 2 });

/** Some body is hidden in it already. */
const taken = (ctx: SimContext, s: Spot): boolean => {
  const c = spotCentre(s);
  return ctx.world.with("downed").entities.some((b) => b.downed.hidden && Math.hypot(b.position.x - c.x, b.position.z - c.z) <= SAME_SPOT);
};

/** The nearest free hiding place in reach of the player, on her level; ties go to the older one. */
export const hideSpotNear = (ctx: SimContext, player: Entity): Spot | null => {
  let best: { spot: Spot; distance: number } | null = null;
  for (const e of inCreationOrder(ctx.world.with("hide", "solid"))) {
    if (player.position.y < e.solid.min.y - CARRY_REACH_Y || player.position.y > e.solid.max.y) continue;
    const distance = toFootprint(e.solid, player.position.x, player.position.z);
    if (distance <= HIDE_REACH && (!best || distance < best.distance) && !taken(ctx, e)) best = { spot: e, distance };
  }
  return best?.spot ?? null;
};

/** The `carry-body` command (ADR-0065): picks up the body the HUD offers, if it still lies in reach. */
export const carryBody = (ctx: SimContext): void => {
  const player = ctx.world.with("player").first;
  if (!player) return;
  const found = bodyCandidate(ctx, player);
  // Only the body that holds the prompt (the interaction system's choice of the last step).
  if (!found || ctx.session.bodyTarget?.id !== found.body.id) return;
  const b = found.body;
  b.downed.carried = true;
  // Whoever was on the way to it lost it from sight.
  b.downed.finder = null;
  b.downed.wake = 0;
  stow(ctx.world, b);
  if (b.velocity) b.velocity = { x: 0, y: 0, z: 0 };
  ctx.session.carrying = b.id;
  ctx.session.bodyTarget = null;
};

/** Puts the body into the hiding place: at its foot, inside, not drawn and seen by nobody. */
const hide = (ctx: SimContext, b: Body, spot: Spot): void => {
  b.downed.hidden = true;
  const at = spotCentre(spot);
  b.position = at;
  b.prevPosition = at;
  if (b.view) ctx.world.removeComponent(b, "view");
  ctx.bus.emit("BodyHidden", { body: b.id, spot: spot.id });
};

/** The `drop-body` command: into the free hiding place in reach, else down at the player's feet, in front of her. */
export const dropBody = (ctx: SimContext): void => {
  const player = ctx.world.with("player").first;
  const b = carriedBody(ctx);
  ctx.session.carrying = null;
  ctx.session.hideSpot = null;
  if (!b) return;
  b.downed.carried = false;
  const spot = player ? hideSpotNear(ctx, player) : null;
  if (spot) {
    hide(ctx, b, spot);
    return;
  }
  // Just in front of her, touching: the next step's push-out keeps it out of walls and her way.
  if (player) {
    const reach = (player.body?.radius ?? 0) + (b.downed.frame?.radius ?? 0);
    b.position = { x: player.position.x + Math.sin(player.yaw) * reach, y: player.position.y, z: player.position.z + Math.cos(player.yaw) * reach };
    b.prevPosition = b.position;
  }
  unstow(ctx.world, b);
};

/** The carried body goes where the player goes. */
const follow = (b: Body, player: Entity): void => {
  b.position = { ...player.position };
  b.yaw = player.yaw;
};

/**
 * Carrying bodies (ADR-0065), after the takedown (a body knocked out this step lies already) and
 * before interaction (its prompt): the carried body follows the player, and the system names the
 * body the interact key would pick up and the hiding place the carried one would go into.
 * Without a player the body drops where it is. Uses no randomness.
 */
export const carrySystem: System = {
  name: "carry",
  run(ctx) {
    const player = ctx.world.with("player").first ?? null;
    const b = carriedBody(ctx);
    if (ctx.session.carrying !== null && (!b || !player)) dropBody(ctx);
    if (b && player && ctx.session.carrying !== null) follow(b, player);
    const found = player ? bodyCandidate(ctx, player) : null;
    ctx.session.bodyTarget = found ? { id: found.body.id, distance: found.distance } : null;
    const spot: EntityId | null = player && ctx.session.carrying !== null ? (hideSpotNear(ctx, player)?.id ?? null) : null;
    ctx.session.hideSpot = spot;
  },
};
