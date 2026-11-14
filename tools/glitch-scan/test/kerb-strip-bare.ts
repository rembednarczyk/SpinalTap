import type { Line } from "../../osm-import/src/features.ts";
import { segmentPieces } from "./world-samples";

/**
 * Bare ground along the kerb of a street fitted to its sidewalks (`kerb-strip-bare`, G-655, from
 * the curator's review of #437): a metre of a carriageway's edge where a metre and more of no
 * ground surface lies between the asphalt and the first surface past it (a lawn, a pavement, a
 * footway, setts, a square, steps). The streets are those the import fits (T-046, G-655), read
 * off the map alone: no `width` or `width:carriageway`, and a mapped sidewalk (`footway=sidewalk`)
 * or, on a side the street tags `separate`, a plain footway running beside it (parallel, its axis
 * on the asphalt by the tags' width) along `MIN_BESIDE` metres and more. The samples are the
 * middles of the street's pieces between the world's 1 m grid lines (`world-samples.ts`, G-756),
 * not every metre from a segment's start, which moved them all when its end moved. Both edges of
 * such a street count, all along it: a fit moves either. The asphalt and what lies past it are
 * the game's ground; a wall in the way ends the look.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** A gap this wide and wider counts (m). */
export const STRIP_BARE = 1;
/** How far past the asphalt the look goes (m): a wider bare is `landuse-bare`'s. */
const LOOK = 5;
/** The step of the look across (m). */
const STEP = 0.05;
/** The fewest metres of samples with a sidewalk beside that make a street one the import fits. */
const MIN_BESIDE = 10;
/** The surfaces past the kerb that end a strip: what lies along a street. */
const OUTER = new Set(["grass", "sidewalk", "footway", "cobble", "square", "steps", "crossing"]);

export interface StripWorld {
  /** The map's lines, corrected as the import reads them. */
  readonly lines: readonly Line[];
  /** The carriageways' `highway` values. */
  readonly carriageways: ReadonlySet<string>;
  readonly roadWidth: (t: Line["tags"]) => number;
  readonly surfacesAt: (x: number, z: number) => readonly string[];
  readonly inBuilding: (x: number, z: number) => boolean;
  /** Well inside the map's chunks. */
  readonly deep: (x: number, z: number) => boolean;
}

/** Whether `p` is on a carriageway's piece: its asphalt or a zebra, a piece of its own since the ground is a partition (ADR-0078 step 3). */
const carriageway = (w: StripWorld, p: Pt): boolean => w.surfacesAt(p.x, p.z).some((s) => s === "road" || s === "crossing");

const separate = (t: Line["tags"], side: number): boolean =>
  t.sidewalk === "separate" || t["sidewalk:both"] === "separate" || t[side === 0 ? "sidewalk:left" : "sidewalk:right"] === "separate";

/** The footways' segments a street's fit reads, in a 10 m grid. */
const footwayGrid = (lines: readonly Line[]) => {
  const cell = 10;
  const grid = new Map<string, { a: Pt; b: Pt; plain: boolean }[]>();
  for (const l of lines) {
    const t = l.tags;
    if (t.highway !== "footway" || t.footway === "crossing" || t.area === "yes") continue;
    for (let i = 0; i + 1 < l.line.length; i++) {
      const [a, b] = [l.line[i]!, l.line[i + 1]!];
      for (let gx = Math.floor(Math.min(a.x, b.x) / cell); gx <= Math.floor(Math.max(a.x, b.x) / cell); gx++)
        for (let gz = Math.floor(Math.min(a.z, b.z) / cell); gz <= Math.floor(Math.max(a.z, b.z) / cell); gz++) {
          const k = `${gx},${gz}`;
          grid.set(k, [...(grid.get(k) ?? []), { a, b, plain: t.footway !== "sidewalk" }]);
        }
    }
  }
  return (p: Pt) => {
    const out: { a: Pt; b: Pt; plain: boolean }[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) out.push(...(grid.get(`${Math.floor(p.x / cell) + dx},${Math.floor(p.z / cell) + dz}`) ?? []));
    return out;
  };
};

/** The metres of fitted streets' edges with a bare strip `STRIP_BARE` wide and more past the asphalt. */
export const kerbStripBare = (w: StripWorld): Finding[] => {
  const footways = footwayGrid(w.lines);
  const out: Finding[] = [];
  for (const l of w.lines) {
    const t = l.tags;
    if (!w.carriageways.has(t.highway ?? "") || t.area === "yes" || t.tunnel !== undefined || Number(t.layer ?? 0) < 0 || (t.bridge !== undefined && t.bridge !== "no")) continue;
    if (t.width !== undefined || t["width:carriageway"] !== undefined) continue;
    const half = w.roadWidth(t) / 2;
    const samples: { p: Pt; nx: number; nz: number }[] = [];
    let beside = 0;
    for (let i = 0; i + 1 < l.line.length; i++) {
      const [a, b] = [l.line[i]!, l.line[i + 1]!];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1e-3) continue;
      const [tx, tz] = [(b.x - a.x) / len, (b.z - a.z) / len];
      for (const piece of segmentPieces(a, b, 1)) {
        const p = { x: piece.x, z: piece.z };
        samples.push({ p, nx: -tz, nz: tx });
        const near = footways(p).some((q) => {
          const [dx, dz] = [q.b.x - q.a.x, q.b.z - q.a.z];
          const ql = Math.hypot(dx, dz);
          if (ql < 1e-3 || Math.abs((dx * tx + dz * tz) / ql) < 0.9) return false;
          const k = ((p.x - q.a.x) * dx + (p.z - q.a.z) * dz) / (ql * ql);
          if (k < 0 || k > 1) return false;
          const across = (q.a.x + dx * k - p.x) * -tz + (q.a.z + dz * k - p.z) * tx;
          return Math.abs(across) < half && (!q.plain || separate(t, across >= 0 ? 0 : 1));
        });
        if (near) beside += piece.len;
      }
    }
    if (beside < MIN_BESIDE) continue;
    for (const { p, nx, nz } of samples) {
      if (!w.deep(p.x, p.z) || !carriageway(w, p)) continue;
      for (const sgn of [1, -1]) {
        const at = (d: number) => ({ x: p.x + nx * sgn * d, z: p.z + nz * sgn * d });
        let edge = 0;
        while (edge < half + LOOK && carriageway(w, at(edge + STEP))) edge += STEP;
        let d = edge + STEP;
        for (; d <= edge + LOOK; d += STEP) {
          const q = at(d);
          if (w.inBuilding(q.x, q.z) || w.surfacesAt(q.x, q.z).length > 0) break;
        }
        const q = at(d);
        const gap = d - edge - STEP;
        if (gap < STRIP_BARE || d > edge + LOOK || w.inBuilding(q.x, q.z) || !w.surfacesAt(q.x, q.z).some((s) => OUTER.has(s))) continue;
        const e = at(edge);
        out.push({ at: `${e.x.toFixed(0)},${e.z.toFixed(0)}`, what: `${l.id}${t.name ? ` ${t.name}` : ""}: ${gap.toFixed(1)} m bare past the kerb` });
      }
    }
  }
  return out;
};
