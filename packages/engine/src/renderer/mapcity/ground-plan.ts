import { type GroundSurface, type TerrainGrid, type TerrainOpenSides, terrainHeightAt } from "@seki/core";
import { DRESS_FLAG, type MeshSink, type Rgba, type Vec, hexColor } from "../mesh-sink";
import { type P2, obbLocal, orientedBox, pointInRing, signedArea, triangulate } from "./polygon";
import { face, quadUv, vertex } from "./sink-ops";

/**
 * Terrain and the surfaces laid on it (ADR-0044). The terrain of a chunk is one mesh sampled
 * with `terrainHeightAt` (the simulation's interpolation) on a grid of at most 5 m, with a
 * skirt along its edges so neighbouring chunks never show a crack. Surfaces are triangulated,
 * subdivided to the same 5 m and draped: every vertex takes the terrain height plus a small lift
 * per surface (water lowest, the raised sidewalk highest), so they follow the slope.
 *
 * Encoding (ground shader): uv = metres in the surface's oriented box (along, across), uv2.x =
 * surface code, uv2.y = width of a long strip (road markings; 0 for none); colour a = flag
 * (0.5 wet: the asphalt catches the street lights and the reflection probe).
 */

export const SURFACE_CODE = { terrain: 0, road: 1, sidewalk: 2, square: 3, cobble: 4, footway: 5, grass: 6, rail: 7, kerb: 8 } as const;

/** Lift above the terrain per surface (m): order of drawing where they overlap. */
export const SURFACE_LIFT: Readonly<Record<GroundSurface, number>> = {
  water: 0.03,
  grass: 0.04,
  road: 0.06,
  rail: 0.07,
  square: 0.08,
  cobble: 0.08,
  footway: 0.09,
  steps: 0.05,
  crossing: 0.085,
  sidewalk: 0.16,
  basin: 0.32,
};

const SURFACE_COLOR: Readonly<Record<Exclude<GroundSurface, "water" | "basin" | "steps" | "crossing">, Rgba>> = {
  road: hexColor("#3a3d45", DRESS_FLAG.wet),
  rail: hexColor("#4d4842", DRESS_FLAG.solid),
  square: hexColor("#6d6a66", DRESS_FLAG.solid),
  cobble: hexColor("#5d5752", DRESS_FLAG.solid),
  footway: hexColor("#6e685f", DRESS_FLAG.solid),
  sidewalk: hexColor("#6a6d73", DRESS_FLAG.solid),
  grass: hexColor("#3f5c35", DRESS_FLAG.solid),
};
const KERB = hexColor("#a3a39e", DRESS_FLAG.solid);
const TERRAIN = hexColor("#514c45", DRESS_FLAG.solid);
export const WATER_COLOR = hexColor("#0b1822", DRESS_FLAG.wet);

/** Longest edge of the draped triangles and of the terrain cells (m). */
export const DRAPE_STEP = 5;

export type HeightAt = (x: number, z: number) => number;

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

/** Triangles of a ring, each cut into an n x n barycentric grid so no edge is longer than `step`. */
export const drapeTriangles = (ring: readonly P2[], step = DRAPE_STEP): P2[][] => {
  const tris = triangulate(ring);
  const out: P2[][] = [];
  for (let t = 0; t + 2 < tris.length; t += 3) {
    const a = ring[tris[t] as number] as P2;
    const b = ring[tris[t + 1] as number] as P2;
    const c = ring[tris[t + 2] as number] as P2;
    const longest = Math.max(Math.hypot(b.x - a.x, b.z - a.z), Math.hypot(c.x - b.x, c.z - b.z), Math.hypot(a.x - c.x, a.z - c.z));
    const n = Math.min(Math.max(1, Math.ceil(longest / step)), 48);
    const p = (i: number, j: number): P2 => ({ x: a.x + ((b.x - a.x) * i + (c.x - a.x) * j) / n, z: a.z + ((b.z - a.z) * i + (c.z - a.z) * j) / n });
    for (let j = 0; j < n; j++) {
      for (let i = 0; i + j < n; i++) {
        out.push([p(i, j), p(i + 1, j), p(i, j + 1)]);
        if (i + j + 1 < n) out.push([p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)]);
      }
    }
  }
  return out;
};

/** Lays `ring` on the ground at `lift` above it: shared vertices per sub-triangle grid point. */
export const drape = (sink: MeshSink, ring: readonly P2[], h: HeightAt, lift: number, color: Rgba, uvOf: (p: P2) => readonly [number, number], meta: readonly [number, number]): void => {
  const seen = new Map<string, number>();
  const up = { x: 0, y: 1, z: 0 };
  const at = (p: P2): number => {
    const key = `${p.x.toFixed(3)}:${p.z.toFixed(3)}`;
    const known = seen.get(key);
    if (known !== undefined) return known;
    const i = vertex(sink, { x: p.x, y: h(p.x, p.z) + lift, z: p.z }, groundNormal(h, p.x, p.z), color, uvOf(p), meta);
    seen.set(key, i);
    return i;
  };
  for (const [a, b, c] of drapeTriangles(ring)) face(sink, at(a as P2), at(b as P2), at(c as P2), up);
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

/** A ground surface (not water) draped on the terrain, with kerbs on sidewalks along roads. */
export const planSurface = (sink: MeshSink, surface: Exclude<GroundSurface, "water" | "basin" | "steps" | "crossing">, ring: readonly P2[], h: HeightAt, roadAt: RoadAt | null): void => {
  const box = orientedBox(ring);
  const strip = (surface === "road" || surface === "rail") && box.halfLong > box.halfShort * 4 ? box.halfShort * 2 : 0;
  const code = SURFACE_CODE[surface];
  drape(sink, ring, h, SURFACE_LIFT[surface], SURFACE_COLOR[surface], (p) => {
    const l = obbLocal(box, p);
    return [l.u, l.v];
  }, [code, strip]);
  if (surface === "sidewalk" && roadAt) kerbs(sink, ring, h, roadAt);
};

/** Water (the Bystrzyca, fountain pools) draped just above the terrain: uv = world x, z. */
export const planWater = (sink: MeshSink, ring: readonly P2[], h: HeightAt, lift: number = SURFACE_LIFT.water): void => {
  drape(sink, ring, h, lift, WATER_COLOR, (p) => [p.x, p.z], [0, 0]);
};

const RIM = hexColor("#8f8a82", DRESS_FLAG.solid);
/** A fountain's stone rim: its top above the square and its width, metres. */
export const BASIN_RIM = { top: 0.45, width: 0.35 } as const;

/**
 * A fountain (ADR-0044): the water stands in the basin at `SURFACE_LIFT.basin` inside a granite
 * rim, its outer face down to the square, a ledge to sit on and the inner face down to the water.
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
