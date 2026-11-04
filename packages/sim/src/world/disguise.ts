import { DASH_FORBIDDEN_WEIGHT, DISGUISE_FACTION, ZONE_ACCESS, contractKind, disguiseHolds, type EntityId, type FactionId } from "@seki/core";

export { isEnforcer } from "./enforcer";
import type { Device, Entity } from "./components";
import type { SimContext } from "./context";
import { noteDetected } from "./street";

/*
 * Disguises in the world (ADR-0033): who is an enforcer, what gives the player away, and what
 * happens when someone sees through her. The rules and rates are in core (crime/disguise.ts).
 */

/** Is a camera's no-go zone in force right now (always, or during its kind of contract)? */
export const zoneActive = (ctx: SimContext, zone: NonNullable<Device["restricted"]>): boolean => {
  if (!zone.during) return true;
  const c = ctx.state.domain.contracts.active;
  return c?.status === "active" && contractKind(c) === zone.during;
};

/** Is the player inside a no-go zone of `faction` that is in force? */
export const inNoGoZone = (ctx: SimContext, player: Entity, faction: FactionId): boolean => {
  const { x, z } = player.position;
  for (const cam of ctx.world.with("device")) {
    const zone = cam.device.restricted;
    if (!zone || cam.device.faction !== faction || !zoneActive(ctx, zone)) continue;
    if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) return true;
  }
  return false;
};

/** Does the player's disguise hold against people of `faction`? */
export const coveredFrom = (ctx: SimContext, faction: FactionId | undefined): boolean => disguiseHolds(ctx.state.domain.disguise, faction);

/**
 * The weight of a forbidden act in front of `faction` (ADR-0033), 0 for none: a weapon drawn, a
 * sprint or a no-go zone the role has no business in weigh 1; a dash weighs DASH_FORBIDDEN_WEIGHT
 * until its cooldown is over (G-280), so a run of dashes adds up and a single one does not. A shot
 * alerts whoever hears it, which gives the disguise away to anyone of the faction who then sees
 * her (see `perceiveInDisguise`).
 */
export const forbiddenAct = (ctx: SimContext, player: Entity, faction: FactionId): number => {
  const c = player.combatant;
  if (c?.weapon && !c.holstered) return 1;
  if (player.posture?.sprinting) return 1;
  const role = ctx.state.domain.disguise.role;
  if (role !== null && !ZONE_ACCESS[role] && DISGUISE_FACTION[role] === faction && inNoGoZone(ctx, player, faction)) return 1;
  return (player.perks?.dashCooldown ?? 0) > 0 ? DASH_FORBIDDEN_WEIGHT : 0;
};

/** Someone saw through the disguise: it protects nobody until she changes, and it counts as detection. */
export const blowDisguise = (ctx: SimContext, observerId: EntityId): void => {
  const disguise = ctx.state.domain.disguise;
  if (disguise.role === null || disguise.blown) return;
  ctx.state.domain = { ...ctx.state.domain, disguise: { ...disguise, blown: true } };
  ctx.bus.emit("DisguiseBlown", { observerId, role: disguise.role });
  noteDetected(ctx);
};
