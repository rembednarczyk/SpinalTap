/**
 * Flights of the map's steps off the one norm of a step (G-840, `STEP_NORM`): a riser out of
 * 0.12–0.17 m, a tread whose stride 2h + s is out of 0.60–0.66 m and too short for a landing,
 * risers of one flight of unequal height, or more than `maxRun` risers with no landing between.
 * Read from the faces the renderer draws (`stepFaces`), so it holds whatever lays them.
 */
import { STEP_NORM } from "../../../packages/core/src";
import { orientedBox } from "../../../packages/engine/src/renderer/mapcity/polygon";
import type { StepFace } from "./steps-faces";

type Pt = { readonly x: number; readonly z: number };

/** Risers of one flight this much apart in height are unequal (m). */
const EVEN = 0.01;
/** A riser within this of the band's end is the kerb up to its foot or top, not a step (m). */
const END = 0.02;

/** Each riser of a band, from its faces: where it stands along the band's long side (m) and how high it is. */
const risersAlong = (faces: readonly StepFace[], ring: readonly Pt[]): { u: number; h: number; end: boolean }[] => {
  const box = orientedBox(ring);
  const byU = new Map<number, { lo: number; hi: number }>();
  for (const f of faces) {
    if (f.up) continue;
    const ys = f.corners.map((p) => p.y);
    const u = f.corners.reduce((s, p) => s + (p.x - box.cx) * box.ux + (p.z - box.cz) * box.uz, 0) / 3;
    const key = Math.round(u * 1000);
    const r = byU.get(key) ?? { lo: Infinity, hi: -Infinity };
    byU.set(key, { lo: Math.min(r.lo, ...ys), hi: Math.max(r.hi, ...ys) });
  }
  return [...byU].sort((a, b) => a[0] - b[0]).map(([k, r]) => ({ u: k / 1000, h: r.hi - r.lo, end: Math.abs(Math.abs(k / 1000) - box.halfLong) < END }));
};

/**
 * What of the flight drawn as `faces` on the band `ring` breaks the norm, or null when it keeps it
 * (or is no flight). A flight whose steps the map counts (`counted`) runs them all with no landing.
 */
export const flightOffNorm = (faces: readonly StepFace[], ring: readonly Pt[], counted = false): string | null => {
  const risers = risersAlong(faces, ring).filter((r) => !r.end);
  if (risers.length === 0) return null;
  const hs = risers.map((r) => r.h);
  const [lo, hi] = [Math.min(...hs), Math.max(...hs)];
  if (lo < STEP_NORM.riserMin - 1e-3 || hi > STEP_NORM.riserMax + 1e-3) return `riser ${(lo < STEP_NORM.riserMin ? lo : hi).toFixed(3)} m out of ${STEP_NORM.riserMin}-${STEP_NORM.riserMax}`;
  if (hi - lo > EVEN) return `risers ${lo.toFixed(3)}-${hi.toFixed(3)} m in one flight`;
  let run = 1;
  for (let i = 0; i + 1 < risers.length; i++) {
    const s = Math.abs(risers[i + 1]!.u - risers[i]!.u);
    const h = risers[i]!.h;
    if (s >= STEP_NORM.landingMin - 1e-3) {
      run = 1;
      continue;
    }
    if (2 * h + s < STEP_NORM.strideMin - 1e-3 || 2 * h + s > STEP_NORM.strideMax + 1e-3) return `tread ${s.toFixed(2)} m on a riser ${h.toFixed(3)} m: stride ${(2 * h + s).toFixed(2)} out of ${STEP_NORM.strideMin}-${STEP_NORM.strideMax}`;
    if (++run > STEP_NORM.maxRun && !counted) return `${run} risers with no landing`;
  }
  return null;
};
