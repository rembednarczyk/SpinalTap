import type { MeshSink, Vec } from "../../mesh-sink";
import { cable } from "../canyon-plan";
import { type P2, centroid } from "../polygon";
import { SWATCH, onWall, solid } from "./kit";
import { type LandmarkFrame, mostFacing } from "./landmark-plan";

/**
 * Lublin 2077's cables from a landmark to its neighbouring tenements (ADR-0062, T-034): two per
 * neighbour, from the landmark's wall facing the new town to the neighbour's corner on that side,
 * sagging over the roofs between. They leave the landmark's solid, so they are planned apart
 * from it, only near.
 */

/** A cable's ends and sag. */
export interface CableRun {
  readonly a: Vec;
  readonly b: Vec;
  readonly sag: number;
}

/** How far a cable reaches, metres along the ground. */
const REACH = 14;

const dist = (p: P2, q: P2): number => Math.hypot(p.x - q.x, p.z - q.z);

/** The cables of a landmark part to the tenements of its recipe (none without them). */
export const cableRuns = (f: LandmarkFrame): CableRun[] => {
  const to = f.landmark.cableTo ?? [];
  const dir = f.landmark.recipe.layer.newTown;
  const w = to.length > 0 ? mostFacing(f, dir) : null;
  if (!w) return [];
  return to.flatMap((n) => {
    const c = centroid(n.ring);
    const fromA = dist(w.a, c) < dist(w.b, c);
    const runs: CableRun[] = [];
    for (const k of [0, 1]) {
      // From the end of the wall nearer the neighbour, a little apart and lower each.
      const a = onWall(w, fromA ? 0.8 + k * 0.9 : w.length - 0.8 - k * 0.9, Math.min(f.top - 1.5, n.top + 3) - k * 0.7, 0.05);
      let corner: P2 | null = null;
      for (const p of n.ring) if (dist(p, a) < REACH && (!corner || p.x * dir.x + p.z * dir.z > corner.x * dir.x + corner.z * dir.z)) corner = p;
      if (!corner) continue;
      runs.push({ a, b: { x: corner.x + dir.x * 0.2, y: n.top - 1.2 - k * 0.5, z: corner.z + dir.z * 0.2 }, sag: 0.35 + k * 0.15 });
    }
    return runs;
  });
};

/** The landmark part's cables, for the near cells. */
export const planLandmarkCables = (sink: MeshSink, f: LandmarkFrame): void => {
  for (const r of cableRuns(f)) cable(sink, r.a, r.b, r.sag, solid(SWATCH.metal), 0.05);
};
