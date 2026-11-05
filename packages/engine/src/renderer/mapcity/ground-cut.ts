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
  const old = sink.indices.splice(0);
  let cut = 0;
  for (let t = 0; t + 2 < old.length; t += 3) {
    const tri = [old[t] as number, old[t + 1] as number, old[t + 2] as number] as const;
    const xs = tri.map((i) => p[i * 3] ?? 0);
    const zs = tri.map((i) => p[i * 3 + 2] ?? 0);
    const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const over = holes.filter((h) => h.minX < maxX && h.maxX > minX && h.minZ < maxZ && h.maxZ > minZ);
    const whole: Corner[] = tri.map((_, k) => ({ x: xs[k] as number, z: zs[k] as number, w: [k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0] as const }));
    const sign = area(whole);
    if (over.length === 0 || Math.abs(sign) < 1e-6) {
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
