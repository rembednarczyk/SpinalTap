import { VEHICLE_SIZE, isDrivable } from "@seki/core";
import type { Entity, ParkedCarRef } from "../components";
import type { SimContext } from "../context";

/**
 * Breaking into a parked car (ADR-0097 §3): the street's parked cars (ADR-0050) are static solids
 * drawn by the scenery; she smashes the driver's window, the car becomes one of hers with its
 * physics and its place stays empty for good (`parkedTakenFlag`). As the car theft of the open
 * world games (GTA's "steal a parked car"): a few seconds at the door, a crime if anyone sees it.
 */

/** The prompt of a parked car she can break into (a key of the content catalogs, ADR-0056). */
export const BREAK_IN_PROMPT = "prompt.car.break";
/** How long she works at the door before she gets in (s): the window smashed, the lock forced. */
export const BREAK_IN_WAIT = 2.2;
/** How near the car's side she must stand (m), as to take a street car. */
const BREAK_IN_REACH = 2.4;

export type ParkedEntity = Entity & { parkedCar: ParkedCarRef };

/** The parked car she can break into: drivable, within reach of its side; the nearest. */
export const parkedCarToBreak = (ctx: SimContext, player: Entity): ParkedEntity | null => {
  let best: { e: ParkedEntity; d: number } | null = null;
  for (const e of ctx.world.with("parkedCar")) {
    const p = e.parkedCar;
    if (!isDrivable(p.model)) continue;
    const dx = player.position.x - e.position.x;
    const dz = player.position.z - e.position.z;
    if (Math.abs(dx) > 8 || Math.abs(dz) > 8 || Math.abs(player.position.y - e.position.y) > 2) continue;
    const { width, length } = VEHICLE_SIZE[p.model];
    const [tx, tz] = [Math.sin(p.yaw), Math.cos(p.yaw)];
    const fwd = Math.abs(dx * tx + dz * tz) - length / 2;
    const lat = Math.abs(dx * tz - dz * tx) - width / 2;
    const d = Math.hypot(Math.max(fwd, 0), Math.max(lat, 0));
    if (d <= BREAK_IN_REACH && (!best || d < best.d)) best = { e, d };
  }
  return best?.e ?? null;
};
