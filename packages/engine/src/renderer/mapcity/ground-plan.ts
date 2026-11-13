import { type GroundSurface, SURFACE_LIFT, type TerrainGrid, type TerrainOpenSides, terrainHeightAt } from "@seki/core";
import { DRESS_FLAG, type MeshSink, type Rgba, type Vec, hexColor } from "../mesh-sink";
import { type GroundCover, cellsUnder, cutCovers } from "./ground-cut";
import { type Box2, type P2, boundsOf, obbLocal, orientedBox, pointInRing, signedArea, triangulate } from "./polygon";
import { face, quadUv, vertex } from "./sink-ops";

/**
 * Terrain and the surfaces laid on it (ADR-0044). The terrain of a chunk is one mesh sampled
 * with `terrainHeightAt` (the simulation's interpolation) on a grid of at most 5 m, with a
 * skirt along its edges so neighbouring chunks never show a crack. Surfaces are triangulated,
 * cut on a world grid of 2.5 m and draped: every vertex takes the height of the grid's plane
 * through the terrain there (`drapeY`) plus a small lift per surface (water lowest, the raised
 * sidewalk highest), so they follow the slope and overlapping pieces keep to their lifts.
 *
 * Encoding (ground shader): uv = metres in the surface's oriented box (along, across), uv2.x =
 * surface code, uv2.y = width of a long strip (road markings; 0 for none); colour a = flag
 * (0.5 wet: the asphalt catches the street lights and the reflection probe).
 */

export const SURFACE_CODE = { terrain: 0, road: 1, sidewalk: 2, square: 3, cobble: 4, footway: 5, grass: 6, rail: 7, kerb: 8 } as const;

/** Lift above the terrain per surface (m), shared with the simulation (G-130). */
export { SURFACE_LIFT };

const GRASS = hexColor("#3f5c35", DRESS_FLAG.solid);

/**
 * The paving's colour on the orthophoto (G-721, ADR-0077), from `tools/orto/src/albedo-report.ts`
 * in the current image (12.04.2025, no leaves: the ground under the trees): the hue of each surface
 * and its brightness against the square's. The square, the paths and the fountains' floors take the
 * median of the light paving over the map; the setts the median of the Old Town's hard ground (light
 * paving and asphalt classes, the curator's probe of 12.11), dark stones and all: the light paving
 * alone left them as light as Plac Litewski's granite. The sidewalks are 0.95 of the square on the
 * orthophoto (G-734), laid as light as the paths, a step below the slabs.
 * The fountains keep their dark water: the player's decision of 13.11, though the orthophoto shows
 * the shallow pools' light floor (G-129).
 */
const ORTHO_PAVING = {
  square: { rgb: [188, 186, 172], toSquare: 1 },
  cobble: { rgb: [143, 136, 127], toSquare: 0.87 },
  footway: { rgb: [181, 174, 158], toSquare: 0.92 },
  sidewalk: { rgb: [181, 177, 162], toSquare: 0.92 },
} as const;

/**
 * Square to lawn brightness (Rec. 709 luma of the colours): the map's squares 1.66 (April) and 1.80
 * (June) on the orthophoto, Plac Litewski up to 2.1. At 1.28 the squares read as concrete. Over
 * 1.7 the sunlit slabs burn out to white under the day's light (at 1.9 a fifth of the ground in
 * view at Plac Litewski, at 1.75 still a twentieth).
 */
const SQUARE_TO_GRASS = 1.7;

const luma = (c: readonly number[]): number => 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0);

/** A paving's colour, one rule for all: the orthophoto's hue at its brightness against the square, the square's against the lawn. */
const paving = (key: keyof typeof ORTHO_PAVING, flag: number): Rgba => {
  const { rgb, toSquare } = ORTHO_PAVING[key];
  const k = (toSquare * SQUARE_TO_GRASS * luma(GRASS)) / luma(rgb);
  return [rgb[0] * k, rgb[1] * k, rgb[2] * k, flag];
};

const SURFACE_COLOR: Readonly<Record<Exclude<GroundSurface, "water" | "basin" | "steps" | "crossing">, Rgba>> = {
  road: hexColor("#3a3d45", DRESS_FLAG.wet),
  rail: hexColor("#4d4842", DRESS_FLAG.solid),
  square: paving("square", DRESS_FLAG.solid),
  cobble: paving("cobble", DRESS_FLAG.solid),
  footway: paving("footway", DRESS_FLAG.solid),
  sidewalk: paving("sidewalk", DRESS_FLAG.solid),
  grass: GRASS,
};
const KERB = hexColor("#a3a39e", DRESS_FLAG.solid);
const TERRAIN = hexColor("#514c45", DRESS_FLAG.solid);
export const WATER_COLOR = hexColor("#0b1822", DRESS_FLAG.wet);

/** Longest edge of the terrain cells and of the kerbs' parts (m). */
export const DRAPE_STEP = 5;

/**
 * The height of the ground at (x, z). Where it jumps from one surface to another (a bridge's deck
 * over the terrain), `surfaceAt` gives the one under a point, carried on past its outline: `drape`
 * reads the grid's corners round a point on it, which may lie on the other surface (G-301).
 */
export type HeightAt = ((x: number, z: number) => number) & { readonly surfaceAt?: (x: number, z: number) => (x: number, z: number) => number };

/** Normal of the ground under (x, z), from central differences. */
const groundNormal = (h: HeightAt, x: number, z: number): Vec => {
  const e = 0.75;
  const dx = h(x + e, z) - h(x - e, z);
  const dz = h(x, z + e) - h(x, z - e);
  const l = Math.hypot(dx, 2 * e, dz);
  return { x: -dx / l, y: (2 * e) / l, z: -dz / l };
};

/** The chunk's terrain: vertices exactly on `terrainHeightAt`, a skirt hanging 1.5 m below the edges. */
/** How far an open edge's apron runs on towards the horizon, metres (the fog takes it from there). */
export const TERRAIN_APRON = 400;

/**
 * The terrain of a chunk: one mesh from its grid, skirts under its edges (no cracks against a
 * neighbour on another grid) and, on the `open` sides at the edge of the map data, a level apron
 * running on to the horizon, so the map does not end in a slab there.
 */
export const planTerrain = (sink: MeshSink, grid: TerrainGrid, open?: TerrainOpenSides): void => {
  const sub = Math.max(1, Math.ceil(grid.cell / DRAPE_STEP));
  const step = grid.cell / sub;
  const nx = (grid.cols - 1) * sub + 1;
  const nz = (grid.rows - 1) * sub + 1;
  if (nx < 2 || nz < 2) return;
  const h: HeightAt = (x, z) => terrainHeightAt(grid, x, z);
  const meta = [SURFACE_CODE.terrain, 0] as const;
  const idx: number[] = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = grid.originX + i * step;
      const z = grid.originZ + j * step;
      idx.push(vertex(sink, { x, y: h(x, z), z }, groundNormal(h, x, z), TERRAIN, [x, z], meta));
    }
  }
  const up = { x: 0, y: 1, z: 0 };
  for (let j = 0; j + 1 < nz; j++) {
    for (let i = 0; i + 1 < nx; i++) {
      const a = idx[j * nx + i] as number;
      const b = idx[j * nx + i + 1] as number;
      const c = idx[(j + 1) * nx + i + 1] as number;
      const d = idx[(j + 1) * nx + i] as number;
      face(sink, a, b, c, up);
      face(sink, a, c, d, up);
    }
  }
  const edge = (i0: number, j0: number, di: number, dj: number, count: number, n: Vec) => {
    for (let k = 0; k + 1 < count; k++) {
      const p = (s: number) => ({ x: grid.originX + (i0 + di * s) * step, z: grid.originZ + (j0 + dj * s) * step });
      const a = p(k);
      const b = p(k + 1);
      const ya = h(a.x, a.z);
      const yb = h(b.x, b.z);
      quadUv(sink, [{ x: a.x, y: ya, z: a.z }, { x: b.x, y: yb, z: b.z }, { x: b.x, y: yb - 1.5, z: b.z }, { x: a.x, y: ya - 1.5, z: a.z }], n, TERRAIN, [[a.x, a.z], [b.x, b.z], [b.x, b.z], [a.x, a.z]], meta);
    }
  };
  edge(0, 0, 1, 0, nx, { x: 0, y: 0, z: -1 });
  edge(0, nz - 1, 1, 0, nx, { x: 0, y: 0, z: 1 });
  edge(0, 0, 0, 1, nz, { x: -1, y: 0, z: 0 });
  edge(nx - 1, 0, 0, 1, nz, { x: 1, y: 0, z: 0 });
  if (!open) return;
  const apron = (i0: number, j0: number, di: number, dj: number, count: number, out: Vec) => {
    for (let k = 0; k + 1 < count; k++) {
      const p = (s: number) => ({ x: grid.originX + (i0 + di * s) * step, z: grid.originZ + (j0 + dj * s) * step });
      const a = p(k);
      const b = p(k + 1);
      const ya = h(a.x, a.z);
      const yb = h(b.x, b.z);
      const fa = { x: a.x + out.x * TERRAIN_APRON, y: ya, z: a.z + out.z * TERRAIN_APRON };
      const fb = { x: b.x + out.x * TERRAIN_APRON, y: yb, z: b.z + out.z * TERRAIN_APRON };
      // `face` turns each triangle towards `up`, so the corner order does not matter.
      quadUv(sink, [{ x: a.x, y: ya, z: a.z }, { x: b.x, y: yb, z: b.z }, fb, fa], up, TERRAIN, [[a.x, a.z], [b.x, b.z], [fb.x, fb.z], [fa.x, fa.z]], meta);
    }
  };
  if (open.south) apron(0, 0, 1, 0, nx, { x: 0, y: 0, z: -1 });
  if (open.north) apron(0, nz - 1, 1, 0, nx, { x: 0, y: 0, z: 1 });
  if (open.west) apron(0, 0, 0, 1, nz, { x: -1, y: 0, z: 0 });
  if (open.east) apron(nx - 1, 0, 0, 1, nz, { x: 1, y: 0, z: 0 });
};

/**
 * Side of the world grid the drapes are cut on (m), its lines on whole multiples of it: the
 * points of the terrain grids of 5 and 2.5 m (their origins on whole 5 m) lie on it.
 */
export const DRAPE_GRID = 2.5;

/**
 * The drape of `h` at (x, z): straight across the triangles of the world grid of side `grid`, each
 * cell cut corner to corner as `planTerrain` cuts its cells, between `h` at their corners. One
 * surface for every piece laid on `h`: two pieces overlapping lie at the same height wherever
 * they meet, whatever their outlines (G-301). On a terrain grid of the same cells it is the terrain drawn.
 */
export const drapeY = (h: HeightAt, x: number, z: number, grid = DRAPE_GRID): number => {
  const i = Math.floor(x / grid);
  const k = Math.floor(z / grid);
  const fx = x / grid - i;
  const fz = z / grid - k;
  const x0 = i * grid;
  const z0 = k * grid;
  const a = h(x0, z0);
  const c = h(x0 + grid, z0 + grid);
  if (fx >= fz) {
    const b = h(x0 + grid, z0);
    return a + fx * (b - a) + fz * (c - b);
  }
  const d = h(x0, z0 + grid);
  return a + fz * (d - a) + fx * (c - d);
};

/** The part of the convex polygon `poly` on the side of the line where `side` is not negative; `on` puts a cut point exactly on it. */
const clipConvex = (poly: readonly P2[], side: (p: P2) => number, on?: (p: P2) => P2): P2[] => {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as P2;
    const b = poly[(i + 1) % poly.length] as P2;
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
      const t = sa / (sa - sb);
      const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      out.push(on ? on(p) : p);
    }
  }
  return out;
};

/** Twice the area of a convex polygon. */
const area2 = (poly: readonly P2[]): number => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as P2;
    const b = poly[(i + 1) % poly.length] as P2;
    s += a.x * b.z - b.x * a.z;
  }
  return Math.abs(s);
};

/** Which cells of the drape's grid to lay, by their indices along x and z (cell i spans i·grid to (i + 1)·grid). */
export type DrapeCells = (i: number, k: number) => boolean;

/** The cells of the drape's grid meeting `box`. */
export const cellsMeeting =
  (box: Box2, grid = DRAPE_GRID): DrapeCells =>
  (i, k) =>
    (i + 1) * grid >= box.minX && i * grid <= box.maxX && (k + 1) * grid >= box.minZ && k * grid <= box.maxZ;

/** Whether `within` takes a cell of column `i` from `from` up to below `to` (m). */
const anyCell = (within: DrapeCells, i: number, from: number, to: number, grid: number): boolean => {
  for (let k = Math.floor(from / grid); k * grid < to; k++) if (within(i, k)) return true;
  return false;
};

/**
 * The triangles of `drapeTriangles`, one by one: the drape lays each as it comes, with no list of
 * thousands kept for a large square (G-444).
 */
const eachDrapeTriangle = (ring: readonly P2[], grid: number, within: DrapeCells | undefined, emit: (a: P2, b: P2, c: P2) => void): void => {
  const tris = triangulate(ring);
  const keep = (poly: readonly P2[]) => {
    if (poly.length < 3 || area2(poly) < 1e-9) return;
    for (let k = 1; k + 1 < poly.length; k++) emit(poly[0] as P2, poly[k] as P2, poly[k + 1] as P2);
  };
  for (let t = 0; t + 2 < tris.length; t += 3) {
    const tri = [ring[tris[t] as number] as P2, ring[tris[t + 1] as number] as P2, ring[tris[t + 2] as number] as P2];
    const b = boundsOf(tri);
    for (let i = Math.floor(b.minX / grid); i * grid < b.maxX; i++) {
      // A column `within` takes no cell of is not cut at all.
      if (within && !anyCell(within, i, b.minZ, b.maxZ, grid)) continue;
      const x0 = i * grid;
      const x1 = x0 + grid;
      // Wholly on the kept side of a line, a polygon clips to its own corners: not clipped (G-444).
      const west = b.minX >= x0 ? tri : clipConvex(tri, (p) => p.x - x0, (p) => ({ x: x0, z: p.z }));
      const strip = b.maxX <= x1 ? west : clipConvex(west, (p) => x1 - p.x, (p) => ({ x: x1, z: p.z }));
      if (strip.length < 3) continue;
      // A long slanting triangle's strip spans a few of its cells: the rest would be clipped to
      // nothing (G-444). A cell either side of the strip's span is still tried, for the rounding.
      const s = boundsOf(strip);
      for (let k = Math.max(Math.floor(b.minZ / grid), Math.floor(s.minZ / grid) - 1); k * grid < b.maxZ && k * grid < s.maxZ + grid; k++) {
        if (within && !within(i, k)) continue;
        const z0 = k * grid;
        const z1 = z0 + grid;
        const south = s.minZ >= z0 ? strip : clipConvex(strip, (p) => p.z - z0, (p) => ({ x: p.x, z: z0 }));
        const cell = s.maxZ <= z1 ? south : clipConvex(south, (p) => z1 - p.z, (p) => ({ x: p.x, z: z1 }));
        if (cell.length < 3) continue;
        // The cell's diagonal from (x0, z0) to (x1, z1), as `drapeY` and the terrain cut it.
        keep(clipConvex(cell, (p) => p.x - x0 - (p.z - z0)));
        keep(clipConvex(cell, (p) => p.z - z0 - (p.x - x0)));
      }
    }
  }
};

/**
 * Triangles of a ring cut on the world grid of side `grid` (`drapeY`): each lies in one triangle
 * of the grid, so drawn straight between its corners at `drapeY` it is that surface exactly. Only
 * in the cells `within` takes where it is given: the same triangles there as without it.
 */
export const drapeTriangles = (ring: readonly P2[], grid = DRAPE_GRID, within?: DrapeCells): P2[][] => {
  const out: P2[][] = [];
  eachDrapeTriangle(ring, grid, within, (a, b, c) => out.push([a, b, c]));
  return out;
};

/**
 * The height `drape` draws `ring` at over (x, z), null off it (`tris`: the ring's `triangulate`):
 * `drapeY` plus `lift`. Not `h` + `lift` at the point: the terrain bends inside the grid's
 * triangles, and the paving runs a few centimetres over it in a hollow (G-293).
 */
export const drapeHeightAt = (ring: readonly P2[], tris: readonly number[], h: HeightAt, lift: number, x: number, z: number): number | null => {
  for (let t = 0; t + 2 < tris.length; t += 3) {
    const a = ring[tris[t] as number] as P2;
    const b = ring[tris[t + 1] as number] as P2;
    const c = ring[tris[t + 2] as number] as P2;
    const det = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
    if (Math.abs(det) < 1e-12) continue;
    const u = ((x - a.x) * (c.z - a.z) - (c.x - a.x) * (z - a.z)) / det;
    const v = ((b.x - a.x) * (z - a.z) - (x - a.x) * (b.z - a.z)) / det;
    if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
    return drapeY(h.surfaceAt?.(x, z) ?? h, x, z) + lift;
  }
  return null;
};

/**
 * The height `drape` lays a point at: `drapeY` of the surface under it plus `lift`. The grid's
 * corners are shared by the vertices round them: each surface under each is read once.
 */
const drapeHeights = (h: HeightAt, lift: number): ((p: P2) => number) => {
  const read = new Map<HeightAt, HeightAt>();
  const corners = (surface: HeightAt): HeightAt => {
    let at = read.get(surface);
    if (at) return at;
    const ys = new Map<number, number>();
    at = (x, z) => {
      const key = Math.round(x / DRAPE_GRID) * 1e6 + Math.round(z / DRAPE_GRID);
      let y = ys.get(key);
      if (y === undefined) ys.set(key, (y = surface(x, z)));
      return y;
    };
    read.set(surface, at);
    return at;
  };
  return (p) => drapeY(corners(h.surfaceAt?.(p.x, p.z) ?? h), p.x, p.z) + lift;
};

/**
 * Lays `ring` on the ground at `lift` above it, at `drapeY`: shared vertices per corner of the cut
 * triangles; only in the grid's cells `within` takes where it is given.
 */
export const drape = (sink: MeshSink, ring: readonly P2[], h: HeightAt, lift: number, color: Rgba, uvOf: (p: P2) => readonly [number, number], meta: readonly [number, number], within?: DrapeCells): void => {
  const seen = new Map<number, Map<number, number>>();
  const up = { x: 0, y: 1, z: 0 };
  const y = drapeHeights(h, lift);
  const at = (p: P2): number => {
    // Hundredths of a millimetre: fine enough to keep the cut points apart on a corner of the grid.
    const kx = Math.round(p.x * 1e5);
    const kz = Math.round(p.z * 1e5);
    let row = seen.get(kx);
    if (!row) seen.set(kx, (row = new Map()));
    const known = row.get(kz);
    if (known !== undefined) return known;
    const i = vertex(sink, { x: p.x, y: y(p), z: p.z }, groundNormal(h, p.x, p.z), color, uvOf(p), meta);
    row.set(kz, i);
    return i;
  };
  eachDrapeTriangle(ring, DRAPE_GRID, within, (a, b, c) => face(sink, at(a), at(b), at(c), up));
};

/** The triangles `drape` lays `ring` as, in the cells `within` takes, without building a mesh. */
export const drapedTriangles = (ring: readonly P2[], h: HeightAt, lift: number, within?: DrapeCells): [Vec, Vec, Vec][] => {
  const y = drapeHeights(h, lift);
  const v = (p: P2): Vec => ({ x: p.x, y: y(p), z: p.z });
  const out: [Vec, Vec, Vec][] = [];
  eachDrapeTriangle(ring, DRAPE_GRID, within, (a, b, c) => out.push([v(a), v(b), v(c)]));
  return out;
};

/** Is (x, z) on a road? Used to find the sidewalk edges that get a kerb. */
export type RoadAt = (x: number, z: number) => boolean;

/** Kerb along the sidewalk edges that face a road: a stone face from the road up to the slabs and a light edge strip. */
const kerbs = (sink: MeshSink, ring: readonly P2[], h: HeightAt, roadAt: RoadAt): void => {
  const top = SURFACE_LIFT.sidewalk;
  const low = SURFACE_LIFT.road;
  const meta = [SURFACE_CODE.kerb, 0] as const;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as P2;
    const b = ring[(i + 1) % ring.length] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.3) continue;
    const nx = (b.z - a.z) / len;
    const nz = -(b.x - a.x) / len;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    if (!roadAt(mx + nx * 0.5, mz + nz * 0.5)) continue;
    const parts = Math.max(1, Math.ceil(len / DRAPE_STEP));
    for (let k = 0; k < parts; k++) {
      const p = (t: number): P2 => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      const p0 = p(k / parts);
      const p1 = p((k + 1) / parts);
      const y0 = h(p0.x, p0.z);
      const y1 = h(p1.x, p1.z);
      const n = { x: nx, y: 0, z: nz };
      quadUv(sink, [{ x: p0.x, y: y0 + low - 0.02, z: p0.z }, { x: p1.x, y: y1 + low - 0.02, z: p1.z }, { x: p1.x, y: y1 + top, z: p1.z }, { x: p0.x, y: y0 + top, z: p0.z }], n, KERB, [[0, 0], [1, 0], [1, 1], [0, 1]], meta);
      const i0 = { x: p0.x - nx * 0.22, z: p0.z - nz * 0.22 };
      const i1 = { x: p1.x - nx * 0.22, z: p1.z - nz * 0.22 };
      quadUv(sink, [{ x: p0.x, y: y0 + top + 0.004, z: p0.z }, { x: p1.x, y: y1 + top + 0.004, z: p1.z }, { x: i1.x, y: h(i1.x, i1.z) + top + 0.004, z: i1.z }, { x: i0.x, y: h(i0.x, i0.z) + top + 0.004, z: i0.z }], { x: 0, y: 1, z: 0 }, KERB, [[0, 0], [1, 0], [1, 1], [0, 1]], meta);
    }
  }
};

/**
 * A ground surface (not water) draped on the terrain, with kerbs on sidewalks along roads; less
 * the areas of `under`, the pieces laid over it, where they lie in its plane (G-320); `within`
 * as for `drape`. Given as a function, `under` is asked only for the cells the surface's
 * triangles may meet a piece in (`cellsUnder`).
 */
export const planSurface = (
  sink: MeshSink,
  surface: Exclude<GroundSurface, "water" | "basin" | "steps" | "crossing">,
  ring: readonly P2[],
  h: HeightAt,
  roadAt: RoadAt | null,
  under: readonly GroundCover[] | ((cells: DrapeCells) => readonly GroundCover[]) = [],
  within?: DrapeCells,
): void => {
  const box = orientedBox(ring);
  // Rails get their sleepers along the strip; roads get their markings from the map (ADR-0052).
  const strip = surface === "rail" && box.halfLong > box.halfShort * 4 ? box.halfShort * 2 : 0;
  const code = SURFACE_CODE[surface];
  const from = sink.indices.length;
  drape(sink, ring, h, SURFACE_LIFT[surface], SURFACE_COLOR[surface], (p) => {
    const l = obbLocal(box, p);
    return [l.u, l.v];
  }, [code, strip], within);
  cutCovers(sink, from, typeof under === "function" ? under(cellsUnder(sink, from)) : under);
  if (surface === "sidewalk" && roadAt) kerbs(sink, ring, h, roadAt);
};

/** Water (the Bystrzyca, fountain pools) draped just above the terrain: uv = world x, z. */
export const planWater = (sink: MeshSink, ring: readonly P2[], h: HeightAt, lift: number = SURFACE_LIFT.water, within?: DrapeCells): void => {
  drape(sink, ring, h, lift, WATER_COLOR, (p) => [p.x, p.z], [0, 0], within);
};

const RIM = hexColor("#8f8a82", DRESS_FLAG.solid);
/** A fountain's stone rim: its top above the square and its width, metres. */
export const BASIN_RIM = { top: 0.45, width: 0.35 } as const;

/**
 * A fountain (ADR-0044): the water stands in the basin at `SURFACE_LIFT.basin` inside a granite
 * rim, its outer face down to the square, a ledge to sit on and the inner face down to the water.
 * The water stays dark against the light square (decision of 13.11, G-721).
 */
export const planBasin = (water: MeshSink, stone: MeshSink, ring: readonly P2[], h: HeightAt): void => {
  planWater(water, ring, h, SURFACE_LIFT.basin);
  const ccwRing = signedArea(ring) >= 0 ? ring : [...ring].reverse();
  const up = { x: 0, y: 1, z: 0 };
  for (let i = 0; i < ccwRing.length; i++) {
    const a = ccwRing[i] as P2;
    const b = ccwRing[(i + 1) % ccwRing.length] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-3) continue;
    // Outward is right of the edge for a counter-clockwise ring seen from above (x east, z north).
    const out = { x: (b.z - a.z) / len, y: 0, z: -(b.x - a.x) / len };
    const inn = { x: -out.x, y: 0, z: -out.z };
    const ga = h(a.x, a.z);
    const gb = h(b.x, b.z);
    const ia = { x: a.x + inn.x * BASIN_RIM.width, z: a.z + inn.z * BASIN_RIM.width };
    const ib = { x: b.x + inn.x * BASIN_RIM.width, z: b.z + inn.z * BASIN_RIM.width };
    const top = (p: P2, g: number) => ({ x: p.x, y: g + BASIN_RIM.top, z: p.z });
    const uv = (p: P2): [number, number] => [p.x, p.z];
    quadUv(stone, [{ x: a.x, y: ga, z: a.z }, { x: b.x, y: gb, z: b.z }, top(b, gb), top(a, ga)], out, RIM, [uv(a), uv(b), uv(b), uv(a)]);
    quadUv(stone, [top(a, ga), top(b, gb), top(ib, gb), top(ia, ga)], up, RIM, [uv(a), uv(b), uv(ib), uv(ia)]);
    quadUv(stone, [top(ia, ga), top(ib, gb), { x: ib.x, y: gb + SURFACE_LIFT.basin, z: ib.z }, { x: ia.x, y: ga + SURFACE_LIFT.basin, z: ia.z }], inn, RIM, [uv(ia), uv(ib), uv(ib), uv(ia)]);
  }
};

/** True when some ring of `rings` contains (x, z): the road test for kerbs. */
export const inAnyRing = (rings: Iterable<readonly P2[]>, x: number, z: number): boolean => {
  for (const r of rings) if (pointInRing({ x, z }, r)) return true;
  return false;
};
