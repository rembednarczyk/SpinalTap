import {
  BARRIER_OPENINGS,
  BARRIER_PIECE,
  BARRIER_THICKNESS,
  type BarrierKind,
  type BarrierMaterial,
  type GroundPoint,
  SEE_THROUGH_BARRIERS,
  type StreetPropItem,
  type ViewDescriptor,
  barrierLayout,
  barrierVariant,
} from "@seki/core";
import type { StaticProp } from "../builders";
import type { PrismDef } from "../../world/prism";

/**
 * The map's walls, fences and hedges as pieces of the street (ADR-0077 point 4): each line of a
 * chunk's `barriers` laid in straight stretches of at most `BARRIER_PIECE` metres, a street piece
 * of kind `barrier` at the stretch's middle, turned along it (+z), on the ground there. The
 * renderer draws them with the furniture; here the solid kinds get a prism each, which stops a
 * body. A fence and a hedge let sight through (`sightThrough`), the walls do not; the camera
 * looks past all of them, as past the furniture. The openings (gates, lift gates) are drawn only.
 */

/** Below the ground, so a piece on a slope meets it along its whole length (m). */
export const BARRIER_SINK = 0.3;
/** Shortest stretch laid (m). */
const MIN_STRETCH = 0.3;

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** How far either side of a retaining wall's axis its two sides' ground is read (m): past a 1.25 m cell's half. */
const RETAINED_SIDE = 1;
/** A retaining wall's parapet over its upper side's ground at the least (m): the curator's default where NMPT has no top (`docs/plany/archikatedra-otoczenie.md` §1.4). */
export const RETAINED_PARAPET = 0.5;
/** The step between a retaining wall's sides from which it is read as holding a terrace (m). */
const RETAINED_STEP = 0.5;

/**
 * The ground of a retaining wall's two sides at (x, z): the lowest and highest of its axis and a
 * metre to either side. Its face reaches down to the lower side and its top over the upper one
 * where the terrain steps under it (`breaklines.ts`, T-351), instead of leaving the step's slope
 * bare under it or the terrace's edge over it.
 */
const retainedSides = (a: GroundPoint, b: GroundPoint, groundY: (x: number, z: number) => number) => {
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const [nx, nz] = [-(b.z - a.z) / len, (b.x - a.x) / len];
  return (x: number, z: number): { low: number; high: number } => {
    const ys = [groundY(x, z), groundY(x + nx * RETAINED_SIDE, z + nz * RETAINED_SIDE), groundY(x - nx * RETAINED_SIDE, z - nz * RETAINED_SIDE)];
    return { low: Math.min(...ys), high: Math.max(...ys) };
  };
};

/**
 * The pieces of one polyline of a barrier: its segments split evenly into stretches of at most
 * `BARRIER_PIECE` metres, each with the ground's height at its middle and its rise end to end.
 */
export const barrierPieces = (
  kind: BarrierKind,
  height: number,
  line: readonly GroundPoint[],
  groundY: (x: number, z: number) => number,
  material: BarrierMaterial = "plain",
  stepEdge: (x: number, z: number) => boolean = () => false,
): StreetPropItem[] => {
  const out: StreetPropItem[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i] as GroundPoint;
    const b = line[i + 1] as GroundPoint;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < MIN_STRETCH) continue;
    const n = Math.ceil(len / BARRIER_PIECE - 1e-9);
    for (let k = 0; k < n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n };
      const q = { x: a.x + ((b.x - a.x) * (k + 1)) / n, z: a.z + ((b.z - a.z) * (k + 1)) / n };
      const x = (p.x + q.x) / 2;
      const z = (p.z + q.z) / 2;
      // Only a retaining wall on a breakline (T-351): elsewhere the terrain does not step under the wall
      // and its sides' ground is the smeared slope's, or off the map (the curator's review of 25.11).
      const sides = kind === "retaining-wall" && stepEdge((p.x + q.x) / 2, (p.z + q.z) / 2) ? retainedSides(a, b, groundY) : null;
      const foot = sides ? (fx: number, fz: number) => sides(fx, fz).low : groundY;
      const rise = foot(q.x, q.z) - foot(p.x, p.z);
      // A retaining wall stands from its lower side's ground; where it holds a step, its top is a
      // parapet over the upper side, else its height over the axis (T-351).
      const y = foot(x, z);
      const side = sides?.(x, z);
      const top = side && side.high - side.low > RETAINED_STEP ? side.high + RETAINED_PARAPET : groundY(x, z) + height;
      const variant = barrierVariant({ kind, length: len / n, height: top - y, rise, material });
      out.push({ prop: "barrier", x: round2(x), y: round2(y), z: round2(z), yaw: Math.atan2(b.x - a.x, b.z - a.z), variant });
    }
  }
  return out;
};

/** The solid of a piece in its own frame (foot at the origin): a box along it, from under the low end to over the high one; none for an opening. */
export const barrierPrism = (item: StreetPropItem): PrismDef | null => {
  const b = barrierLayout(item.variant);
  if (BARRIER_OPENINGS.has(b.kind)) return null;
  const hl = b.length / 2;
  const ht = BARRIER_THICKNESS[b.kind] / 2;
  const c = Math.cos(item.yaw);
  const s = Math.sin(item.yaw);
  // The piece's +z is along it: local (x, z) turns to world (x c + z s, -x s + z c).
  const at = (x: number, z: number): GroundPoint => ({ x: x * c + z * s, z: -x * s + z * c });
  const half = Math.abs(b.rise) / 2;
  return { points: [at(-ht, -hl), at(ht, -hl), at(ht, hl), at(-ht, hl)], bottom: -half - BARRIER_SINK, top: b.height + half };
};

/** Distance from (x, z) to the footprint of a piece's solid (0 inside; Infinity for an opening). */
export const distanceToBarrier = (item: StreetPropItem, x: number, z: number): number => {
  const b = barrierLayout(item.variant);
  if (BARRIER_OPENINGS.has(b.kind)) return Infinity;
  const dx = x - item.x;
  const dz = z - item.z;
  const along = dx * Math.sin(item.yaw) + dz * Math.cos(item.yaw);
  const across = dx * Math.cos(item.yaw) - dz * Math.sin(item.yaw);
  return Math.hypot(Math.max(0, Math.abs(along) - b.length / 2), Math.max(0, Math.abs(across) - BARRIER_THICKNESS[b.kind] / 2));
};

/** Seen nowhere: the renderer draws the pieces from the scenery's `street-props` view. */
const NO_VIEW: ViewDescriptor = { kind: "street-props", items: [] };

/** The solid pieces as scenery props of the game, in order: bodies stop at them, the eye only at a wall. */
export const barrierProps = (items: readonly StreetPropItem[]): StaticProp[] =>
  items.flatMap((item): StaticProp[] => {
    const prism = barrierPrism(item);
    if (!prism) return [];
    const sight = SEE_THROUGH_BARRIERS.has(barrierLayout(item.variant).kind) ? { sightThrough: true as const } : {};
    return [{ center: { x: item.x, y: item.y, z: item.z }, view: NO_VIEW, solid: true, prisms: [prism], scenery: true, seeThrough: true, ...sight }];
  });
