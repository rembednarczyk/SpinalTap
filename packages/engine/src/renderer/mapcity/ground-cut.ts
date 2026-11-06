import type { MeshSink, Vec } from "../mesh-sink";
import { type P2, boundsOf } from "./polygon";

/** A rectangle on the ground (x east, z north). */
export interface GroundHole {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** A corner of a piece of a triangle: where it is and its weights of the triangle's corners. */
interface Corner {
  readonly x: number;
  readonly z: number;
  readonly w: readonly [number, number, number];
}

const mix = (a: Corner, b: Corner, t: number): Corner => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t,
  w: [a.w[0] + (b.w[0] - a.w[0]) * t, a.w[1] + (b.w[1] - a.w[1]) * t, a.w[2] + (b.w[2] - a.w[2]) * t],
});

/** The part of a convex polygon where `side` (linear in x and z) is >= 0 (Sutherland–Hodgman). */
const clip = (poly: readonly Corner[], side: (c: Corner) => number): Corner[] => {
  const out: Corner[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Corner;
    const b = poly[(i + 1) % poly.length] as Corner;
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) out.push(mix(a, b, sa / (sa - sb)));
  }
  return out;
};

/** A convex polygon less a rectangle: up to four convex pieces (west, east, then south and north between them). */
const minus = (poly: readonly Corner[], r: GroundHole): Corner[][] => {
  const west = clip(poly, (c) => r.minX - c.x);
  const east = clip(poly, (c) => c.x - r.maxX);
  const middle = clip(clip(poly, (c) => c.x - r.minX), (c) => r.maxX - c.x);
  const south = clip(middle, (c) => r.minZ - c.z);
  const north = clip(middle, (c) => c.z - r.maxZ);
  return [west, east, south, north].filter((p) => p.length >= 3);
};

const area = (p: readonly Corner[]): number => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i] as Corner;
    const b = p[(i + 1) % p.length] as Corner;
    s += a.x * b.z - b.x * a.z;
  }
  return s / 2;
};

/** Attribute arrays of a sink and how many numbers a vertex has in each. */
const ARRAYS = [
  ["positions", 3],
  ["normals", 3],
  ["colors", 4],
  ["uvs", 2],
  ["uvs2", 2],
] as const;

/** A new vertex of the sink: each attribute the weighted sum of the triangle's corners'. */
const blend = (sink: MeshSink, tri: readonly [number, number, number], w: readonly [number, number, number]): number => {
  const index = sink.vertexCount;
  for (const [key, size] of ARRAYS) {
    const arr = sink[key];
    for (let k = 0; k < size; k++) arr.push(w[0] * (arr[tri[0] * size + k] ?? 0) + w[1] * (arr[tri[1] * size + k] ?? 0) + w[2] * (arr[tri[2] * size + k] ?? 0));
  }
  return index;
};

const overlaps = (h: GroundHole, b: GroundHole): boolean => h.minX < b.maxX && h.maxX > b.minX && h.minZ < b.maxZ && h.maxZ > b.minZ;

/** The XZ box of a sink's vertices. */
const boxOf = (p: readonly number[]): GroundHole => {
  let [minX, maxX, minZ, maxZ] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i + 2 < p.length; i += 3) {
    const [x, z] = [p[i] as number, p[i + 2] as number];
    [minX, maxX, minZ, maxZ] = [Math.min(minX, x), Math.max(maxX, x), Math.min(minZ, z), Math.max(maxZ, z)];
  }
  return { minX, maxX, minZ, maxZ };
};

/**
 * Cuts the rectangles out of a sink's ground (ADR-0071 stage 2: the shafts of the metro's
 * pavilions): every triangle lying over one is replaced by its pieces outside it, their corners
 * interpolated across the triangle (positions, normals, colours, uvs), so the edges the pieces
 * share with the neighbours stay where they were and nothing cracks. Triangles standing on edge
 * (skirts, kerbs' faces) are kept. Returns how many triangles were cut.
 */
export const cutGround = (sink: MeshSink, holes: readonly GroundHole[]): number => {
  if (holes.length === 0 || sink.empty) return 0;
  const p = sink.positions;
  // Every chunk's ground is cut and few hold a shaft: the box of the sink, then of each triangle,
  // passes over the rest without building its corners (G-333).
  const all = boxOf(p);
  const near = holes.filter((h) => overlaps(h, all));
  if (near.length === 0) return 0;
  const old = sink.indices.splice(0);
  let cut = 0;
  for (let t = 0; t + 2 < old.length; t += 3) {
    const tri = [old[t] as number, old[t + 1] as number, old[t + 2] as number] as const;
    const [x0, x1, x2] = [p[tri[0] * 3] ?? 0, p[tri[1] * 3] ?? 0, p[tri[2] * 3] ?? 0];
    const [z0, z1, z2] = [p[tri[0] * 3 + 2] ?? 0, p[tri[1] * 3 + 2] ?? 0, p[tri[2] * 3 + 2] ?? 0];
    const box = { minX: Math.min(x0, x1, x2), maxX: Math.max(x0, x1, x2), minZ: Math.min(z0, z1, z2), maxZ: Math.max(z0, z1, z2) };
    const over = near.filter((h) => overlaps(h, box));
    if (over.length === 0) {
      sink.indices.push(...tri);
      continue;
    }
    const whole: Corner[] = [
      { x: x0, z: z0, w: [1, 0, 0] },
      { x: x1, z: z1, w: [0, 1, 0] },
      { x: x2, z: z2, w: [0, 0, 1] },
    ];
    const sign = area(whole);
    if (Math.abs(sign) < 1e-6) {
      sink.indices.push(...tri);
      continue;
    }
    cut++;
    let pieces: Corner[][] = [whole];
    for (const h of over) pieces = pieces.flatMap((piece) => minus(piece, h));
    for (const piece of pieces) {
      if (Math.abs(area(piece)) < 1e-6) continue;
      const ids = piece.map((c) => blend(sink, tri, c.w));
      // A fan over the convex piece, wound as the triangle was.
      const flip = area(piece) * sign < 0;
      for (let k = 1; k + 1 < ids.length; k++) {
        const [a, b, c] = [ids[0] as number, ids[k] as number, ids[k + 1] as number];
        sink.indices.push(...(flip ? [a, c, b] : [a, b, c]));
      }
    }
  }
  return cut;
};

/**
 * A convex polygon less a triangle (`tri`, either winding): up to three convex pieces, one past
 * each of its edges, unless `keep` holds for the part inside it: then the polygon whole.
 */
const minusTriangle = (poly: readonly Corner[], tri: readonly [P2, P2, P2], keep: (inside: readonly Corner[]) => boolean): Corner[][] => {
  const [a, b, c] = tri;
  const wind = Math.sign((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  const out: Corner[][] = [];
  let rest: Corner[] = [...poly];
  for (const [p, q] of [[a, b], [b, c], [c, a]] as const) {
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    // Metres to the left of p → q (inside for a counter-clockwise triangle).
    const left = (k: Corner) => (wind * ((q.x - p.x) * (k.z - p.z) - (q.z - p.z) * (k.x - p.x))) / len;
    const sides = rest.map(left);
    // Wholly on one side, as a piece of a grid's cell mostly is: nothing to clip.
    if (sides.every((d) => d <= 0)) return [[...poly]];
    if (sides.every((d) => d >= 0)) continue;
    const past = clip(rest, (k) => -left(k));
    if (past.length >= 3) out.push(past);
    rest = clip(rest, left);
    if (rest.length < 3) return [[...poly]];
  }
  return Math.abs(area(rest)) < 1e-6 || keep(rest) ? [[...poly]] : out;
};

/** A triangle of the ground another piece lays over (x east, y up, z north). */
export type GroundCover = readonly [Vec, Vec, Vec];

/** Side of the bins the covers are sorted into (m): the drape's grid. */
const BIN = 2.5;
/** How near two triangles lie to be in one plane (m): a tenth of the 1 cm between the nearest lifts. */
const SAME_PLANE = 0.001;

/** The height of the plane of a cover at (x, z). */
const coverY = (t: GroundCover, x: number, z: number): number => {
  const [a, b, c] = t;
  const d = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const u = ((x - a.x) * (c.z - a.z) - (z - a.z) * (c.x - a.x)) / d;
  const v = ((b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x)) / d;
  return a.y + u * (b.y - a.y) + v * (c.y - a.y);
};

/**
 * Takes the triangles of `covers` out of the triangles of a sink from index `from` on where the two
 * lie in one plane (G-320: paving another piece lays over at the same depth, which the depth
 * buffer would take either of pixel by pixel; a way under a bridge's deck keeps its own), as
 * `cutGround` takes the shafts out: a triangle under one is replaced by its pieces outside it,
 * their corners interpolated across it. Both are cut on the drape's grid (`drapeTriangles`): a
 * cover overlapping a triangle lies in the triangle's cell of it.
 */
export const cutCovers = (sink: MeshSink, from: number, covers: readonly GroundCover[]): void => {
  // By the cells of the drape's grid their boxes touch: a square's piece meets a few of thousands.
  const key = (i: number, k: number): number => (i + 1e5) * 2e5 + k + 1e5;
  const bins = new Map<number, { t: GroundCover; box: GroundHole }[]>();
  const keys = (b: GroundHole): number[] => {
    const out: number[] = [];
    for (let i = Math.floor(b.minX / BIN); i <= Math.floor(b.maxX / BIN); i++) for (let k = Math.floor(b.minZ / BIN); k <= Math.floor(b.maxZ / BIN); k++) out.push(key(i, k));
    return out;
  };
  for (const t of covers) {
    if (Math.abs((t[1].x - t[0].x) * (t[2].z - t[0].z) - (t[1].z - t[0].z) * (t[2].x - t[0].x)) <= 1e-9) continue;
    const hole = { t, box: boundsOf(t) };
    for (const k of keys(hole.box)) {
      const bin = bins.get(k);
      if (bin) bin.push(hole);
      else bins.set(k, [hole]);
    }
  }
  if (bins.size === 0) return;
  const p = sink.positions;
  const old = sink.indices.splice(from);
  for (let t = 0; t + 2 < old.length; t += 3) {
    const tri = [old[t] as number, old[t + 1] as number, old[t + 2] as number] as const;
    const [x0, x1, x2] = [p[tri[0] * 3] ?? 0, p[tri[1] * 3] ?? 0, p[tri[2] * 3] ?? 0];
    const [z0, z1, z2] = [p[tri[0] * 3 + 2] ?? 0, p[tri[1] * 3 + 2] ?? 0, p[tri[2] * 3 + 2] ?? 0];
    const bin = bins.get(key(Math.floor((x0 + x1 + x2) / 3 / BIN), Math.floor((z0 + z1 + z2) / 3 / BIN)));
    const box = { minX: Math.min(x0, x1, x2), maxX: Math.max(x0, x1, x2), minZ: Math.min(z0, z1, z2), maxZ: Math.max(z0, z1, z2) };
    const near = bin?.filter((h) => overlaps(h.box, box)) ?? [];
    const whole: Corner[] = [
      { x: x0, z: z0, w: [1, 0, 0] },
      { x: x1, z: z1, w: [0, 1, 0] },
      { x: x2, z: z2, w: [0, 0, 1] },
    ];
    const sign = near.length === 0 ? 0 : area(whole);
    if (Math.abs(sign) < 1e-6) {
      sink.indices.push(...tri);
      continue;
    }
    const ys = tri.map((v) => p[v * 3 + 1] ?? 0);
    // Both are flat where they overlap: off the cover's plane at a corner of the overlap, the piece is kept.
    const off = (cover: GroundCover) => (inside: readonly Corner[]) =>
      inside.some((c) => Math.abs(c.w[0] * (ys[0] ?? 0) + c.w[1] * (ys[1] ?? 0) + c.w[2] * (ys[2] ?? 0) - coverY(cover, c.x, c.z)) > SAME_PLANE);
    let pieces: Corner[][] = [whole];
    for (const h of near) pieces = pieces.flatMap((piece) => (overlaps(h.box, boundsOf(piece)) ? minusTriangle(piece, h.t, off(h.t)) : [piece]));
    for (const piece of pieces) {
      if (Math.abs(area(piece)) < 1e-6) continue;
      // A corner of the triangle itself keeps its vertex: only the cut points are new.
      const ids = piece.map((c) => tri[c.w.indexOf(1)] ?? blend(sink, tri, c.w));
      const flip = area(piece) * sign < 0;
      for (let k = 1; k + 1 < ids.length; k++) {
        const [a, b, c] = [ids[0] as number, ids[k] as number, ids[k + 1] as number];
        sink.indices.push(...(flip ? [a, c, b] : [a, b, c]));
      }
    }
  }
};
