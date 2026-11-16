import { type Contract, angleTo } from "@seki/core";
import { W3_HALL } from "../content/tessen-w3";
import type { Entity } from "../world/components";
import type { SimContext } from "../world/context";
import { coveredFrom, inNoGoZone } from "../world/disguise";
import { chestOf, clearSight, eyeOf } from "../world/hitscan";
import { inCreationOrder } from "../world/ordering";
import { incapacitated } from "../world/takedown";
import { raiseAlarm } from "./contract-system";
import { staffPass } from "./crime-system";

/**
 * The line's technicians as witnesses of the job (ADR-0082 §3.6, stage 3b): one who sees Seki with
 * a weapon out, in a no-go zone her disguise has no business in, or in the hall without a disguise
 * that holds against Tessen, reports her after `STAFF_REPORT_SECONDS` of it, as a civilian phones a
 * crime in (ADR-0029). The report raises the job's alarm, not the street's heat. Knocked out, held
 * or running from a fight, it sees nothing.
 */

/** Seconds of watching before the report. */
export const STAFF_REPORT_SECONDS = 2;
/** How far a technician looks up from its work, and how wide (half-angle, radians). */
export const STAFF_SIGHT = 12;
export const STAFF_CONE = (80 * Math.PI) / 180;

const inHall = (p: Entity): boolean => p.position.x >= W3_HALL.minX && p.position.x <= W3_HALL.maxX && p.position.z >= W3_HALL.minZ && p.position.z <= W3_HALL.maxZ;

/** Is Seki doing what she should not, in a technician's eyes? */
const offending = (ctx: SimContext, player: Entity): boolean => {
  const c = player.combatant;
  if (c?.weapon && !c.holstered) return true;
  if (inNoGoZone(ctx, player, "tessen") && !staffPass(ctx, "tessen")) return true;
  return inHall(player) && !coveredFrom(ctx, "tessen");
};

/** Does the technician see her: near, in front of it, nothing solid between? */
const sees = (ctx: SimContext, t: Entity, player: Entity): boolean => {
  if (Math.hypot(player.position.x - t.position.x, player.position.z - t.position.z) > STAFF_SIGHT) return false;
  if (Math.abs(angleTo({ x: t.position.x, z: t.position.z, yaw: t.yaw }, player.position.x, player.position.z)) > STAFF_CONE) return false;
  return clearSight(ctx.world, eyeOf(t), chestOf(player));
};

/** One step of the technicians' watch over the running job; the first report raises its alarm. */
export const watchStaff = (ctx: SimContext, contract: Contract, alarmUp: boolean): void => {
  const player = ctx.session.gameOver ? null : (ctx.world.with("player").first ?? null);
  const guilty = !!player && !alarmUp && offending(ctx, player);
  for (const t of inCreationOrder(ctx.world.with("staff"))) {
    const calm = !t.civilian?.crowd || t.civilian.crowd.state === "calm";
    const watching = guilty && !!player && (t.health?.current ?? 1) > 0 && calm && !incapacitated(ctx, t) && sees(ctx, t, player);
    t.staff.seen = watching ? t.staff.seen + ctx.dt : 0;
    if (t.staff.seen >= STAFF_REPORT_SECONDS) {
      t.staff.seen = 0;
      raiseAlarm(ctx, contract);
      return;
    }
  }
};

/** Before a save (as the street's calls, G-240): the technicians forget what they half saw. */
export const calmStaff = (ctx: SimContext): void => {
  for (const t of ctx.world.with("staff")) t.staff.seen = 0;
};
