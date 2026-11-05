import { SURFACE_LIFT, type Vec3, type ViewDescriptor } from "../../../packages/core/src";
import { worldRing } from "../../../packages/engine/src/renderer/drones/drone-world";
import type { PatrolLane } from "../../../packages/engine/src/renderer/drones/patrol-flight";
import { POOL_SEGMENTS } from "../../../packages/engine/src/renderer/drones/patrol-models";
import { POOL_LIFT, poolDrop, poolPoint, poolRadius } from "../../../packages/engine/src/renderer/drones/patrol-pool";
import { drapeTriangles } from "../../../packages/engine/src/renderer/mapcity/ground-plan";
import { BinIndex } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { type P2, boundsOf } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { patrolPoints } from "./patrol-pieces";

/**
 * The searchlight pool of the low patrols (ADR-0058 stage 7b) against the paving as the renderer
 * draws it (G-293): every ground surface of the scenery cut by `drapeTriangles` into the triangles
 * `drape` lays, straight between their corners at the ground's height and the surface's lift. The
 * terrain bends between those corners, so in a hollow the drawn paving runs over the height the
 * simulation reads there (`surfaceY`), and a pool laid on that height sinks into it.
 */

type Finding = { readonly at: string; readonly what: string };
type Item = { readonly view: ViewDescriptor; readonly at: Vec3 };
type Tri = readonly [Vec3, Vec3, Vec3];

/**
 * How far under the paving and `POOL_LIFT` over it a point of the pool may lie (m): half the lift. A
 * pool's straight triangle over paving bending under it may come a few millimetres nearer; one
 * nearer than half the lift loses the depth test to the paving far off, one under it goes dark.
 */
export const POOL_SINK = POOL_LIFT / 2;
/** The cells of the pool's way it is checked once in (m), as `drone-low-pool` does. */
const POOL_STEP = 1;
/** Points along each side of a triangle of the pool checked against the paving. */
const SAMPLES = 3;
/** The paving runs on even under a triangle of the pool when it lies within this of the plane through the paving under its corners (m). */
const EVEN = 0.005;

/** The cells the drawn triangles of a piece of paving are sorted into for point queries (m). */
const CELL = 2;
const cellOf = (x: number, z: number): string => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;

/** The top of the paving drawn at (x, z) by the ground surfaces of `items`, null where none is drawn. */
export const drawnPaving = (items: readonly Item[], groundAt: (x: number, z: number) => number): ((x: number, z: number) => number | null) => {
  const pieces: { ring: P2[]; lift: number; cells: Map<string, Tri[]> | null }[] = [];
  const index = new BinIndex();
  for (const { view, at } of items) {
    if (view.kind !== "ground") continue;
    const ring = worldRing(view.outline, at);
    if (ring.length >= 3) index.add(pieces.push({ ring, lift: SURFACE_LIFT[view.surface], cells: null }) - 1, boundsOf(ring));
  }
  // A piece's triangles as `drape` lays them, by the cells their boxes touch.
  const lay = (p: (typeof pieces)[number]): Map<string, Tri[]> => {
    if (p.cells) return p.cells;
    const cells = new Map<string, Tri[]>();
    for (const t of drapeTriangles(p.ring)) {
      const tri = t.map((q) => ({ x: q.x, y: groundAt(q.x, q.z) + p.lift, z: q.z })) as unknown as Tri;
      const b = boundsOf(t);
      for (let i = Math.floor(b.minX / CELL); i <= Math.floor(b.maxX / CELL); i++) {
        for (let k = Math.floor(b.minZ / CELL); k <= Math.floor(b.maxZ / CELL); k++) {
          const list = cells.get(`${i},${k}`);
          if (list) list.push(tri);
          else cells.set(`${i},${k}`, [tri]);
        }
      }
    }
    return (p.cells = cells);
  };
  return (x, z) => {
    let top: number | null = null;
    const key = cellOf(x, z);
    for (const i of index.at(x, z)) {
      for (const [a, b, c] of lay(pieces[i]!).get(key) ?? []) {
        const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (Math.abs(d) < 1e-12) continue;
        const wa = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
        const wb = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
        if (wa < -1e-9 || wb < -1e-9 || wa + wb > 1 + 1e-9) continue;
        const y = wa * a.y + wb * b.y + (1 - wa - wb) * c.y;
        top = top === null ? y : Math.max(top, y);
      }
    }
    return top;
  };
};

/** The pool's triangles as the template draws them (`withBeam`): a fan to the ring halfway out, then a band to the rim, on the unit disc. */
const POOL_TRIANGLES: readonly (readonly [P2, P2, P2])[] = (() => {
  const rim = (k: number, r: number): P2 => ({ x: Math.sin((k / POOL_SEGMENTS) * 2 * Math.PI) * r, z: Math.cos((k / POOL_SEGMENTS) * 2 * Math.PI) * r });
  return Array.from({ length: POOL_SEGMENTS }, (_, k) => [
    [{ x: 0, z: 0 }, rim(k, 0.5), rim(k + 1, 0.5)] as const,
    [rim(k, 0.5), rim(k, 1), rim(k + 1, 1)] as const,
    [rim(k, 0.5), rim(k + 1, 1), rim(k + 1, 0.5)] as const,
  ]).flat();
})();

/**
 * Where the pool laid by `lay` (the paving height the views lay it on) under a pose lies deepest
 * under the paving drawn there and `POOL_LIFT` over it: its triangles straight between their corners,
 * read on a grid of `SAMPLES` per side, those over even paving (`EVEN`) unless `everywhere`; null
 * with the light off.
 */
export const poolSink = (
  pose: Parameters<typeof poolDrop>[0],
  lay: (x: number, z: number) => number,
  drawn: (x: number, z: number) => number | null,
  everywhere = false,
): { sink: number; x: number; z: number } | null => {
  const drop = poolDrop(pose);
  if (drop === null) return null;
  const laid = new Map<string, Vec3>();
  const corner = (q: P2): Vec3 => {
    const key = `${q.x.toFixed(6)},${q.z.toFixed(6)}`;
    let v = laid.get(key);
    if (!v) laid.set(key, (v = poolPoint(pose, drop, q.x, q.z, lay)));
    return v;
  };
  let worst = { sink: 0, x: pose.x, z: pose.z };
  for (const t of POOL_TRIANGLES) {
    const [a, b, c] = t.map(corner) as [Vec3, Vec3, Vec3];
    const under = [a, b, c].map((q) => drawn(q.x, q.z));
    if (under.some((y) => y === null)) continue;
    const [ya, yb, yc] = under as [number, number, number];
    const samples: { x: number; y: number; z: number; paving: number }[] = [];
    let even = true;
    for (let i = 0; i <= SAMPLES && even; i++) {
      for (let j = 0; i + j <= SAMPLES; j++) {
        const [u, v, w] = [i / SAMPLES, j / SAMPLES, (SAMPLES - i - j) / SAMPLES];
        const p = { x: a.x * u + b.x * v + c.x * w, z: a.z * u + b.z * v + c.z * w };
        const paving = drawn(p.x, p.z);
        // Over a kerb, a seam or a step between two pieces of paving the straight triangle bridges it:
        // only a triangle over paving running on even between its corners (flat, sloping or bent) counts.
        if (paving === null || (!everywhere && Math.abs(paving - (ya * u + yb * v + yc * w)) > EVEN)) {
          even = false;
          break;
        }
        samples.push({ ...p, y: a.y * u + b.y * v + c.y * w, paving });
      }
    }
    if (!even) continue;
    for (const p of samples) {
      const sink = p.paving + POOL_LIFT - p.y;
      if (sink > worst.sink) worst = { sink, x: p.x, z: p.z };
    }
  }
  return worst;
};

/**
 * `drone-low-pool-sunk`: a low patrol's pool sinking more than `POOL_SINK` under the drawn paving and
 * its lift somewhere along the lane, there dark (G-293). One per lane, its first such place.
 */
export const poolSunk = (lanes: readonly PatrolLane[], lay: (x: number, z: number) => number, drawn: (x: number, z: number) => number | null): Finding[] =>
  lanes.flatMap((lane) => {
    const seen = new Set<string>();
    for (const f of patrolPoints(lane)) {
      const drop = poolDrop(f.pose);
      if (drop === null) continue;
      const key = `${Math.round(f.pose.x / POOL_STEP)},${Math.round(f.pose.z / POOL_STEP)},${Math.round(poolRadius(drop) * 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const w = poolSink(f.pose, lay, drawn);
      if (w && w.sink > POOL_SINK) return [{ at: `patrol lane from ${lane.points[0]!.x.toFixed(0)},${lane.points[0]!.z.toFixed(0)} at ${w.x.toFixed(1)},${w.z.toFixed(1)}`, what: `pool ${(w.sink * 100).toFixed(1)} cm under the paving` }];
    }
    return [];
  });
