import { ALCHEMIA_CENTRE, ALCHEMIA_PIECES, type AlchemiaBox } from "../../../packages/sim/src/content/alchemia";
import { isLandmark } from "../../../packages/sim/src/content/lublin";
import { MAP_CHUNKS, PADS } from "../../../packages/sim/src/content/lublin/sites";
import { ROAD_CHAINS } from "../../../packages/sim/src/content/lublin/roads";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";

/**
 * The glitch scan's checks of ADR-0074 (Alchemia by the investor's plan), stage 1.
 */

type Finding = { readonly at: string; readonly what: string };
type P3 = { readonly x: number; readonly y: number; readonly z: number };

const near = (x: number, z: number) => `${x.toFixed(0)},${z.toFixed(0)}`;

/** A row of the topography register: T-NNN. */
const ROW = /^T-\d{3}$/;

/**
 * `pad-unregistered` (review of #327): every pad levelling the map's terrain under a set piece
 * (`PADS`) names its row in `docs/topografia.md` (ADR-0042: a departure from the NMT is written
 * down). The baseline only goes down.
 */
export const padsUnregistered = (): Finding[] =>
  PADS.flatMap((p) => (p.row && ROW.test(p.row) ? [] : [{ at: near((p.rect.minX + p.rect.maxX) / 2, (p.rect.minZ + p.rect.maxZ) / 2), what: `pad at y ${p.y.toFixed(2)} without a T row` }]));

/** Where a segment from a to b first enters a box, as a fraction of it, or null (slabs). */
const segmentHitsBox = (a: P3, b: P3, q: AlchemiaBox): boolean => {
  let lo = 0;
  let hi = 1;
  for (const [p, d, min, max] of [
    [a.x, b.x - a.x, q.x0, q.x1],
    [a.y, b.y - a.y, q.y0, q.y1],
    [a.z, b.z - a.z, q.z0, q.z1],
  ] as const) {
    if (Math.abs(d) < 1e-12) {
      if (p < min || p > max) return false;
      continue;
    }
    const t0 = (min - p) / d;
    const t1 = (max - p) / d;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
    if (lo > hi) return false;
  }
  return true;
};

/** How far round Alchemia the check looks, how much of a landmark's top it may hide, the eyes' spacing along the streets. */
const RADIUS = 250;
const MOST_HIDDEN = 0.25;
const EYE_EVERY = 8;
const EYE = 1.6;

/**
 * `game-solid-landmark-occlusion` (review of #312): Alchemia's solids seen from the streets within
 * 250 m hide at most a quarter of the views of a landmark's top (the eyes on the streets from which
 * the top is behind one of its boxes, of all the eyes within 250 m of both). Baseline 0.
 */
export const alchemiaHidesLandmarks = (): Finding[] => {
  const boxes = ALCHEMIA_PIECES.filter((p) => p.solid && !p.inside).map((p) => p.box);
  const c = ALCHEMIA_CENTRE;
  const eyes: P3[] = [];
  for (const r of ROAD_CHAINS) {
    for (let i = 0; i + 1 < r.points.length; i++) {
      const [ax, az] = r.points[i]!;
      const [bx, bz] = r.points[i + 1]!;
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / EYE_EVERY));
      for (let k = 0; k < n; k++) {
        const x = ax + ((bx - ax) * k) / n;
        const z = az + ((bz - az) * k) / n;
        if (Math.hypot(x - c.x, z - c.z) <= RADIUS) eyes.push({ x, y: groundY(x, z) + EYE, z });
      }
    }
  }
  const landmarks = MAP_CHUNKS.flatMap((ch) => ch.buildings.filter((b) => isLandmark(b) && Math.hypot(b.x - c.x, b.z - c.z) <= RADIUS));
  return landmarks.flatMap((b) => {
    const top = { x: b.x, y: b.y + b.height + (b.roof ?? 0), z: b.z };
    const seen = eyes.filter((e) => Math.hypot(e.x - top.x, e.z - top.z) <= RADIUS);
    if (seen.length === 0) return [];
    const hidden = seen.filter((e) => boxes.some((q) => segmentHitsBox(e, top, q))).length;
    return hidden / seen.length > MOST_HIDDEN ? [{ at: near(b.x, b.z), what: `${b.name ?? b.id}: top hidden by Alchemia from ${hidden} of ${seen.length} street eyes` }] : [];
  });
};
