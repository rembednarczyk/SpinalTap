import { type StreetPropItem, barrierLayout } from "../../../packages/core/src";
import { type GroundRect, type Pad, rectOverlap } from "../../../packages/sim/src/content/lublin/shape";
import type { Area, Line } from "../../osm-import/src/features.ts";
import type { Tags } from "../../osm-import/src/osm.ts";

/**
 * The checks of the curator's audit before W-3's stage 1 (ADR-0082, docs/plany/tessen-w3-audyt.md):
 * - `pad-in-water`: a pad of the terrain, with its blend, over the river's water of the map (OSM
 *   natural=water) off the mouths a set piece joins to it on purpose (W-3's basin);
 * - `prop-in-water`: a piece of street furniture standing in that water on the terrain, not on a
 *   bridge's deck (G-835: three lamps in the Bystrzyca);
 * - `path-cut-by-cleared`: a street or a footway of the map running into the ground a set piece
 *   clears (`CLEARED`, its basin) or across its fence where it has no gate.
 */

type Finding = { readonly at: string; readonly what: string };
type P = { readonly x: number; readonly z: number };

/** The least overlap a finding counts (m²): the clipping's rounding is far under it. */
const LEAST_AREA = 1;
/** Samples along a way (m). */
const STEP = 0.5;
/** How high over the terrain a piece in the water still stands on it (m): a pier's piece stands higher. */
const ON_TERRAIN = 0.5;

const r1 = (v: number): string => (Math.round(v * 10) / 10).toFixed(1);
const near = (x: number, z: number): string => `${Math.round(x)},${Math.round(z)}`;

/** The map's water: OSM natural=water and riverbanks, as rings. */
export const isWater = (t: Tags): boolean => t.natural === "water" || t.waterway === "riverbank";

const flat = (ring: readonly P[]): number[] => ring.flatMap((p) => [p.x, p.z]);
const grow = (r: GroundRect, d: number): GroundRect => ({ minX: r.minX - d, maxX: r.maxX + d, minZ: r.minZ - d, maxZ: r.maxZ + d });
const meet = (a: GroundRect, b: GroundRect): GroundRect | null => {
  const r = { minX: Math.max(a.minX, b.minX), maxX: Math.min(a.maxX, b.maxX), minZ: Math.max(a.minZ, b.minZ), maxZ: Math.min(a.maxZ, b.maxZ) };
  return r.minX < r.maxX && r.minZ < r.maxZ ? r : null;
};

/** The area of a pad's reach (its rectangle grown by its blend) over each water of the map, less what lies in a mouth. */
export const padsInWater = (pads: readonly Pad[], water: readonly Area[], mouths: readonly GroundRect[]): Finding[] =>
  pads.flatMap((p, i) => {
    const reach = grow(p.rect, p.blend);
    return water.flatMap((w) => {
      const ring = flat(w.ring);
      const over = rectOverlap(reach, ring, 0, 0);
      if (over < LEAST_AREA) return [];
      const inMouth = mouths.reduce((s, m) => {
        const r = meet(reach, m);
        return s + (r ? rectOverlap(r, ring, 0, 0) : 0);
      }, 0);
      const left = over - inMouth;
      if (left < LEAST_AREA) return [];
      const c = { x: (p.rect.minX + p.rect.maxX) / 2, z: (p.rect.minZ + p.rect.maxZ) / 2 };
      return [{ at: near(c.x, c.z), what: `pad ${p.row ?? i} (blend ${p.blend}) over ${r1(left)} m² of the water ${w.id}` }];
    });
  });

/** Is (x, z) inside a ring (even-odd)? */
const inRing = (ring: readonly P[], x: number, z: number): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i] as P;
    const b = ring[j] as P;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

/** Furniture in the map's water at the terrain's height, off the bridges' decks. */
export const propsInWater = (
  items: readonly StreetPropItem[],
  water: readonly Area[],
  terrainAt: (x: number, z: number) => number,
  onDeck: (x: number, z: number) => boolean,
): Finding[] =>
  items.flatMap((i) => {
    if (i.prop === "barrier" || onDeck(i.x, i.z) || i.y > terrainAt(i.x, i.z) + ON_TERRAIN) return [];
    const w = water.find((a) => inRing(a.ring, i.x, i.z));
    return w ? [{ at: near(i.x, i.z), what: `${i.prop} at ${r1(i.x)},${r1(i.z)} (y ${r1(i.y)}) in the water ${w.id}` }] : [];
  });

const crosses = (a: P, b: P, c: P, d: P): boolean => {
  const side = (p: P, q: P, r: P) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const [d1, d2, d3, d4] = [side(c, d, a), side(c, d, b), side(a, b, c), side(a, b, d)];
  return d1 * d2 < 0 && d3 * d4 < 0;
};

/** The ends of a barrier piece along its yaw. */
const pieceEnds = (i: StreetPropItem): readonly [P, P] => {
  const h = barrierLayout(i.variant).length / 2;
  const [dx, dz] = [Math.sin(i.yaw) * h, Math.cos(i.yaw) * h];
  return [
    { x: i.x - dx, z: i.z - dz },
    { x: i.x + dx, z: i.z + dz },
  ];
};

/** Openings of a fence: the gate kinds the barrier layout knows. */
const OPENINGS: ReadonlySet<string> = new Set(["gate", "lift-gate"]);

/**
 * Ways of the map cut by a set piece: a sample of the way in a cleared rectangle, or a segment of
 * it across a solid piece of the set piece's fence. One finding per way and cause.
 */
export const pathsCutByCleared = (ways: readonly Line[], cleared: readonly GroundRect[], fence: readonly StreetPropItem[]): Finding[] => {
  const solid = fence.filter((i) => !OPENINGS.has(barrierLayout(i.variant).kind)).map(pieceEnds);
  const inside = (x: number, z: number) => cleared.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ);
  const out: Finding[] = [];
  for (const w of ways) {
    let under: P | null = null;
    let across: P | null = null;
    for (let k = 0; k + 1 < w.line.length; k++) {
      const a = w.line[k] as P;
      const b = w.line[k + 1] as P;
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / STEP));
      for (let s = 0; s <= n && !under; s++) {
        const p = { x: a.x + ((b.x - a.x) * s) / n, z: a.z + ((b.z - a.z) * s) / n };
        if (inside(p.x, p.z)) under = p;
      }
      if (!across) {
        const hit = solid.find(([c, d]) => crosses(a, b, c, d));
        if (hit) across = { x: (hit[0].x + hit[1].x) / 2, z: (hit[0].z + hit[1].z) / 2 };
      }
    }
    if (under) out.push({ at: near(under.x, under.z), what: `${w.id} (${w.tags.highway}) into the cleared ground` });
    if (across) out.push({ at: near(across.x, across.z), what: `${w.id} (${w.tags.highway}) across the fence, no gate` });
  }
  return out;
};
