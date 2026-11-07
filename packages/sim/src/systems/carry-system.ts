import type { EntityId } from "@seki/core";
import { type Body, stow, stowed, unstow } from "../world/bodies";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import type { Aabb } from "../world/collision";
import { inCreationOrder } from "../world/ordering";
import { solidIndexOf } from "../world/solid-index";
import { type Collider, circleTouches, colliderTop, overCollider } from "../world/solids";
import { playerHeld } from "../world/takedown";
import { STEP_HEIGHT } from "./movement-system";

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

const near = { x: 0, z: 0 };

/** Would a body of `radius` at (x, z) touch a solid the movement system stops it at (not a floor within a step)? */
const blocked = (solids: readonly Collider[], x: number, z: number, radius: number, feet: number, height: number): boolean =>
  solids.some((c) => c.box.min.y < feet + height && circleTouches(c, x, z, radius, near) && colliderTop(c, near.x, near.z) > feet + STEP_HEIGHT);

/** Turns from her heading tried in order: ahead, the diagonals ahead, the sides, the diagonals behind, behind. */
const DROP_TURNS = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4, Math.PI];

/**
 * Where the body goes down (G-479): touching her, never overlapping her, and clear of solids;
 * null when there is no such spot. A lying body is not pushed out (she is), so a centre put
 * inside a container stays there, and one put on her pushes her into the wall behind her.
 */
const dropSpot = (ctx: SimContext, player: Entity, b: Body): { x: number; z: number } | null => {
  const { x, z } = player.position;
  const radius = b.downed.frame?.radius ?? 0;
  const height = b.downed.frame?.height ?? 0;
  const reach = (player.body?.radius ?? 0) + radius;
  const span = reach + radius;
  // A solid her own centre is in (she was put inside a building) cannot be got out of by a drop:
  // it does not count, else the body would stay on her shoulder for good.
  const solids = solidIndexOf(ctx.world)
    .collidersNear(x - span, z - span, x + span, z + span)
    .filter((c) => !overCollider(c, x, z));
  for (const turn of DROP_TURNS) {
    const at = { x: x + Math.sin(player.yaw + turn) * reach, z: z + Math.cos(player.yaw + turn) * reach };
    if (!blocked(solids, at.x, at.z, radius, player.position.y, height)) return at;
  }
  return null;
};

/**
 * The `drop-body` command: into the free hiding place in reach, else down beside the player.
 * With no room around her she keeps it on her shoulder (the prompt says so).
 */
export const dropBody = (ctx: SimContext): void => {
  const player = ctx.world.with("player").first;
  const b = carriedBody(ctx);
  const spot = player && b ? hideSpotNear(ctx, player) : null;
  const at = player && b && !spot ? dropSpot(ctx, player, b) : null;
  if (player && b && !spot && !at) return;
  ctx.session.carrying = null;
  ctx.session.hideSpot = null;
  ctx.session.dropRoom = true;
  if (!b) return;
  b.downed.carried = false;
  if (spot) {
    hide(ctx, b, spot);
    return;
  }
  if (at && player) {
    b.position = { ...at, y: player.position.y };
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
 * body the interact key would pick up, the hiding place the carried one would go into, and
 * whether there is room to put it down.
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
    ctx.session.dropRoom = b && player && ctx.session.carrying !== null && spot === null ? dropSpot(ctx, player, b) !== null : true;
  },
};
