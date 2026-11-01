import { VEHICLE_SIZE, type VehicleModel } from "@seki/core";
import { type Pt, polylineLength } from "./lublin/roads";
import { pointAt } from "./traffic-lane";

/**
 * The bays of a car park the map draws along a street's kerb (`parking=street_side`, `lane`,
 * `half_on_kerb`; G-177): how deep the strip is across the street, which way its cars stand
 * (along the kerb or across it) and where in the strip a car's middle goes. Pure geometry; which
 * bays are taken and whether a car fits there is `parked-cars`'.
 */

export const inRing = (x: number, z: number, ring: readonly Pt[]): boolean => {
  let on = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[j]!;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) on = !on;
  }
  return on;
};

export type BayLayout = "parallel" | "perpendicular" | "diagonal";

/**
 * Depth across the street from which a strip mapped without `orientation` holds its cars across
 * the kerb (m): a car along it takes 2 m, so a deeper strip is the bays' length, not a lane's
 * width (T-102: Radziwiłłowska, Ciasna, 5–8 m deep).
 */
const ACROSS_DEPTH = 4.5;

/** The way a strip's cars stand: as the map's `orientation` says, else across the kerb when it is deep enough. */
export const bayLayout = (orientation: string | undefined, depth: number): BayLayout => {
  if (orientation === "perpendicular" || orientation === "diagonal" || orientation === "parallel") return orientation;
  return depth >= ACROSS_DEPTH ? "perpendicular" : "parallel";
};

/** Bays this far apart along the kerb (m): a car's length and the room to get out, or a bay's 2.5 m width, along the kerb for a diagonal one. */
export const BAY_STEP: Readonly<Record<BayLayout, number>> = { parallel: 6.2, perpendicular: 2.6, diagonal: 3.6 };

/** A diagonal bay's car turned this far from the kerb, nose first in the traffic's way. */
const DIAGONAL = Math.PI / 4;

/** Room a parked car's side (or its nose) leaves the kerb at the strip's outer edge (m). */
const KERB_GAP = 0.25;

/** How far across the kerb a car reaches in its bay (m). */
export const bayReach = (layout: BayLayout, model: VehicleModel): number => {
  const { width, length } = VEHICLE_SIZE[model];
  if (layout === "parallel") return width;
  if (layout === "perpendicular") return length;
  return length * Math.sin(DIAGONAL) + width * Math.cos(DIAGONAL);
};

/** The strip a car park covers across a street at one point: from and to, its edges' distances from the axis (m). */
export interface StripCut {
  readonly from: number;
  readonly to: number;
}

const SAMPLE = 0.25;

/**
 * The first run of the ring across the street, sampled from 1 m off the axis out to `reach`
 * every quarter metre, each edge then found to a centimetre; null where the ring is not there.
 */
export const stripCut = (ring: readonly Pt[], across: (d: number) => { x: number; z: number }, reach: number): StripCut | null => {
  const inside = (d: number) => {
    const q = across(d);
    return inRing(q.x, q.z, ring);
  };
  let from = -1;
  let to = -1;
  for (let d = 1; d <= reach && (to < 0 || to === d - SAMPLE); d += SAMPLE) {
    if (!inside(d)) continue;
    if (from < 0) from = d;
    to = d;
  }
  if (from < 0) return null;
  // The edge lies between the last sample on one side and the first on the other.
  const edge = (a: number, b: number) => {
    for (let k = 0; k < 5; k++) {
      const m = (a + b) / 2;
      if (inside(m)) a = m;
      else b = m;
    }
    return a;
  };
  return { from: from <= 1 ? from : edge(from, from - SAMPLE), to: edge(to, to + SAMPLE) };
};

/** The median depth of a car park's strip on one side of a street's axis, sampled every metre where it is there (m); 0 where it never is. */
export const stripDepth = (ring: readonly Pt[], axis: readonly Pt[], side: 1 | -1, reach: number): number => {
  const depths: number[] = [];
  for (let s = 0; s < polylineLength(axis); s += 1) {
    const p = pointAt(axis, s);
    if (!ring.some(([x, z]) => Math.hypot(x - p.x, z - p.z) < reach * 2)) continue;
    const cut = stripCut(ring, (d) => ({ x: p.x + p.tz * side * d, z: p.z - p.tx * side * d }), reach);
    if (cut) depths.push(cut.to - cut.from);
  }
  return depths.sort((a, b) => a - b)[Math.floor(depths.length / 2)] ?? 0;
};

/**
 * Where a car of the layout stands in a strip: its middle's distance from the axis, at the kerb
 * (the strip's outer edge) with `KERB_GAP`, or in the middle of a strip too shallow for that;
 * null when the car is deeper than the strip. A car parked by the kerb leaves the carriageway
 * free; one in the strip's middle reaches over its inner edge into the lane where it narrows.
 */
export const bayDepth = (layout: BayLayout, model: VehicleModel, cut: StripCut): number | null => {
  const reach = bayReach(layout, model);
  if (reach > cut.to - cut.from + 0.1) return null;
  return Math.max(cut.to - KERB_GAP - reach / 2, (cut.from + cut.to) / 2);
};

/**
 * A bay car's facing (its front, radians from +z towards +x) at a point of the street whose way
 * there is (tx, tz): along the kerb in the traffic's way (`turned` against the axis' way), nose
 * to the kerb across it, or between the two.
 */
export const bayYaw = (layout: BayLayout, t: { tx: number; tz: number }, side: 1 | -1, turned: boolean): number => {
  const [fx, fz] = turned ? [-t.tx, -t.tz] : [t.tx, t.tz];
  const [ox, oz] = [t.tz * side, -t.tx * side];
  const a = layout === "parallel" ? 0 : layout === "perpendicular" ? Math.PI / 2 : DIAGONAL;
  return Math.round(Math.atan2(fx * Math.cos(a) + ox * Math.sin(a), fz * Math.cos(a) + oz * Math.sin(a)) * 1000) / 1000;
};
