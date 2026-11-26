import { type GroundPoint, type TerrainGrid, breakCells } from "@seki/core";
import type { MeshSink, Rgba, Vec } from "../mesh-sink";
import { face, vertex } from "./sink-ops";

/**
 * The terrain mesh cut at its grid's breaklines (G-971, `@seki/core` `brokenHeight`): the
 * ground steps at a line, so a cell's triangles drawn straight across it would smear the step over
 * the cell again, a bank before the wall's face and a ditch behind its parapet. Each triangle of a
 * cell a line crosses is clipped (Sutherland-Hodgman) by two lines `FACE_INSET` either side of
 * the wall's axis, inside its 0.4 m: the parts beside the wall lie on their own side's ground, the
 * strip between, under the wall, takes the step. The vertices of the parts are not shared, as
 * the grid's are; their normals are read on their own side of the line.
 */

/** How far either side of a breakline its wall's faces are cut (m): inside a retaining wall's half thickness (0.2 m). */
export const FACE_INSET = 0.15;
/** Normals within this of a line are read further out on their side (m): the central differences' reach plus a margin. */
const NORMAL_REACH = 0.8;

type P2 = GroundPoint;
interface Segment {
  readonly a: P2;
  readonly b: P2;
}
type HeightAt = (x: number, z: number) => number;

/** Signed distance of p from the segment's line, positive to its left. */
const signed = (s: Segment, p: P2): number => {
  const [dx, dz] = [s.b.x - s.a.x, s.b.z - s.a.z];
  return (dx * (p.z - s.a.z) - dz * (p.x - s.a.x)) / (Math.hypot(dx, dz) || 1);
};

/** Distance from p to the segment itself and the unit normal to its left. */
const near = (s: Segment, p: P2): { d: number; n: P2; side: number } => {
  const [dx, dz] = [s.b.x - s.a.x, s.b.z - s.a.z];
  const len = Math.hypot(dx, dz) || 1;
  const t = Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.z - s.a.z) * dz) / (len * len)));
  const side = signed(s, p) >= 0 ? 1 : -1;
  return { d: Math.hypot(p.x - s.a.x - dx * t, p.z - s.a.z - dz * t), n: { x: -dz / len, z: dx / len }, side };
};

/** The part of a convex polygon where `f` is not negative. */
const clip = (poly: readonly P2[], f: (p: P2) => number): P2[] => {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as P2;
    const b = poly[(i + 1) % poly.length] as P2;
    const [fa, fb] = [f(a), f(b)];
    if (fa >= 0) out.push(a);
    if ((fa > 0 && fb < 0) || (fa < 0 && fb > 0)) {
      const t = fa / (fa - fb);
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return out;
};

/** The grid's segments, each once, for the normals near them. */
const segmentsOf = (grid: TerrainGrid): Segment[] => (grid.breaks ?? []).flatMap((l) => l.slice(1).map((b, i) => ({ a: l[i] as P2, b })));

/** What `planTerrain` needs of a grid's breaklines: the cells they cross and a normal that does not read across them. */
export interface TerrainBreaks {
  /** The segments through the grid's cell at (col, row), or none. */
  readonly at: (col: number, row: number) => readonly Segment[] | undefined;
  /** The ground's normal at (x, z), read on its own side of a line within `NORMAL_REACH` of it. */
  readonly normal: (normalAt: (x: number, z: number) => Vec, x: number, z: number) => Vec;
}

/** The breaklines of a grid as `planTerrain` cuts them; null for a grid without any. */
export const terrainBreaks = (grid: TerrainGrid): TerrainBreaks | null => {
  if (!grid.breaks?.length) return null;
  const cells = breakCells(grid);
  const segments = segmentsOf(grid);
  return { at: (col, row) => cells.get(row * (grid.cols - 1) + col), normal: sideNormal(segments) };
};

/** A convex polygon in its parts at the segment's wall: beside it on either side and under it. */
const cutConvex = (poly: readonly P2[], s: Segment): P2[][] => {
  const left = clip(poly, (p) => signed(s, p) - FACE_INSET);
  const right = clip(poly, (p) => -signed(s, p) - FACE_INSET);
  const under = clip(
    clip(poly, (p) => FACE_INSET - signed(s, p)),
    (p) => signed(s, p) + FACE_INSET,
  );
  return [left, right, under].filter((p) => p.length >= 3);
};

/** The segment of `segments` nearest the middle of `poly`: the line the ground steps at there. */
const nearestTo = (segments: readonly Segment[], poly: readonly P2[]): Segment => {
  const mid = { x: poly.reduce((a, p) => a + p.x, 0) / poly.length, z: poly.reduce((a, p) => a + p.z, 0) / poly.length };
  return segments.reduce((best, q) => (near(q, mid).d < near(best, mid).d ? q : best), segments[0] as Segment);
};

/** The parts of a convex polygon cut at the wall of the segment of `segments` nearest it. */
export const cutAtWall = (poly: readonly P2[], segments: readonly Segment[]): P2[][] => cutConvex(poly, nearestTo(segments, poly));

/** The side normal of `terrainBreaks`, for any set of segments. */
const sideNormal = (segments: readonly Segment[]) => (normalAt: (x: number, z: number) => Vec, x: number, z: number): Vec => {
  let best: ReturnType<typeof near> | null = null;
  for (const s of segments) {
    const k = near(s, { x, z });
    if (!best || k.d < best.d) best = k;
  }
  if (!best || best.d >= NORMAL_REACH) return normalAt(x, z);
  const out = NORMAL_REACH - best.d + 0.05;
  return normalAt(x + best.n.x * best.side * out, z + best.n.z * best.side * out);
};

/**
 * The breaklines of the terrains as the drape cuts them, on the drape's world grid of `cell`
 * (cell i spans i·cell to (i + 1)·cell): in a cell a line crosses, a surface's pieces are cut at
 * the wall as the terrain is, and laid at the ground's own height, which steps at the line, not
 * on the plane of the cell's corners across it.
 */
export interface DrapeBreaks {
  /** The segments through the drape's cell (i, k), or none. */
  readonly at: (i: number, k: number) => readonly Segment[] | undefined;
  readonly normal: TerrainBreaks["normal"];
  readonly cell: number;
}

/** The drape's breaks from the terrains' grids; null where none has a line. */
export const drapeBreaks = (grids: Iterable<TerrainGrid>, cell: number): DrapeBreaks | null => {
  const lines = [...grids].flatMap((g) => g.breaks ?? []);
  const segments = lines.flatMap((l) => l.slice(1).map((b, i) => ({ a: l[i] as P2, b })));
  if (segments.length === 0) return null;
  const xs = segments.flatMap((s) => [s.a.x, s.b.x]);
  const zs = segments.flatMap((s) => [s.a.z, s.b.z]);
  const [i0, k0] = [Math.floor(Math.min(...xs) / cell) - 1, Math.floor(Math.min(...zs) / cell) - 1];
  const cols = Math.ceil(Math.max(...xs) / cell) + 2 - i0;
  const rows = Math.ceil(Math.max(...zs) / cell) + 2 - k0;
  // A frame of the world grid round the lines, as core's cells of a terrain grid.
  const cells = breakCells({ originX: i0 * cell, originZ: k0 * cell, cell, cols, rows, breaks: lines });
  return {
    at: (i, k) => (i < i0 || k < k0 || i - i0 >= cols - 1 ? undefined : cells.get((k - k0) * (cols - 1) + (i - i0))),
    normal: sideNormal(segments),
    cell,
  };
};

/**
 * A cell's two triangles (a b c, a c d, as the grid's other cells are cut) cut at the segments
 * through it: by the one nearest each triangle's middle, whose line the ground steps at there.
 */
export const planCutCell = (sink: MeshSink, corners: readonly [P2, P2, P2, P2], segments: readonly Segment[], h: HeightAt, normal: (x: number, z: number) => Vec, color: Rgba, meta: readonly [number, number]): void => {
  const [a, b, c, d] = corners;
  const up = { x: 0, y: 1, z: 0 };
  for (const tri of [
    [a, b, c],
    [a, c, d],
  ]) {
    for (const part of cutAtWall(tri, segments)) {
      const idx = part.map((p) => vertex(sink, { x: p.x, y: h(p.x, p.z), z: p.z }, normal(p.x, p.z), color, [p.x, p.z], meta));
      for (let k = 1; k + 1 < idx.length; k++) face(sink, idx[0] as number, idx[k] as number, idx[k + 1] as number, up);
    }
  }
};
