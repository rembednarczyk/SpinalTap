import { type Kerbs, bothSides } from "../../osm-import/src/props-lit-sides.ts";
import type { Tags } from "../../osm-import/src/osm.ts";

/**
 * `lamp-wide-street-one-side` (G-804, T-297): a side street lit by OSM, its sidewalks tagged on both
 * sides and drawn `WIDE_SPAN` or more apart (`bothSides`), whose lamps all stand on one side.
 * Narutowicza is lit from both kerbs every 34 m (orthophoto 2025-04); the `lit` rule set its road
 * lamps on one, left of the way as OSM draws it.
 */

type Pt = { readonly x: number; readonly z: number };
type Lamp = Pt & { readonly prop: string };
type Finding = { readonly at: string; readonly what: string };

/** How far from a way its lamps stand (m): a kerb lamp's widest offset, short of a parallel street. */
export const REACH = 12;
/** How far in from a way's ends its lamps are counted (m): past the lamps of the streets crossing it. */
export const END_GAP = 10;
/** The fewest lamps on a side for a way to count as lit from it. */
export const LEAST = 2;

/** The lamps along a line within `REACH`, `END_GAP` in from its ends, on its left (props-gen's side 1) and its right. */
export const sidesAlong = (line: readonly Pt[], lamps: readonly Lamp[]): { left: number; right: number } => {
  const total = line.slice(1).reduce((s, b, i) => s + Math.hypot(b.x - line[i]!.x, b.z - line[i]!.z), 0);
  let [left, right] = [0, 0];
  for (const l of lamps) {
    let best: { d: number; s: number; side: number } | null = null;
    let run = 0;
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [line[i - 1]!, line[i]!];
      const [dx, dz] = [b.x - a.x, b.z - a.z];
      const len = Math.hypot(dx, dz);
      if (len === 0) continue;
      const t = Math.max(0, Math.min(1, ((l.x - a.x) * dx + (l.z - a.z) * dz) / (len * len)));
      const d = Math.hypot(l.x - a.x - dx * t, l.z - a.z - dz * t);
      // Left of the direction (dx, dz) is (−dz, dx), as `props-gen` sets a row's side 1.
      if (best === null || d < best.d) best = { d, s: run + t * len, side: Math.sign(-dz * (l.x - a.x) + dx * (l.z - a.z)) };
      run += len;
    }
    if (best === null || best.d > REACH || best.s < END_GAP || best.s > total - END_GAP) continue;
    if (best.side > 0) left++;
    else if (best.side < 0) right++;
  }
  return { left, right };
};

/** The lit side streets of sidewalks far apart (`ways` with their `Kerbs`) whose lamps on posts stand on one side only, `LEAST` or more of them. */
export const lampWideStreetOneSide = (ways: readonly { readonly id: number; readonly tags: Tags; readonly pts: readonly Pt[]; readonly kerbs: Kerbs }[], lamps: readonly Lamp[]): Finding[] => {
  const posts = lamps.filter((l) => l.prop.startsWith("lamp-") && l.prop !== "lamp-wall-lantern");
  return ways.flatMap((w) => {
    if (!bothSides(w.tags, w.kerbs)) return [];
    const { left, right } = sidesAlong(w.pts, posts);
    const p = w.pts[Math.floor(w.pts.length / 2)]!;
    return Math.min(left, right) === 0 && Math.max(left, right) >= LEAST ? [{ at: `${p.x.toFixed(1)},${p.z.toFixed(1)}`, what: `w${w.id} ${w.tags.name ?? w.tags.highway}: ${left} lamps left, ${right} right` }] : [];
  });
};
