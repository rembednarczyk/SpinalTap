import type { GroundPoint } from "../../../packages/core/src";
import { type Prism, closestOnPrism, makePrism, overPrism } from "../../../packages/sim/src/world/prism";

/**
 * `alchemia-off-ground` (the user's 20.11: "Alchemia level with the ground"): a piece of Alchemia
 * outside, drawn or solid, standing on the ground whose foot hangs over what it stands on (the
 * drawn terrain, the map's paving, the top of a piece under it), or whose top sinks under the
 * ground at part of its outline while the rest of it stands out: a visible cut. Pattern: a
 * building on a slope stands on a plinth down into the ground (`SINK` of `plan.ts`), a bench or a
 * crate on the paving under it.
 */

type Finding = { readonly at: string; readonly what: string };

/** A piece as the check reads it: its footprint (a convex prism, its bottom and top) and what it is. */
export interface FootPiece {
  readonly prism: Prism;
  readonly kind: string;
}

export interface OffGroundWorld {
  /** What is checked: Alchemia's pieces outside, drawn or solid, and the game's models it places. */
  readonly pieces: readonly FootPiece[];
  /** Models (a tree, a bench, a figure): they stand on something wherever they are, on the ground or a storey. */
  readonly models: readonly FootPiece[];
  /** What a piece may stand on besides the ground: the pieces of its own kind (drawn on drawn, solid on solid) and the map's buildings. */
  readonly supports: readonly FootPiece[];
  /** The top of the ground at (x, z) as it is drawn (or walked, for solids), null where it is dug out under a room (a cut). */
  readonly ground: (x: number, z: number) => number | null;
}

/** How far a foot may lie over what it stands on, a top under the ground (m): a hand's breadth of the brief. */
export const OFF_GROUND_TOLERANCE = 0.05;
/** A foot within this of the highest ground under its outline stands on the ground (m); higher, it is on a storey, a wall or a mast. */
export const STANDING = 0.6;
/** A point of the outline this near a point where the piece touches what holds it is held (m): a seat over its legs, a table's top over its column. */
export const REACH = 0.6;
/** The step of the samples along an outline (m). */
const STEP = 0.25;
/** The samples lie this far in from the outline, off the neighbour sharing the edge (m). */
const INSET = 0.02;

const near = (x: number, z: number) => `${x.toFixed(0)},${z.toFixed(0)}`;

/** Points every `STEP` along the prism's outline, `INSET` in towards its middle. */
export const outlineSamples = (p: Prism): GroundPoint[] => {
  const pts = p.points;
  const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length;
  const cz = pts.reduce((a, q) => a + q.z, 0) / pts.length;
  const out: GroundPoint[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / STEP));
    for (let k = 0; k < n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n;
      const z = a.z + ((b.z - a.z) * k) / n;
      const d = Math.hypot(cx - x, cz - z);
      const t = d > INSET ? INSET / d : 0.5;
      out.push({ x: x + (cx - x) * t, z: z + (cz - z) * t });
    }
  }
  return out;
};

/** The supports by 2 m square of their boxes. */
const CELL = 2;
const indexOf = (supports: readonly FootPiece[]): ((x0: number, x1: number, z0: number, z1: number) => FootPiece[]) => {
  const cells = new Map<string, FootPiece[]>();
  for (const s of supports) {
    const b = s.prism.box;
    for (let i = Math.floor(b.min.x / CELL); i <= Math.floor(b.max.x / CELL); i++) {
      for (let k = Math.floor(b.min.z / CELL); k <= Math.floor(b.max.z / CELL); k++) cells.set(`${i}:${k}`, [...(cells.get(`${i}:${k}`) ?? []), s]);
    }
  }
  return (x0, x1, z0, z1) => {
    const found = new Set<FootPiece>();
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
      for (let k = Math.floor(z0 / CELL); k <= Math.floor(z1 / CELL); k++) for (const s of cells.get(`${i}:${k}`) ?? []) found.add(s);
    }
    return [...found];
  };
};

type Sample = { readonly x: number; readonly z: number; readonly ground: number };

/** How far the piece's foot hangs at its outline's worst point no hold reaches, and where; null when it stands. */
const hanging = (p: FootPiece, under: readonly FootPiece[], ground: OffGroundWorld["ground"], model: boolean): { gap: number; x: number; z: number } | null => {
  const y0 = p.prism.bottom;
  const tol = OFF_GROUND_TOLERANCE;
  // What holds it: a piece under its foot reaching up to it (from below, not one beside it at its level).
  const holds = under.filter((q) => q.prism.bottom < y0 - 0.005 && q.prism.top >= y0 - tol);
  const topAt = (x: number, z: number, g: number): number => {
    let s = g;
    for (const q of holds) if (overPrism(q.prism, x, z, 0.01)) s = Math.max(s, Math.min(q.prism.top, y0));
    return s;
  };
  const rim: Sample[] = [];
  for (const q of outlineSamples(p.prism)) {
    const g = ground(q.x, q.z);
    if (g !== null) rim.push({ ...q, ground: g });
  }
  if (rim.length === 0) return null;
  if (!model) {
    const high = Math.max(...rim.map((s) => s.ground));
    const low = Math.min(...rim.map((s) => s.ground));
    // On a storey, a wall or a mast; or wholly in the ground.
    if (y0 > high + STANDING || p.prism.top < low - tol) return null;
  }
  const out = { x: 0, z: 0 };
  const held = (x: number, z: number): boolean =>
    holds.some((q) => {
      closestOnPrism(q.prism, x, z, out);
      return overPrism(p.prism, out.x, out.z, 0.01) && Math.hypot(out.x - x, out.z - z) <= REACH;
    });
  let worst: { gap: number; x: number; z: number } | null = null;
  for (const s of rim) {
    const gap = y0 - topAt(s.x, s.z, s.ground);
    if (gap <= tol || held(s.x, s.z)) continue;
    if (!worst || gap > worst.gap) worst = { gap, x: s.x, z: s.z };
  }
  return worst;
};

/**
 * How deep its top lies under the ground at its outline's worst point, where the rest of it stands
 * out; null when it does not. Not where a piece standing on it carries it on out of the ground (a
 * wall's next storey, a slab on a plinth).
 */
const cut = (p: FootPiece, under: readonly FootPiece[], ground: OffGroundWorld["ground"]): { depth: number; x: number; z: number } | null => {
  const tol = OFF_GROUND_TOLERANCE;
  const top = p.prism.top;
  let worst: { depth: number; x: number; z: number } | null = null;
  let out = false;
  for (const q of outlineSamples(p.prism)) {
    const g = ground(q.x, q.z);
    if (g === null) continue;
    if (top > g + tol) out = true;
    else if (top < g - tol && (!worst || g - top > worst.depth) && !under.some((o) => o.prism.bottom <= top + tol && o.prism.bottom >= p.prism.bottom && o.prism.top > g && overPrism(o.prism, q.x, q.z, 0.01)))
      worst = { depth: g - top, x: q.x, z: q.z };
  }
  return out ? worst : null;
};

/** The check: a finding a piece, at its worst point, hanging (`over`) or cut by the ground (`cut`). */
export const alchemiaOffGround = (w: OffGroundWorld): Finding[] => {
  const supportsIn = indexOf([...w.supports, ...w.pieces, ...w.models]);
  const out: Finding[] = [];
  const look = (p: FootPiece, model: boolean): void => {
    const b = p.prism.box;
    const under = supportsIn(b.min.x - 0.1, b.max.x + 0.1, b.min.z - 0.1, b.max.z + 0.1).filter((q) => q !== p);
    const h = hanging(p, under, w.ground, model);
    if (h) out.push({ at: near(h.x, h.z), what: `${p.kind} y ${p.prism.bottom.toFixed(2)}: ${h.gap.toFixed(2)} m over what it stands on` });
    const c = model ? null : cut(p, under, w.ground);
    if (c) out.push({ at: near(c.x, c.z), what: `${p.kind} top y ${p.prism.top.toFixed(2)}: ${c.depth.toFixed(2)} m under the ground at part of it` });
  };
  for (const p of w.pieces) look(p, false);
  for (const p of w.models) look(p, true);
  return out;
};

/** A box as a footprint. */
export const boxPiece = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, kind: string): FootPiece => ({
  prism: makePrism([{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }], y0, y1),
  kind,
});
