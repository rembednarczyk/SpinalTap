/**
 * The tower crane of a building site (ADR-0087 step 4, stage 2): on the full set, not on a narrow
 * site (its sides over `NARROW` to one), at the point of a 1 m raster from which its jib reaches
 * the furthest corner of the outline soonest, its mast on free ground inside the fence, off the dig
 * and its slopes, the containers, the scaffold, the yard by the gate and the drone's way from the
 * gate to the dig. Its top stands `SITE_CRANE.over` m over the tallest neighbour.
 */
import { type StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { SITE_CRANE, siteCraneVariant } from "../../../packages/core/src/world/sites.ts";
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import { type SiteGround } from "./construction-ground.ts";
import { type Pt, pointInRing } from "./geometry.ts";

/** Sites whose bounding box along the long axis is longer than this to one get no crane. */
export const NARROW = 4;
/** The raster the mast's place is looked for on (m). */
const STEP = 1;
/** Clear of the mast (m): to the gate's middle, to the drone's way. */
const YARD = 6;
const WAY = 4;
/** The neighbours within this of the outline's box count for its height (m). */
const NEAR = 30;
/** The jib reaches past the furthest corner by this much (m), rounded up to half a metre. */
const OVER_REACH = 1;

export interface CranePlan {
  readonly at: Pt;
  /** The furthest corner's distance (m). */
  readonly reach: number;
  readonly jib: number;
  readonly height: number;
  /** The jib's way at rest, a unit vector: to the dig, else to the furthest corner. */
  readonly towards: Pt;
}

/** The ratio of the long side to the short of the outline's box along `deg` (degrees from +x towards +z). */
export const aspectAlong = (ring: readonly Pt[], deg: number): number => {
  const a = (deg * Math.PI) / 180;
  const us = ring.map((p) => p.x * Math.cos(a) + p.z * Math.sin(a));
  const vs = ring.map((p) => -p.x * Math.sin(a) + p.z * Math.cos(a));
  const [du, dv] = [Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs)];
  return Math.max(du, dv) / Math.max(1e-6, Math.min(du, dv));
};

export interface CraneKeepOff {
  /** Boxes the mast keeps off (world rings, grown as needed): the dig with its slopes, the containers, the scaffold. */
  readonly boxes: readonly (readonly Pt[])[];
  /** The gate's middle, null for none. */
  readonly gate: Pt | null;
  /** The drone's way, from the gate to the dig, null for none. */
  readonly way: readonly [Pt, Pt] | null;
}

/** The crane over the outline `outline`, its mast inside the fence's `ring`; null where it has no place. */
export const planCrane = (outline: readonly Pt[], ring: readonly Pt[], g: SiteGround, keep: CraneKeepOff, digMiddle: Pt | null): CranePlan | null => {
  const xs = ring.map((p) => p.x);
  const zs = ring.map((p) => p.z);
  // The base's footprint and a hand's breadth, sampled every half metre or less.
  const m = SITE_CRANE.base + 0.2;
  const n = Math.ceil(m / 0.5);
  const clear = (c: Pt): boolean => {
    if (keep.gate && Math.hypot(c.x - keep.gate.x, c.z - keep.gate.z) < YARD) return false;
    if (keep.way && segmentDistance(c.x, c.z, keep.way[0].x, keep.way[0].z, keep.way[1].x, keep.way[1].z) < WAY) return false;
    for (let i = -n; i <= n; i++)
      for (let k = -n; k <= n; k++) {
        const p = { x: c.x + (m * i) / n, z: c.z + (m * k) / n };
        if (!pointInRing(p, ring) || !g.free(p) || keep.boxes.some((b) => pointInRing(p, b))) return false;
      }
    return true;
  };
  // The raster's points by their reach, the shortest first (then west, then south): the first clear one.
  const spots: { at: Pt; reach: number }[] = [];
  for (let x = Math.ceil(Math.min(...xs)); x <= Math.max(...xs); x += STEP)
    for (let z = Math.ceil(Math.min(...zs)); z <= Math.max(...zs); z += STEP) spots.push({ at: { x, z }, reach: Math.max(...outline.map((p) => Math.hypot(p.x - x, p.z - z))) });
  spots.sort((a, b) => a.reach - b.reach || a.at.x - b.at.x || a.at.z - b.at.z);
  const best = spots.find((s) => clear(s.at));
  if (!best) return null;
  const { at, reach } = best;
  const box = { minX: Math.min(...outline.map((p) => p.x)) - NEAR, maxX: Math.max(...outline.map((p) => p.x)) + NEAR, minZ: Math.min(...outline.map((p) => p.z)) - NEAR, maxZ: Math.max(...outline.map((p) => p.z)) + NEAR };
  const tops = g.neighbours.filter((n) => n.ring.some((p) => p.x > box.minX && p.x < box.maxX && p.z > box.minZ && p.z < box.maxZ)).map((n) => n.top);
  const foot = g.heightAt(at);
  const height = Math.round(Math.max(SITE_CRANE.least, Math.max(foot, ...tops) - foot + SITE_CRANE.over) * 10) / 10;
  const far = outline.reduce((a, p) => (Math.hypot(p.x - at.x, p.z - at.z) > Math.hypot(a.x - at.x, a.z - at.z) ? p : a), outline[0]!);
  const to = digMiddle ?? far;
  const d = Math.hypot(to.x - at.x, to.z - at.z) || 1;
  return { at, reach, jib: Math.ceil((reach + OVER_REACH) * 2) / 2, height, towards: { x: (to.x - at.x) / d, z: (to.z - at.z) / d } };
};

/** The crane as a piece: its mast's foot, the jib along local +x, local x being (cos yaw, -sin yaw). */
export const cranePiece = (c: CranePlan, g: SiteGround, phase: number): StreetPropItem => ({
  prop: "site-crane",
  x: c.at.x,
  y: Math.round(g.heightAt(c.at) * 100) / 100,
  z: c.at.z,
  yaw: Math.round(Math.atan2(-c.towards.z, c.towards.x) * 1e4) / 1e4 + 0,
  variant: siteCraneVariant({ height: c.height, jib: c.jib, phase }),
});
