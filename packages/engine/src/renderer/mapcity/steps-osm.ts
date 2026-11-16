import { LUBLIN_CHUNKS } from "@seki/sim/lublin";
import { type P2, orientedBox } from "./polygon";

/** A run of a steps way the map counts the steps of (`step_count`, G-840). */
interface CountedRun {
  readonly a: P2;
  readonly b: P2;
  readonly steps: number;
}

/** How far a band's middle may lie off its run's axis (m): the castle stairs are 10 m wide, cut into strips (T-113). */
const OFF = 8;
/** A band's long side turned no further than this from its run (cosine) runs along it. */
const ALONG = 0.95;

let runs: readonly CountedRun[] | null = null;
/** The counted runs of the city, each once (a run reaches into several chunks). */
const countedRuns = (): readonly CountedRun[] => {
  if (runs) return runs;
  const byId = new Map<string, CountedRun>();
  for (const c of LUBLIN_CHUNKS) {
    for (const s of c.stepRuns ?? []) byId.set(s.id, { a: { x: s.run[0]!, z: s.run[1]! }, b: { x: s.run[2]!, z: s.run[3]! }, steps: s.steps });
  }
  return (runs = [...byId.values()]);
};

/**
 * How many steps the map counts on a band of steps (world ring, G-840): its run's share of the
 * way's `step_count`, by the band's length along it (a piece a chunk's edge cut off has its part;
 * the strips a wide flight is cut into along it have all). Undefined where the map counts none.
 */
export const osmStepCount = (ring: readonly P2[]): number | undefined => {
  if (ring.length < 3) return undefined;
  const box = orientedBox(ring);
  let best: { run: CountedRun; off: number; len: number } | null = null;
  for (const run of countedRuns()) {
    const len = Math.hypot(run.b.x - run.a.x, run.b.z - run.a.z);
    if (len < 1e-6) continue;
    const [ux, uz] = [(run.b.x - run.a.x) / len, (run.b.z - run.a.z) / len];
    if (Math.abs(ux * box.ux + uz * box.uz) < ALONG) continue;
    const s = (box.cx - run.a.x) * ux + (box.cz - run.a.z) * uz;
    const off = Math.abs((box.cz - run.a.z) * ux - (box.cx - run.a.x) * uz);
    if (s < -0.5 || s > len + 0.5 || off > OFF || (best && off >= best.off)) continue;
    best = { run, off, len };
  }
  if (!best) return undefined;
  return Math.max(1, Math.round((best.run.steps * Math.min(best.len, box.halfLong * 2)) / best.len));
};
