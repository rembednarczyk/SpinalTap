/**
 * Marching squares (raster to vector, ADR-0077 step 1.1): the outlines of a class on a lattice of
 * samples, as GIS tools trace land cover layers out of a classified raster. The contour runs
 * between a sample in the class and one out of it, where `cross` says, so every sample in the
 * class lies inside an outline and every other one outside. A saddle (two samples in the class
 * diagonally apart) is resolved apart: the class's regions are its 4-connected ones. Outlines come
 * closed and oriented: an outer ring counter-clockwise, a hole clockwise (x east, z north).
 */
import { type Pt } from "./geometry.ts";

export interface Lattice {
  readonly nx: number;
  readonly nz: number;
  /** 1 where sample (i, j) is in the class, row by row (`j * nx + i`); none off the lattice is. */
  readonly inside: Uint8Array;
  /** The world point of sample (i, j), off the lattice too. */
  readonly at: (i: number, j: number) => Pt;
  /** Where the contour crosses from sample a in the class to its neighbour b out of it, as a share of the way from a (0 to 1). */
  readonly cross: (ai: number, aj: number, bi: number, bj: number) => number;
}

/** The square's edges: south (corners 0-1), east (1-2), north (3-2), west (0-3); corners SW, SE, NE, NW. */
const [S, E, N, W] = [0, 1, 2, 3] as const;
type Seg = readonly [a: number, b: number, ref: number];
/** The segments of each case (bit k: corner k in the class), with a corner on a known side of each. */
const CASES: readonly (readonly Seg[])[] = [
  [],
  [[W, S, 0]],
  [[S, E, 1]],
  [[W, E, 0]],
  [[E, N, 2]],
  [
    [W, S, 0],
    [E, N, 2],
  ],
  [[S, N, 1]],
  [[N, W, 3]],
  [[N, W, 3]],
  [[S, N, 0]],
  [
    [S, E, 1],
    [N, W, 3],
  ],
  [[E, N, 2]],
  [[E, W, 2]],
  [[S, E, 1]],
  [[W, S, 0]],
  [],
];
const CORNER: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
/** An edge of square (i, j) as the samples it joins, offset from (i, j). */
const EDGE: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 1, 0],
  [1, 0, 1, 1],
  [0, 1, 1, 1],
  [0, 0, 0, 1],
];

/**
 * The segments of each case from edge to edge with the class on their left (counter-clockwise
 * round it), read off the edges' middles: a crossing moves along its edge, never past a corner,
 * so the side a corner lies on stays.
 */
const MIDDLE: readonly Pt[] = [
  { x: 0.5, z: 0 },
  { x: 1, z: 0.5 },
  { x: 0.5, z: 1 },
  { x: 0, z: 0.5 },
];
const ORIENTED: readonly (readonly (readonly [number, number])[])[] = CASES.map((segs, mask) =>
  segs.map(([a, b, ref]) => {
    const [p, q, c] = [MIDDLE[a]!, MIDDLE[b]!, { x: CORNER[ref]![0], z: CORNER[ref]![1] }];
    const left = (q.x - p.x) * (c.z - p.z) - (q.z - p.z) * (c.x - p.x) > 0;
    return left === ((mask >> ref) & 1) > 0 ? ([a, b] as const) : ([b, a] as const);
  }),
);

/** The ring less its corners on a straight line through their neighbours (a run along a row or a column), in one pass. */
const straight = (ring: readonly Pt[]): Pt[] => {
  const out: Pt[] = [];
  const n = ring.length;
  for (let k = 0; k < n; k++) {
    const a = out[out.length - 1] ?? ring[n - 1]!;
    const p = ring[k]!;
    const b = ring[(k + 1) % n]!;
    if (Math.abs((p.x - a.x) * (b.z - a.z) - (p.z - a.z) * (b.x - a.x)) > 1e-9) out.push(p);
  }
  return out;
};

/** The closed outlines of the class on the lattice. */
export const contours = (l: Lattice): Pt[][] => {
  const w = l.nx + 2;
  const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < l.nx && j < l.nz && l.inside[j * l.nx + i] === 1;
  // An edge's id: its south-west sample (the lattice padded by one) and whether it runs north.
  const edgeId = (i: number, j: number, north: boolean) => ((j + 1) * w + (i + 1)) * 2 + (north ? 1 : 0);
  // The edge the contour runs on to from each edge it crosses, by edge id, in the order found.
  const size = w * (l.nz + 2) * 2;
  const next = new Int32Array(size).fill(-1);
  const order: number[] = [];
  const edgeOf = (i: number, j: number, k: number): number => {
    const e = EDGE[k]!;
    return edgeId(i + e[0], j + e[1], e[0] === e[2]);
  };
  /** The crossing point on the edge `id`. */
  const pointOf = (id: number): Pt => {
    const north = (id & 1) === 1;
    const cell = id >> 1;
    const ai = (cell % w) - 1;
    const aj = Math.floor(cell / w) - 1;
    const bi = north ? ai : ai + 1;
    const bj = north ? aj + 1 : aj;
    // From the sample in the class to the one out of it.
    const from = inside(ai, aj);
    const a = from ? l.at(ai, aj) : l.at(bi, bj);
    const b = from ? l.at(bi, bj) : l.at(ai, aj);
    const t = from ? l.cross(ai, aj, bi, bj) : l.cross(bi, bj, ai, aj);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
  };
  // The class padded by a sample out of it all round: sample (i, j) at (j + 1) * w + i + 1.
  const pad = new Uint8Array(w * (l.nz + 2));
  // Whether a row has any sample in the class: a square between two rows without one is skipped.
  const any = new Uint8Array(l.nz + 2);
  for (let j = 0; j < l.nz; j++) {
    const row = l.inside.subarray(j * l.nx, (j + 1) * l.nx);
    pad.set(row, (j + 1) * w + 1);
    any[j + 1] = row.includes(1) ? 1 : 0;
  }
  for (let j = -1; j < l.nz; j++)
    for (let i = -1; i < l.nx && (any[j + 1] || any[j + 2]); i++) {
      const k = (j + 1) * w + i + 1;
      const mask = pad[k]! | (pad[k + 1]! << 1) | (pad[k + w + 1]! << 2) | (pad[k + w]! << 3);
      if (mask === 0 || mask === 15) continue;
      const segs = ORIENTED[mask]!;
      for (let s = 0; s < segs.length; s++) {
        const from = edgeOf(i, j, segs[s]![0]);
        next[from] = edgeOf(i, j, segs[s]![1]);
        order.push(from);
      }
    }
  const rings: Pt[][] = [];
  const done = new Uint8Array(size);
  for (const start of order) {
    if (done[start]) continue;
    const ring: Pt[] = [];
    for (let id = start; id >= 0 && !done[id]; id = next[id]!) {
      ring.push(pointOf(id));
      done[id] = 1;
    }
    const thin = straight(ring);
    if (thin.length >= 3) rings.push(thin);
  }
  return rings;
};
