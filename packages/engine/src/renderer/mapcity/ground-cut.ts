import type { MeshSink, Vec } from "../mesh-sink";
import { boundsOf } from "./polygon";

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

/**
 * The triangles of a sink from index `from` on, to be laid anew over them (`put`, then `end`). In
 * place: cut out and pushed back, the indices of a whole cell were copied over and over as the
 * array grew back for each piece of it (G-444).
 */
const relay = (sink: MeshSink, from: number) => {
  const ix = sink.indices;
  const old = ix.slice(from);
  let w = from;
  return {
    old,
    put: (a: number, b: number, c: number): void => {
      ix[w++] = a;
      ix[w++] = b;
      ix[w++] = c;
    },
    end: (): void => {
      ix.length = w;
    },
  };
};

const overlaps = (h: GroundHole, b: GroundHole): boolean => h.minX < b.maxX && h.maxX > b.minX && h.minZ < b.maxZ && h.maxZ > b.minZ;

/** The XZ box of a sink's vertices. */
const boxOf = (p: readonly number[]): GroundHole => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i + 2 < p.length; i += 3) {
    const x = p[i] as number;
    const z = p[i + 2] as number;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
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
  const { old, put, end } = relay(sink, 0);
  let cut = 0;
  for (let t = 0; t + 2 < old.length; t += 3) {
    // Kept on plain numbers while no shaft is near: no box or corners built (G-444).
    const v0 = old[t] as number;
    const v1 = old[t + 1] as number;
    const v2 = old[t + 2] as number;
    const x0 = p[v0 * 3] ?? 0;
    const x1 = p[v1 * 3] ?? 0;
    const x2 = p[v2 * 3] ?? 0;
    const z0 = p[v0 * 3 + 2] ?? 0;
    const z1 = p[v1 * 3 + 2] ?? 0;
    const z2 = p[v2 * 3 + 2] ?? 0;
    const minX = Math.min(x0, x1, x2);
    const maxX = Math.max(x0, x1, x2);
    const minZ = Math.min(z0, z1, z2);
    const maxZ = Math.max(z0, z1, z2);
    let over: GroundHole[] | null = null;
    for (const h of near) if (h.minX < maxX && h.maxX > minX && h.minZ < maxZ && h.maxZ > minZ) (over ??= []).push(h);
    if (over === null) {
      put(v0, v1, v2);
      continue;
    }
    const tri = [v0, v1, v2] as const;
    const whole: Corner[] = [
      { x: x0, z: z0, w: [1, 0, 0] },
      { x: x1, z: z1, w: [0, 1, 0] },
      { x: x2, z: z2, w: [0, 0, 1] },
    ];
    const sign = area(whole);
    if (Math.abs(sign) < 1e-6) {
      put(v0, v1, v2);
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
        if (flip) put(a, c, b);
        else put(a, b, c);
      }
    }
  }
  end();
  return cut;
};

/**
 * A convex polygon less a triangle (`tri`, either winding): up to three convex pieces, one past
 * each of its edges, unless `keep` holds for the part inside it. Null for the polygon whole, as
 * most come out of it: no list for them (G-444).
 */
const minusTriangle = (poly: readonly Corner[], tri: GroundCover, keep: (inside: readonly Corner[], tri: GroundCover) => boolean): Corner[][] | null => {
  const [a, b, c] = tri;
  const wind = Math.sign((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  let out: Corner[][] | null = null;
  let rest: readonly Corner[] = poly;
  for (let e = 0; e < 3; e++) {
    const p = e === 0 ? a : e === 1 ? b : c;
    const q = e === 0 ? b : e === 1 ? c : a;
    const ex = q.x - p.x;
    const ez = q.z - p.z;
    // Most pieces of a grid's cell lie wholly on one side: told apart by the sign of `left` alone,
    // without its length or a copy of either (G-444).
    let over = false;
    let under = false;
    for (const k of rest) {
      const d = wind * (ex * (k.z - p.z) - ez * (k.x - p.x));
      if (!(d <= 0)) over = true;
      if (!(d >= 0)) under = true;
    }
    if (!over) return null;
    if (!under) continue;
    const len = Math.hypot(ex, ez) || 1;
    // Metres to the left of p → q (inside for a counter-clockwise triangle).
    const left = (k: Corner) => (wind * (ex * (k.z - p.z) - ez * (k.x - p.x))) / len;
    const past = clip(rest, (k) => -left(k));
    if (past.length >= 3) (out ??= []).push(past);
    rest = clip(rest, left);
    if (rest.length < 3) return null;
  }
  return Math.abs(area(rest)) < 1e-6 || keep(rest, tri) ? null : (out ?? []);
};

/** A triangle of the ground another piece lays over (x east, y up, z north). */
export type GroundCover = readonly [Vec, Vec, Vec];

/** Side of the bins the covers are sorted into (m): the drape's grid. */
const BIN = 2.5;
/** How near two triangles lie to be in one plane (m): a tenth of the 1 cm between the nearest lifts. */
const SAME_PLANE = 0.001;

/**
 * Key of a bin of the covers. Keys stay small integers, which a map finds faster (G-444); bins
 * further than 37 km from the origin may share one, which only adds covers the boxes then pass over.
 */
const binKey = (i: number, k: number): number => (i + 1.5e4) * 3e4 + k + 1.5e4;

/** The height of the plane of a cover at (x, z). */
const coverY = (t: GroundCover, x: number, z: number): number => {
  const [a, b, c] = t;
  const d = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const u = ((x - a.x) * (c.z - a.z) - (z - a.z) * (c.x - a.x)) / d;
  const v = ((b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x)) / d;
  return a.y + u * (b.y - a.y) + v * (c.y - a.y);
};

/**
 * The cells of the drape's grid a cover may meet a triangle of a sink from index `from` on in
 * (`cutCovers`): the bins of the triangles' centres and the cells round them. A cover lies in one
 * cell and its box touches the bins of that cell and of the next ones: in any other it is passed
 * over, and a piece laid over a long slanting street leaves most of its box (G-444).
 */
export const cellsUnder = (sink: MeshSink, from: number): ((i: number, k: number) => boolean) => {
  const p = sink.positions;
  const ix = sink.indices;
  const bins = new Set<number>();
  const cells = new Set<number>();
  for (let t = from; t + 2 < ix.length; t += 3) {
    const [a, b, c] = [(ix[t] as number) * 3, (ix[t + 1] as number) * 3, (ix[t + 2] as number) * 3];
    // As `cutCovers` finds a triangle's bin.
    const i = Math.floor(((p[a] ?? 0) + (p[b] ?? 0) + (p[c] ?? 0)) / 3 / BIN);
    const k = Math.floor(((p[a + 2] ?? 0) + (p[b + 2] ?? 0) + (p[c + 2] ?? 0)) / 3 / BIN);
    if (bins.has(binKey(i, k))) continue;
    bins.add(binKey(i, k));
    for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) cells.add(binKey(i + di, k + dk));
  }
  return (i, k) => cells.has(binKey(i, k));
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
  const key = binKey;
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
  const { old, put, end } = relay(sink, from);
  for (let t = 0; t + 2 < old.length; t += 3) {
    // Most triangles meet no cover: kept on plain numbers, with no box, corners or lists built (G-444).
    const v0 = old[t] as number;
    const v1 = old[t + 1] as number;
    const v2 = old[t + 2] as number;
    const x0 = p[v0 * 3] ?? 0;
    const x1 = p[v1 * 3] ?? 0;
    const x2 = p[v2 * 3] ?? 0;
    const z0 = p[v0 * 3 + 2] ?? 0;
    const z1 = p[v1 * 3 + 2] ?? 0;
    const z2 = p[v2 * 3 + 2] ?? 0;
    const bin = bins.get(key(Math.floor((x0 + x1 + x2) / 3 / BIN), Math.floor((z0 + z1 + z2) / 3 / BIN)));
    let near: { t: GroundCover; box: GroundHole }[] | null = null;
    if (bin) {
      const minX = Math.min(x0, x1, x2);
      const maxX = Math.max(x0, x1, x2);
      const minZ = Math.min(z0, z1, z2);
      const maxZ = Math.max(z0, z1, z2);
      for (const h of bin) if (h.box.minX < maxX && h.box.maxX > minX && h.box.minZ < maxZ && h.box.maxZ > minZ) (near ??= []).push(h);
    }
    if (near === null) {
      put(v0, v1, v2);
      continue;
    }
    const tri = [v0, v1, v2] as const;
    const whole: Corner[] = [
      { x: x0, z: z0, w: [1, 0, 0] },
      { x: x1, z: z1, w: [0, 1, 0] },
      { x: x2, z: z2, w: [0, 0, 1] },
    ];
    const sign = area(whole);
    if (Math.abs(sign) < 1e-6) {
      put(v0, v1, v2);
      continue;
    }
    const ys = tri.map((v) => p[v * 3 + 1] ?? 0);
    // Both are flat where they overlap: off the cover's plane at a corner of the overlap, the piece is kept.
    const off = (inside: readonly Corner[], cover: GroundCover) =>
      inside.some((c) => Math.abs(c.w[0] * (ys[0] ?? 0) + c.w[1] * (ys[1] ?? 0) + c.w[2] * (ys[2] ?? 0) - coverY(cover, c.x, c.z)) > SAME_PLANE);
    let pieces: (readonly Corner[])[] = [whole];
    // The box of each piece; the lists are copied only when a cover cuts one.
    let boxes: GroundHole[] = [boundsOf(whole)];
    for (const h of near) {
      let next: (readonly Corner[])[] | null = null;
      let nextBoxes: GroundHole[] = [];
      for (let n = 0; n < pieces.length; n++) {
        const piece = pieces[n] as readonly Corner[];
        const box = boxes[n] as GroundHole;
        const left = overlaps(h.box, box) ? minusTriangle(piece, h.t, off) : null;
        if (left === null) {
          if (next !== null) {
            next.push(piece);
            nextBoxes.push(box);
          }
          continue;
        }
        if (next === null) {
          next = pieces.slice(0, n);
          nextBoxes = boxes.slice(0, n);
        }
        for (const l of left) {
          next.push(l);
          nextBoxes.push(boundsOf(l));
        }
      }
      if (next === null) continue;
      pieces = next;
      boxes = nextBoxes;
    }
    for (const piece of pieces) {
      if (Math.abs(area(piece)) < 1e-6) continue;
      // A corner of the triangle itself keeps its vertex: only the cut points are new.
      const ids = piece.map((c) => tri[c.w.indexOf(1)] ?? blend(sink, tri, c.w));
      const flip = area(piece) * sign < 0;
      for (let k = 1; k + 1 < ids.length; k++) {
        const [a, b, c] = [ids[0] as number, ids[k] as number, ids[k + 1] as number];
        if (flip) put(a, c, b);
        else put(a, b, c);
      }
    }
  }
  end();
};
