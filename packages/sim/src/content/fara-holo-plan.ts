import { LUBLIN_CHUNKS } from "./lublin";
import { FARA_RUIN_IDS } from "./lublin/fara-pad";

/*
 * The plan of the parish church's hologram V2 (the user's request of 24.11: after the lithograph of the 1840s and the
 * bronze model by the terrace, the hologram covering the foundations as they are, 1:1). The foundations on the map are
 * the ruin's masonry drawn as its faces (`historic=ruins` r18507552 round the nave, the chancel, the chapels and the
 * annexes; r18507551 the south-west chapel and the tower's south-west pier; seven piers and blocks `w1348806697`...): the
 * hologram's walls rise from every face of it, so they stand on the foundations exactly, and its roofs lie over the
 * rooms the masonry closes. Pattern: extrusion of a building's footprint by zones of height (as OSM's Simple 3D
 * Buildings: `building:part` with its own `height` and `roof:shape`), here the zones of a hall church: the nave block,
 * the chancel closed on three sides of an octagon, lean-to chapels and annexes, the buttresses, the west tower on four
 * piers with an onion helmet, a lantern and a second onion under the spire (the lithograph).
 */

export type PlanPoint = readonly [number, number];

/** The foundations' masonry on the map, by its ids (`FARA_RUIN_IDS`, `barriers.ts`): closed runs of its faces. */
export const FARA_FOUNDATIONS: readonly (readonly PlanPoint[])[] = LUBLIN_CHUNKS.flatMap((c) => c.barriers ?? [])
  .filter((b) => FARA_RUIN_IDS.includes(b.id))
  .map((b) => Array.from({ length: b.line.length / 2 }, (_, k): PlanPoint => [b.line[2 * k]!, b.line[2 * k + 1]!]));

/**
 * Heights over the foundations' top (m): the nave's walls and ridge, the chancel's, the tower's walls (two storeys over
 * the ridge, the lithograph's: the curator's review of 24.11), the cross's top.
 */
export const FARA_HEIGHTS = { nave: 13, ridge: 27, chancel: 12, chancelRidge: 19.5, tower: 38, spire: 56, buttress: 4 } as const;

/** The nave's and the chancel's axis (z). */
export const FARA_AXIS = 42.4;

/** The nave block: its walls' outer faces west, south and north, the chancel arch east; its roof's eaves on them. */
export const FARA_NAVE = { minX: 658.0, maxX: 678.9, minZ: 31.7, maxZ: 52.8 } as const;

/** The chancel inside its walls' faces, closed on three sides of an octagon (the foundations' apse). */
export const FARA_CHANCEL: readonly PlanPoint[] = [
  [678.9, 38.4],
  [690.4, 38.6],
  [692.3, 40.8],
  [692.3, 43.2],
  [690.7, 45.8],
  [678.9, 46.4],
];

/** The west tower over the nave's west bay, on its four piers' middles (the west two flanking the portal). */
export const FARA_TOWER: readonly PlanPoint[] = [
  [659.8, 38.2],
  [666.3, 38.2],
  [666.3, 46.6],
  [659.8, 46.6],
];

/**
 * A lean-to roof over chapels or an annex: its plan round the masonry's outer faces, falling from `high` m on the line
 * z = `from` (the wall it leans on) to `low` m on z = `to`.
 */
export interface LeanTo {
  readonly plan: readonly PlanPoint[];
  readonly from: number;
  readonly to: number;
  readonly high: number;
  readonly low: number;
}

/** The north chapels with the north-west turret, the south ones with the south-west chapel, the annexes by the chancel. */
export const FARA_LEAN_TOS: readonly LeanTo[] = [
  { plan: [[657.7, 52.8], [679.5, 52.8], [679.5, 56.0], [677.5, 59.0], [671.6, 60.0], [667.5, 58.9], [661.7, 57.9], [657.7, 56.3]], from: 52.8, to: 60, high: 8.5, low: 6 },
  { plan: [[657.6, 30.0], [659.5, 31.7], [679.0, 31.7], [679.0, 27.7], [677.4, 25.0], [671.1, 25.0], [670.1, 26.5], [668.6, 25.7], [668.1, 24.2], [666.4, 23.7]], from: 31.7, to: 23.7, high: 8.5, low: 6 },
  { plan: [[678.9, 38.4], [690.4, 38.6], [690.3, 37.0], [687.9, 37.0], [687.5, 33.7], [684.4, 33.7], [684.4, 30.3], [679.4, 30.3], [679.0, 31.7]], from: 38.5, to: 30.3, high: 9, low: 6 },
  { plan: [[678.9, 46.4], [690.7, 45.8], [693.8, 45.9], [693.5, 53.4], [679.5, 53.4], [679.5, 52.8], [678.9, 52.8]], from: 46.4, to: 53.4, high: 9, low: 6 },
];

/** A lean-to's height over the foundations' top at z: from `high` on its wall to `low` on its far side. */
export const leanHeight = (l: LeanTo, z: number): number => {
  const t = Math.max(0, Math.min(1, (z - l.from) / (l.to - l.from)));
  return l.high + (l.low - l.high) * t;
};

/** Is (x, z) inside a closed run, or within `tol` of it? */
export const inPlan = (pts: readonly PlanPoint[], x: number, z: number, tol = 0): boolean => {
  let c = false;
  let near = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [[xi, zi], [xj, zj]] = [pts[i]!, pts[j]!];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    const [dx, dz] = [xj - xi, zj - zi];
    const t = Math.max(0, Math.min(1, ((x - xi) * dx + (z - zi) * dz) / (dx * dx + dz * dz || 1)));
    near = Math.min(near, Math.hypot(x - xi - t * dx, z - zi - t * dz));
  }
  return c || near <= tol;
};

const [north, south, southEast, northEast] = FARA_LEAN_TOS as readonly [LeanTo, LeanTo, LeanTo, LeanTo];

/**
 * The walls' top over the foundations' top at a point of the masonry: the chancel's walls, the nave block's (its walls,
 * its piers and the tower's piers), the lean-tos' walls under their roofs, the apse's buttresses' stubs (their stepped tiers in `fara-holo-detail.ts`).
 */
export const faraWallHeight = (x: number, z: number): number => {
  const h = FARA_HEIGHTS;
  if (inPlan(FARA_CHANCEL, x, z, 0.35)) return h.chancel;
  if (x <= FARA_NAVE.maxX + 0.1 && z >= FARA_NAVE.minZ - 0.1 && z <= FARA_NAVE.maxZ + 0.15) return h.nave;
  if (z > FARA_NAVE.maxZ && x < 679.6) return leanHeight(north, z);
  if (z > 46.3 && x >= FARA_NAVE.maxX) return leanHeight(northEast, z);
  if (x >= FARA_NAVE.maxX && x < 690.6 && z < 38.5) return leanHeight(southEast, z);
  if (x >= 690.6) return h.buttress;
  return leanHeight(south, z);
};

/**
 * The helmet over the tower after the lithograph (the 1840s) and the bronze model: a short drum on the tower's cornice,
 * an onion, an open lantern, a second smaller onion and the spire with its cross; rings of an octagon, (radius, height
 * over the foundations' top), from the bottom up.
 */
export const FARA_HELMET: readonly PlanPoint[] = [
  [2.2, 38.0],
  [2.4, 38.6],
  [2.9, 39.6],
  [2.95, 40.4],
  [2.5, 41.4],
  [1.5, 42.4],
  [0.8, 43.0],
  [0.8, 43.2],
  [0.85, 45.6],
  [1.15, 46.3],
  [1.1, 46.9],
  [0.6, 47.6],
  [0.25, 48.2],
  [0.08, 53.0],
];
/** The cross on the spire: its foot, its top, the arms' height and half span (m over the foundations' top). */
export const FARA_CROSS = { foot: 53.0, top: 56.0, arms: 54.9, half: 0.7 } as const;
