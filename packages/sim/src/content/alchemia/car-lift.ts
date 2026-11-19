import type { StaticProp } from "../builders";
import { P1, P1_CAR_LIFT } from "./parking";
import { P2 } from "./p2";
import { type Piece, box, piece } from "./plan";

/**
 * The car lift from P-1's hand-over cabins down to P-2 (ADR-0074 stage 5e): in the north cabin a
 * platform with a car on it goes down through P-1's deck to the north end of P-2's lane and back,
 * by the clock as the robots run (a `shuttle` up y): where it stands follows from the domain's time
 * alone, so a save needs nothing of it. At P-1 the cabin's walls and shutter close its shaft; at P-2
 * a railing closes its west and east sides, its south side open to the lane, where a body under the
 * platform coming down is put out.
 */

const F2 = P2.floor;
const H = P1_CAR_LIFT;
/** Its run: from P-2's floor up to P-1's. */
export const CAR_LIFT_TRAVEL = P1.floor - F2;
/** Its round trip, real seconds; it waits this share of it at each end. */
const PERIOD = 40;
const PAUSE = 0.2;
const PHASE = 0.1;
/** The platform's thickness and its gap to the shaft's sides. */
const PLATFORM = 0.3;
const GAP = 0.05;
const RAIL = 1.1;

/** A box riding the lift, as it stands at P-2. */
const rider = (key: string, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, material: "metal" | "glass"): StaticProp => ({
  center: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 },
  view: { kind: "block", size: { x: x1 - x0, y: y1 - y0, z: z1 - z0 }, material },
  solid: true,
  mechanism: { kind: "shuttle", key, axis: "y", travel: CAR_LIFT_TRAVEL, period: PERIOD, phase: PHASE, pause: PAUSE },
});

/** The platform and the car on it (its body and its cabin), moving together. */
export const CAR_LIFT_RIDERS: readonly StaticProp[] = [
  rider("alchemia-car-lift", H.minX + GAP, H.maxX - GAP, H.minZ + GAP, H.maxZ - GAP, F2 - PLATFORM, F2, "metal"),
  rider("alchemia-car-lift-car", H.minX + 0.35, H.maxX - 0.35, H.minZ + 0.1, H.maxZ - 0.1, F2 + 0.15, F2 + 0.75, "metal"),
  rider("alchemia-car-lift-cabin", H.minX + 1.0, H.maxX - 1.2, H.minZ + 0.2, H.maxZ - 0.2, F2 + 0.75, F2 + 1.2, "glass"),
];

/** At P-2: the railing either side of the shaft, the beacon over its open side. */
export const CAR_LIFT_PIECES: readonly Piece[] = [
  piece(box(H.minX - 0.2, H.minX, H.minZ, H.maxZ, F2, F2 + RAIL), "parapet", true),
  piece(box(H.maxX, H.maxX + 0.2, H.minZ, H.maxZ, F2, F2 + RAIL), "parapet", true),
  piece(box(H.minX, H.maxX, H.minZ - 0.1, H.minZ, P2.ceiling - 0.3, P2.ceiling - 0.2), "beacon", true, false),
];
