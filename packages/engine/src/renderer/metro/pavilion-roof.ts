import { METRO_ENTRANCES, PAVILION } from "@seki/sim";
import type { Entrance } from "./pavilion-frame";

/**
 * Whether a metro pavilion's roof is over (x, y, z) (G-331): under its eaves, on its stairs or in
 * its hall. The rain ends its drops there, as under a map building's roof (`MapCity.roofOver`).
 */
export const pavilionRoofOver = (x: number, y: number, z: number, entrances: readonly Entrance[] = METRO_ENTRANCES): boolean =>
  entrances.some((e) => {
    const r = e.roof;
    return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && y < e.street + PAVILION.height && y > e.floor - 1;
  });
