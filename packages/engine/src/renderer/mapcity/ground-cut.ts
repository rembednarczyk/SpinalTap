import type { MeshSink } from "../mesh-sink";

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
