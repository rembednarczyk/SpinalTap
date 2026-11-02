import { PATROL_CLIMB, PATROL_REACH, PATROL_SIZE, PATROL_SPEED, type PatrolLane, type PatrolPose, patrolCycle, patrolOf, patrolPose } from "../../../packages/engine/src/renderer/drones/patrol-flight";
import { POOL_SEGMENTS } from "../../../packages/engine/src/renderer/drones/patrol-models";
import { pavingAt, poolDrop, poolPoint } from "../../../packages/engine/src/renderer/drones/patrol-pool";
import { type Box2, type P2, boundsOf } from "../../../packages/engine/src/renderer/mapcity/polygon";
import type { AirMesh } from "./patrol-mesh";

/**
 * The low patrols of ADR-0058 stage 7b flown through a whole cycle of each lane the renderer plans
 * (down from the ceiling, along the lane, the hover with its sway, back, up), every few
 * centimetres of the way, and their box with a margin checked against the drawn geometry round
 * it (`patrol-mesh.ts`): `drone-low-clearance`. The canyon drones' checks of the buildings and the
 * streets fly these points too (`drone-pieces.ts`).
 */

type Finding = { readonly at: string; readonly what: string };

/** How far the box may come to anything drawn (m). */
export const CLEARANCE = 0.25;
/** Most a patrol moves between two points flown (m). */
const STEP = 0.25;

/**
 * A point of a patrol's flight: its middle, its box's foot and top (its bob at that moment), its
 * heading, its reach round the middle, its pose, and whether it comes into sight or goes out of it
 * there (`edge`: next to a moment it is away, or drawn smaller than it is).
 */
export interface PatrolPoint {
  readonly p: P2;
  readonly bottom: number;
  readonly top: number;
  readonly yaw: number;
  readonly reach: number;
  readonly pose: PatrolPose;
  readonly edge: boolean;
}

/** Every point of a lane's patrol through one cycle while it flies (not away), as the renderer poses it. */
export const patrolPoints = (lane: PatrolLane): PatrolPoint[] => {
  const patrol = patrolOf(lane);
  const cycle = patrolCycle(patrol);
  const dt = STEP / Math.max(PATROL_SPEED, PATROL_CLIMB);
  const out: PatrolPoint[] = [];
  const at = (t: number) => patrolPose(patrol, t - patrol.offset);
  for (let t = 0; t < cycle; t += dt) {
    const pose = at(t);
    if (!pose) continue;
    const edge = pose.scale < 1 || !at(t - dt) || !at(t + dt);
    out.push({ p: { x: pose.x, z: pose.z }, bottom: pose.y, top: pose.y + PATROL_SIZE.height, yaw: pose.yaw, reach: PATROL_REACH, pose, edge });
  }
  return out;
};

/**
 * Does a triangle meet the box of half sizes (hx, hy, hz) round the origin? The separating axis test
 * of Akenine-Möller: the box's axes, the triangle's normal and the nine cross products.
 */
export const triangleMeetsBox = (v: readonly [number, number, number][], h: readonly [number, number, number]): boolean => {
  const [a, b, c] = v as [[number, number, number], [number, number, number], [number, number, number]];
  const sub = (p: number[], q: number[]) => [p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!];
  const e = [sub(b, a), sub(c, b), sub(a, c)];
  const crossAxis = (k: number, f: number[]): number[] => (k === 0 ? [0, -f[2]!, f[1]!] : k === 1 ? [f[2]!, 0, -f[0]!] : [-f[1]!, f[0]!, 0]);
  const separated = (ax: number[]): boolean => {
    const pa = a[0] * ax[0]! + a[1] * ax[1]! + a[2] * ax[2]!;
    const pb = b[0] * ax[0]! + b[1] * ax[1]! + b[2] * ax[2]!;
    const pc = c[0] * ax[0]! + c[1] * ax[1]! + c[2] * ax[2]!;
    const r = h[0] * Math.abs(ax[0]!) + h[1] * Math.abs(ax[1]!) + h[2] * Math.abs(ax[2]!);
    return Math.min(pa, pb, pc) > r || Math.max(pa, pb, pc) < -r;
  };
  for (let k = 0; k < 3; k++) for (const f of e) if (separated(crossAxis(k, f))) return false;
  for (let k = 0; k < 3; k++) if (separated([k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0])) return false;
  const n = [e[0]![1]! * e[1]![2]! - e[0]![2]! * e[1]![1]!, e[0]![2]! * e[1]![0]! - e[0]![0]! * e[1]![2]!, e[0]![0]! * e[1]![1]! - e[0]![1]! * e[1]![0]!];
  return !separated(n);
};

/** The first drawn triangle a patrol's box with the margin meets at a point of its flight, or null. */
export const boxHit = (mesh: AirMesh, f: PatrolPoint, margin = CLEARANCE): string | null => {
  const hx = PATROL_SIZE.width / 2 + margin;
  const hz = PATROL_SIZE.length / 2 + margin;
  const hy = (f.top - f.bottom) / 2 + margin;
  const cy = (f.top + f.bottom) / 2;
  const r = Math.hypot(hx, hz);
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  for (const t of mesh.near({ minX: f.p.x - r, maxX: f.p.x + r, minZ: f.p.z - r, maxZ: f.p.z + r }, cy - hy, cy + hy)) {
    // Into the box's frame: its front +z towards (sin yaw, cos yaw).
    const v = [0, 1, 2].map((k): [number, number, number] => {
      const dx = t.tri[k * 3]! - f.p.x;
      const dz = t.tri[k * 3 + 2]! - f.p.z;
      return [dx * c - dz * s, t.tri[k * 3 + 1]! - cy, dx * s + dz * c];
    });
    if (triangleMeetsBox(v, [hx, hy, hz])) return t.what;
  }
  return null;
};

/** `drone-low-clearance`: one finding per lane, at the first point of its patrol whose box with the margin meets something drawn. */
export const lowClearance = (lanes: readonly PatrolLane[], mesh: AirMesh): Finding[] =>
  lanes.flatMap((lane) => {
    for (const f of patrolPoints(lane)) {
      const hit = boxHit(mesh, f);
      if (hit) return [{ at: `patrol lane from ${lane.points[0]!.x.toFixed(0)},${lane.points[0]!.z.toFixed(0)} at ${f.p.x.toFixed(1)},${f.p.z.toFixed(1)} y ${f.bottom.toFixed(1)}`, what: `box within ${CLEARANCE} m of ${hit}` }];
    }
    return [];
  });

/** The boxes round the lanes the geometry is gathered in: each lane's with the reach of its patrol and a margin. */
export const zonesOf = (lanes: readonly PatrolLane[]): Box2[] =>
  lanes.map((l) => {
    const b = boundsOf(l.points);
    const r = PATROL_REACH + 2;
    return { minX: b.minX - r, maxX: b.maxX + r, minZ: b.minZ - r, maxZ: b.maxZ + r };
  });

/** How far the searchlight pool's drawn rim may lie off the paving (m). */
export const POOL_TOLERANCE = 0.05;
/** The paving runs on even between two corners of the rim when its height halfway is within this of their mean (m). */
const EVEN = 0.02;

/**
 * Where a pool's drawn rim lies furthest off the paving under a pose: its corners and the middles
 * of the chords where the paving runs on even between their corners, as drawn (straight between
 * the corners), against the paving round them (`pavingAt`: no hairline seams); null with the light off.
 */
export const poolOff = (pose: PatrolPose, surfaceAt: (x: number, z: number) => number): { off: number; x: number; z: number } | null => {
  const drop = poolDrop(pose);
  if (drop === null) return null;
  const corner = (k: number) => {
    const a = (k / POOL_SEGMENTS) * 2 * Math.PI;
    return poolPoint(pose, drop, Math.sin(a), Math.cos(a), surfaceAt);
  };
  let worst = { off: 0, x: pose.x, z: pose.z };
  for (let k = 0; k < POOL_SEGMENTS; k++) {
    const a = corner(k);
    const b = corner(k + 1);
    // A chord's middle where the paving runs on even between its corners (flat or sloping); over a
    // kerb, a gutter or a seam between them the straight chord bridges the step, and its corners count.
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
    const even = Math.abs(pavingAt(surfaceAt, mid.x, mid.z) - (pavingAt(surfaceAt, a.x, a.z) + pavingAt(surfaceAt, b.x, b.z)) / 2) <= EVEN;
    for (const q of even ? [a, mid] : [a]) {
      const off = q.y - pavingAt(surfaceAt, q.x, q.z);
      if (Math.abs(off) > Math.abs(worst.off)) worst = { off, x: q.x, z: q.z };
    }
  }
  return worst;
};

/**
 * The low patrols' checks: `drone-low-clearance` against the drawn geometry round the lanes (the
 * scenery's, unless a test hands its own mesh), and `drone-low-pool` against the paving.
 */
export const patrolChecks = (
  lanes: () => readonly PatrolLane[],
  mesh: (zones: readonly Box2[]) => AirMesh,
  surfaceAt: (x: number, z: number) => number,
): Readonly<Record<string, () => Finding[]>> => ({
  /** A patrol's box with `CLEARANCE` round it meeting a lamp, a tree, a parasol, a sign, a balcony, a cable or a wall. */
  "drone-low-clearance": () => lowClearance(lanes(), mesh(zonesOf(lanes()))),
  /** A searchlight pool whose rim lies more than `POOL_TOLERANCE` under or over the paving (sunk into a slope, floating over it). */
  "drone-low-pool": () =>
    lanes().flatMap((lane) => {
      for (const f of patrolPoints(lane)) {
        const w = poolOff(f.pose, surfaceAt);
        if (w && Math.abs(w.off) > POOL_TOLERANCE) return [{ at: `patrol lane from ${lane.points[0]!.x.toFixed(0)},${lane.points[0]!.z.toFixed(0)} at ${w.x.toFixed(1)},${w.z.toFixed(1)}`, what: `pool's rim ${w.off.toFixed(2)} m off the paving` }];
      }
      return [];
    }),
});
