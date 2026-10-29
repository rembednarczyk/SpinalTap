import type { GroundPoint, Vec3 } from "@seki/core";
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

/** Every outer wall of the map's buildings, with the outlines for an inside test. */
const OUTLINES: readonly (readonly GroundPoint[])[] = MAP_CHUNKS.flatMap((c) =>
  c.buildings.map((b) => {
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

/** Is (x, z) inside a building of the map? */
export const inBuilding = (x: number, z: number): boolean => OUTLINES.some((o) => insideOutline(x, z, o));

/** The nearest wall point to (x, z), its distance and the wall's outward normal. */
export const nearestWall = (x: number, z: number): { readonly p: GroundPoint; readonly d: number; readonly nx: number; readonly nz: number } => {
  let best = { p: { x, z }, d: Infinity, nx: 0, nz: 1 };
  for (const w of WALLS) {
    const dx = w.b.x - w.a.x;
    const dz = w.b.z - w.a.z;
    const len2 = dx * dx + dz * dz;
    if (len2 < 1e-9) continue;
    const t = Math.max(0, Math.min(1, ((x - w.a.x) * dx + (z - w.a.z) * dz) / len2));
    const px = w.a.x + dx * t;
    const pz = w.a.z + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) {
      const len = Math.sqrt(len2);
      // Counter-clockwise outlines: the outward normal is (dz, -dx).
      best = { p: { x: px, z: pz }, d, nx: dz / len, nz: -dx / len };
    }
  }
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

/** A point `off` metres in front of the wall nearest to (x, z), and the yaw facing away from it. */
export const againstWall = (x: number, z: number, off = 0.5): { readonly at: Vec3; readonly yaw: number } => {
  const w = nearestWall(x, z);
  const px = Math.round((w.p.x + w.nx * off) * 100) / 100;
  const pz = Math.round((w.p.z + w.nz * off) * 100) / 100;
  return { at: { x: px, y: groundY(px, pz), z: pz }, yaw: Math.atan2(w.nx, w.nz) };
};
