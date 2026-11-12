/**
 * `building-duplicate` (G-600): two of the game's solids standing in much the same outline, more
 * than `DUPLICATE_SHARE` of the smaller one's ground in the other, their walls and roofs fighting
 * for the same pixels (VIVO r5601275 and its garage w173070505 with `level=-2`, 1732 m²). A
 * building's parts are drawn inside its one solid, so they are not counted here.
 */
import { type Pt, type Rect, pointInRing, ringBounds, signedArea } from "../../osm-import/src/geometry.ts";

/** Over this share of the smaller solid's ground inside the other is one building drawn twice. */
export const DUPLICATE_SHARE = 0.5;
/** The sampling grid of the overlap (m). */
const STEP = 0.5;

export interface Solid {
  readonly id: string;
  readonly ring: readonly Pt[];
}

type Finding = { readonly at: string; readonly what: string };

/** The ground (m²) two outlines share, sampled on a `STEP` grid over their bounds' overlap. */
const shared = (a: readonly Pt[], b: readonly Pt[], box: Rect): { area: number; at: Pt } => {
  let n = 0;
  let [sx, sz] = [0, 0];
  for (let z = Math.floor(box.minZ / STEP) * STEP + STEP / 2; z < box.maxZ; z += STEP)
    for (let x = Math.floor(box.minX / STEP) * STEP + STEP / 2; x < box.maxX; x += STEP) {
      const p = { x, z };
      if (!pointInRing(p, a) || !pointInRing(p, b)) continue;
      n++;
      sx += x;
      sz += z;
    }
  return { area: n * STEP * STEP, at: n > 0 ? { x: sx / n, z: sz / n } : { x: 0, z: 0 } };
};

/** Pairs of solids sharing over `DUPLICATE_SHARE` of the smaller one's ground. */
export const duplicateSolids = (solids: readonly Solid[]): Finding[] => {
  const all = solids.map((s) => ({ ...s, box: ringBounds(s.ring), area: Math.abs(signedArea(s.ring)) })).sort((p, q) => p.box.minX - q.box.minX);
  const out: Finding[] = [];
  for (let i = 0; i < all.length; i++) {
    const a = all[i]!;
    for (let j = i + 1; j < all.length && all[j]!.box.minX < a.box.maxX; j++) {
      const b = all[j]!;
      const box = { minX: b.box.minX, maxX: Math.min(a.box.maxX, b.box.maxX), minZ: Math.max(a.box.minZ, b.box.minZ), maxZ: Math.min(a.box.maxZ, b.box.maxZ) };
      const smaller = Math.min(a.area, b.area);
      if (box.maxZ <= box.minZ || (box.maxX - box.minX) * (box.maxZ - box.minZ) <= smaller * DUPLICATE_SHARE) continue;
      const s = shared(a.ring, b.ring, box);
      if (s.area > smaller * DUPLICATE_SHARE) out.push({ at: `${s.at.x.toFixed(0)},${s.at.z.toFixed(0)}`, what: `${a.id} and ${b.id} share ${s.area.toFixed(0)} m² of ${smaller.toFixed(0)} m²` });
    }
  }
  return out;
};
