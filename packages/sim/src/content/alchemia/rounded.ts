import type { GroundPoint } from "@seki/core";
import { type Piece, type PieceKind, outlined } from "./plan";

/*
 * Rounded corners of Alchemia's storeys (ADR-0074 B4, to the board 1:1 on 19.11): a slab, its glass
 * and its balustrade follow one outline whose outer corners are quarter circles, in the simulation
 * as in the drawing, so a terrace's corner holds nobody over the air (B4 rounded the drawing only).
 * Pattern: the rounded rectangle (a rectangle's Minkowski sum with a circle, the corner arcs
 * concentric so an outline grown or shrunk keeps its corners round).
 */

/** A slab's corner radius (the board's soft corners, some 2 m), at most a quarter of its shorter side. */
export const CORNER_RADIUS = 2.0;
/** Segments of a quarter circle. */
export const CORNER_ARC = 6;

export interface Rectangle {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}

/** Which corners are rounded, in the outline's order: south-east, north-east, north-west, south-west. */
export type Corners = readonly [boolean, boolean, boolean, boolean];
export const ALL_CORNERS: Corners = [true, true, true, true];

/** The radius of a rectangle's rounded corners. */
export const cornerRadius = (b: Rectangle): number => Math.min(CORNER_RADIUS, (b.x1 - b.x0) / 4, (b.z1 - b.z0) / 4);

/**
 * The outline of `b`, counter-clockwise on the map (x east, z north), its `corners` rounded with
 * `radius` (`cornerRadius(b)` unless given); `grow` moves it out (in when negative), the arcs
 * staying concentric.
 */
export const roundedOutline = (b: Rectangle, grow = 0, corners: Corners = ALL_CORNERS, arc = CORNER_ARC, radius = cornerRadius(b)): GroundPoint[] => {
  const r = radius;
  const spec: readonly [number, number, number, number, number][] = [
    // corner x, corner z, its outward x and z, the arc's first angle
    [b.x1, b.z0, 1, -1, -Math.PI / 2],
    [b.x1, b.z1, 1, 1, 0],
    [b.x0, b.z1, -1, 1, Math.PI / 2],
    [b.x0, b.z0, -1, -1, Math.PI],
  ];
  const out: GroundPoint[] = [];
  spec.forEach(([x, z, ox, oz, a0], i) => {
    if (!corners[i]) {
      out.push({ x: x + ox * grow, z: z + oz * grow });
      return;
    }
    const [cx, cz] = [x - ox * r, z - oz * r];
    for (let k = 0; k <= arc; k++) {
      const a = a0 + (Math.PI / 2) * (k / arc);
      out.push({ x: cx + (r + grow) * Math.cos(a), z: cz + (r + grow) * Math.sin(a) });
    }
  });
  return out;
};

const inside = (r: Rectangle, x: number, z: number): boolean => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

/**
 * Which corners of `r` are outer, with nothing of `others` (the same level's slabs) going on past
 * them along either edge: the joints between the bars of one storey stay square.
 */
export const outerCorners = (r: Rectangle, others: readonly Rectangle[]): Corners => {
  const e = 0.05;
  const corner = (x: number, z: number, ox: number, oz: number): boolean =>
    !others.some((o) => o !== r && (inside(o, x - ox * e, z + oz * e) || inside(o, x + ox * e, z - oz * e)));
  return [corner(r.x1, r.z0, 1, -1), corner(r.x1, r.z1, 1, 1), corner(r.x0, r.z1, -1, 1), corner(r.x0, r.z0, -1, -1)];
};

/** A balustrade's thickness, and the segments of its quarter circles (coarser than a slab's: each is a prism of the solids). */
export const RAIL_THICK = 0.12;
const RAIL_ARC = 2;

/** The spans of the segment p→q (as parameters 0..1) outside every rectangle of `gaps`. */
const outsideGaps = (p: GroundPoint, q: GroundPoint, gaps: readonly Rectangle[]): [number, number][] => {
  let spans: [number, number][] = [[0, 1]];
  for (const g of gaps) {
    // Where the segment is inside g: the slab method on both axes.
    let [t0, t1] = [0, 1];
    for (const [a, d, lo, hi] of [
      [p.x, q.x - p.x, g.x0, g.x1],
      [p.z, q.z - p.z, g.z0, g.z1],
    ] as const) {
      if (Math.abs(d) < 1e-9) {
        if (a <= lo || a >= hi) [t0, t1] = [1, 0];
        continue;
      }
      const [u, v] = [(lo - a) / d, (hi - a) / d].sort((m, n) => m - n) as [number, number];
      [t0, t1] = [Math.max(t0, u), Math.min(t1, v)];
    }
    if (t1 <= t0) continue;
    const [c0, c1] = [t0, t1];
    spans = spans.flatMap(([s0, s1]): [number, number][] => {
      const parts: [number, number][] = [
        [s0, Math.min(s1, c0)],
        [Math.max(s0, c1), s1],
      ];
      return parts.filter(([u, v]) => v - u > 1e-6);
    });
  }
  return spans;
};

/**
 * A balustrade along `b`'s rounded outline grown by `grow`, its pieces the outline's edges a rail
 * thick inwards (a quad each, convex), from `y` up `height`, open where it crosses a rectangle of
 * `gaps` (a stair's head, a way through). Solid where somebody walks; drawn as posts and rails.
 * Of another `kind` it is any thin wall along the outline (ADR-0093 O1: the gallery's glass, `pane`).
 */
export const balustrade = (
  b: Rectangle,
  grow: number,
  corners: Corners,
  y: number,
  height: number,
  solid: boolean,
  gaps: readonly Rectangle[] = [],
  radius = cornerRadius(b),
  kind: PieceKind = "parapet",
  thick = RAIL_THICK,
): Piece[] => {
  const pts = roundedOutline(b, grow, corners, RAIL_ARC, radius);
  const out: Piece[] = [];
  pts.forEach((p0, i) => {
    const q0 = pts[(i + 1) % pts.length]!;
    const len = Math.hypot(q0.x - p0.x, q0.z - p0.z);
    if (len < 0.05) return;
    // Inwards is left of the edge on a counter-clockwise outline.
    const [nx, nz] = [(-(q0.z - p0.z) / len) * thick, ((q0.x - p0.x) / len) * thick];
    for (const [t0, t1] of outsideGaps(p0, q0, gaps)) {
      if ((t1 - t0) * len < 0.05) continue;
      const p = { x: p0.x + (q0.x - p0.x) * t0, z: p0.z + (q0.z - p0.z) * t0 };
      const q = { x: p0.x + (q0.x - p0.x) * t1, z: p0.z + (q0.z - p0.z) * t1 };
      out.push(outlined([p, q, { x: q.x + nx, z: q.z + nz }, { x: p.x + nx, z: p.z + nz }], y, y + height, kind, solid));
    }
  });
  return out;
};
