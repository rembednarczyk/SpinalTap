import type { StreetPropItem } from "../../../packages/core/src";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover, sampleCentre } from "../../orto/src/cover.ts";

/**
 * `canopy-without-tree` (G-797, T-292, ADR-0077 step 5): a 10 m square of the map with `MIN_CANOPY`
 * m² or more of crowns on the orthophoto cover (`canopy` and `canopyHard`, `data/orto`), of which
 * `MISSED` or more lies further than `REACH` from every tree of the game. The trees stood on OSM's
 * `natural=tree` nodes and the plan's rows alone, so the crowns of the castle hill's slopes, the
 * Bystrzyca's banks and the yards had no tree under them: 496 squares (audit of 14.11). A finding is
 * a square, keyed by its corner at its least x and z (`SAMPLED_KINDS`). The rectangles the game
 * clears of the map's furniture for its set pieces (the docks, the car wash: `CLEARED_BUILDINGS`)
 * are left out: no tree of the map stands there in the game (G-815).
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };
type Box = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

/** The side of a square (m). */
export const SQUARE = 10;
/** The crown a square needs to count (m²). */
export const MIN_CANOPY = 40;
/** How far a crown's sample may lie from the nearest tree of the game and still be its (m). */
export const REACH = 6;
/** The share of a square's crown out of every tree's reach that makes it a finding. */
export const MISSED = 0.8;

/** Whether a cover's class is a crown. */
export const isCanopy = (cls: number): boolean => cls === COVER.canopy || cls === COVER.canopyHard;

/** A grid of points by `cell` m squares, for the nearest-within queries. */
const gridOf = (pts: readonly Pt[], cell: number): Map<string, Pt[]> => {
  const out = new Map<string, Pt[]>();
  for (const p of pts) {
    const k = `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
    const list = out.get(k);
    if (list) list.push(p);
    else out.set(k, [p]);
  }
  return out;
};

/** Whether a point of `grid` (made with `cell` = `reach`) lies within `reach` of (x, z). */
const near = (grid: ReadonlyMap<string, readonly Pt[]>, x: number, z: number, reach: number): boolean => {
  const [gx, gz] = [Math.floor(x / reach), Math.floor(z / reach)];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of grid.get(`${gx + i},${gz + j}`) ?? []) if ((q.x - x) ** 2 + (q.z - z) ** 2 <= reach * reach) return true;
  return false;
};

/** Whether a cover's raster holds the world point (x, z). */
const holds = (c: Cover, x: number, z: number): boolean => {
  const h = c.header;
  return x >= h.x0 && x < h.x0 + h.width * h.step && z <= h.z1 && z > h.z1 - h.height * h.step;
};

/**
 * Every square of the covers with `MIN_CANOPY` m² of crown or more, `MISSED` of it or more further
 * than `REACH` from each tree of `props`, out of `cleared`. A sample two covers hold counts in the first only.
 */
export const canopyWithoutTree = (covers: readonly Cover[], props: readonly StreetPropItem[], cleared: readonly Box[] = [], reach = REACH): Finding[] => {
  const trees = gridOf(
    props.filter((p) => p.prop === "tree").map((p) => ({ x: p.x, z: p.z })),
    reach,
  );
  const squares = new Map<string, { crown: number; missed: number }>();
  covers.forEach((c, k) => {
    const h = c.header;
    for (let row = 0; row < h.height; row++) {
      for (let col = 0; col < h.width; col++) {
        if (!isCanopy(c.cls[row * h.width + col]!)) continue;
        const p = sampleCentre(h, col, row);
        if (covers.slice(0, k).some((o) => holds(o, p.x, p.z)) || cleared.some((b) => p.x >= b.minX && p.x < b.maxX && p.z >= b.minZ && p.z < b.maxZ)) continue;
        const key = `${Math.floor(p.x / SQUARE) * SQUARE},${Math.floor(p.z / SQUARE) * SQUARE}`;
        const s = squares.get(key) ?? { crown: 0, missed: 0 };
        s.crown += h.step * h.step;
        if (!near(trees, p.x, p.z, reach)) s.missed += h.step * h.step;
        squares.set(key, s);
      }
    }
  });
  return [...squares]
    .filter(([, s]) => s.crown >= MIN_CANOPY && s.missed >= MISSED * s.crown)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([at, s]) => ({ at, what: `crown ${s.crown.toFixed(1)} m², ${((100 * s.missed) / s.crown).toFixed(0)}% further than ${reach} m from a tree` }));
};
