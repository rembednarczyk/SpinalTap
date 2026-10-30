import type { GroundPoint, Vec3 } from "@seki/core";
import { clearedBuilding } from "../cleared-buildings";
import { MAP_CHUNKS } from "./sites";
import { groundY } from "./terrain";

/**
 * Finding places by the map's buildings (ADR-0045), for the content that stands on the streets
 * of Lublin: a point pushed clear of the walls, a point against the nearest wall facing away
 * from it. Pure functions of the map data, evaluated once when the content tables are built.
 */

interface Wall {
  readonly a: GroundPoint;
  readonly b: GroundPoint;
}

/** Every outer wall of the map's buildings that stay (not cleared for a set piece), with the outlines for an inside test. */
const OUTLINES: readonly (readonly GroundPoint[])[] = MAP_CHUNKS.flatMap((c) =>
  c.buildings.filter((b) => !clearedBuilding(b)).map((b) => {
    const pts: GroundPoint[] = [];
    for (let i = 0; i + 1 < b.outline.length; i += 2) pts.push({ x: b.outline[i]! + b.x, z: b.outline[i + 1]! + b.z });
    return pts;
  }),
);

const WALLS: readonly Wall[] = OUTLINES.flatMap((pts) => pts.map((a, i) => ({ a, b: pts[(i + 1) % pts.length] as GroundPoint })));

const insideOutline = (x: number, z: number, pts: readonly GroundPoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const pi = pts[i] as GroundPoint;
    const pj = pts[j] as GroundPoint;
    if (pi.z > z !== pj.z > z && x < ((pj.x - pi.x) * (z - pi.z)) / (pj.z - pi.z) + pi.x) inside = !inside;
  }
  return inside;
};

/** Grid cell of the indexes below (m). */
const CELL = 16;
const cellOf = (v: number): number => Math.floor(v / CELL);
const key = (cx: number, cz: number): number => cx * 100003 + cz;

/** Indexes into `list` by the grid cells their bounds touch, in ascending order per cell. */
const gridOf = (list: readonly (readonly GroundPoint[])[]): Map<number, number[]> => {
  const grid = new Map<number, number[]>();
  list.forEach((pts, i) => {
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    for (let cx = cellOf(Math.min(...xs)); cx <= cellOf(Math.max(...xs)); cx++) {
      for (let cz = cellOf(Math.min(...zs)); cz <= cellOf(Math.max(...zs)); cz++) {
        const k = key(cx, cz);
        const cell = grid.get(k);
        if (cell) cell.push(i);
        else grid.set(k, [i]);
      }
    }
  });
  return grid;
};

const OUTLINE_GRID = gridOf(OUTLINES);
const WALL_GRID = gridOf(WALLS.map((w) => [w.a, w.b]));
/** Furthest ring of cells the wall search looks in before it falls back to every wall. */
const MAX_RING = 40;

/** Is (x, z) inside a building of the map? */
export const inBuilding = (x: number, z: number): boolean => (OUTLINE_GRID.get(key(cellOf(x), cellOf(z))) ?? []).some((i) => insideOutline(x, z, OUTLINES[i] as readonly GroundPoint[]));

/** The walls whose cells lie on ring `r` (Chebyshev distance in cells) round (cx, cz). */
const ringWalls = (cx: number, cz: number, r: number, out: Set<number>): void => {
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      for (const i of WALL_GRID.get(key(cx + dx, cz + dz)) ?? []) out.add(i);
    }
  }
};

/**
 * The nearest wall point to (x, z), its distance and the wall's outward normal. With `facing`,
 * only walls whose outside faces the point count (a party wall seen from its other side does not).
 */
export const nearestWall = (x: number, z: number, facing = false): { readonly p: GroundPoint; readonly d: number; readonly nx: number; readonly nz: number } => {
  let best = { p: { x, z }, d: Infinity, nx: 0, nz: 1 };
  let bestIndex = Infinity;
  const consider = (i: number): void => {
    const w = WALLS[i] as Wall;
    if (facing && (x - w.a.x) * (w.b.z - w.a.z) - (z - w.a.z) * (w.b.x - w.a.x) < 0) return;
    const dx = w.b.x - w.a.x;
    const dz = w.b.z - w.a.z;
    const len2 = dx * dx + dz * dz;
    if (len2 < 1e-9) return;
    const t = Math.max(0, Math.min(1, ((x - w.a.x) * dx + (z - w.a.z) * dz) / len2));
    const px = w.a.x + dx * t;
    const pz = w.a.z + dz * t;
    const d = Math.hypot(x - px, z - pz);
    // The first of equally near walls in table order, as a scan of every wall finds it.
    if (d < best.d || (d === best.d && i < bestIndex)) {
      const len = Math.sqrt(len2);
      // Counter-clockwise outlines: the outward normal is (dz, -dx).
      best = { p: { x: px, z: pz }, d, nx: dz / len, nz: -dx / len };
      bestIndex = i;
    }
  };
  // Ring by ring outwards: once the nearest wall is no further than the inner edge of the next
  // ring, no wall beyond can be nearer.
  const cx = cellOf(x);
  const cz = cellOf(z);
  for (let r = 0; r <= MAX_RING; r++) {
    const walls = new Set<number>();
    ringWalls(cx, cz, r, walls);
    for (const i of [...walls].sort((a, b) => a - b)) consider(i);
    if (best.d < r * CELL) return best;
  }
  for (let i = 0; i < WALLS.length; i++) consider(i);
  return best;
};

/** A point near (x, z) at least `clearance` metres from every wall and outside the buildings, on the ground. */
export const spotNear = (x: number, z: number, clearance = 0.6): Vec3 => {
  let px = x;
  let pz = z;
  for (let round = 0; round < 8; round++) {
    const w = nearestWall(px, pz);
    const inside = inBuilding(px, pz);
    if (!inside && w.d >= clearance) break;
    // Out through the nearest wall, then the clearance beyond it.
    px = w.p.x + w.nx * (clearance + 0.05);
    pz = w.p.z + w.nz * (clearance + 0.05);
  }
  return { x: Math.round(px * 100) / 100, y: groundY(px, pz), z: Math.round(pz * 100) / 100 };
};

/**
 * A point `off` metres in front of the wall nearest to (x, z) (its outside, the side the point is
 * on; from inside a building, first out of it), and the yaw facing away from the wall.
 */
export const againstWall = (x: number, z: number, off = 0.5): { readonly at: Vec3; readonly yaw: number } => {
  const from = inBuilding(x, z) ? spotNear(x, z) : { x, z };
  const w = nearestWall(from.x, from.z, true);
  const px = Math.round((w.p.x + w.nx * off) * 100) / 100;
  const pz = Math.round((w.p.z + w.nz * off) * 100) / 100;
  return { at: { x: px, y: groundY(px, pz), z: pz }, yaw: Math.atan2(w.nx, w.nz) };
};
