import { VEHICLE_SIZE, type VehicleModel, segmentDistance } from "@seki/core";
import type { Pt } from "./lublin/roads";

/** Plane geometry of a parked car's body: its footprint and the gaps between it and segments. */

/** The corners of a car's footprint at (x, z), facing yaw, grown by `pad`. */
export const footprint = (x: number, z: number, yaw: number, model: VehicleModel, pad: number): Pt[] => {
  const { width, length } = VEHICLE_SIZE[model];
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const hw = width / 2 + pad;
  const hl = length / 2 + pad;
  return [
    [x - fx * hl - fz * hw, z - fz * hl + fx * hw],
    [x + fx * hl - fz * hw, z + fz * hl + fx * hw],
    [x + fx * hl + fz * hw, z + fz * hl - fx * hw],
    [x - fx * hl + fz * hw, z - fz * hl - fx * hw],
  ];
};

/** Distance from (x, z) to the segment a..b of `[x, z]` pairs. */
export const pairSegmentDistance = (x: number, z: number, a: Pt, b: Pt): number => segmentDistance(x, z, a[0], a[1], b[0], b[1]);

export const cross = (o: Pt, a: Pt, b: Pt): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

export const segmentsGap = (a: Pt, b: Pt, c: Pt, d: Pt): number => {
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(pairSegmentDistance(a[0], a[1], c, d), pairSegmentDistance(b[0], b[1], c, d), pairSegmentDistance(c[0], c[1], a, b), pairSegmentDistance(d[0], d[1], a, b));
};

/** Is p inside a convex polygon (either winding)? */
export const inside = (p: Pt, poly: readonly Pt[]): boolean =>
  poly.every((a, i) => cross(a, poly[(i + 1) % poly.length]!, p) <= 0) || poly.every((a, i) => cross(a, poly[(i + 1) % poly.length]!, p) >= 0);
