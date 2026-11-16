import type { StreetPropItem } from "../../../packages/core/src";
import { type LitWay, isLitWay } from "../../osm-import/src/props-lit.ts";

/**
 * `lit-street-dark` (G-798, ADR-0064 stage 3): a stretch of a way OSM tags `lit=yes` (a street, a
 * footway, steps; in use, not in a tunnel or under a roof: `isLitWay` of the rule) more than `REACH`
 * from every lamp of the game (`lamp-*`, the wall lanterns too). The lamps stood on the plan's
 * hand-drawn lines of 29.10 and the import read no `lit` tag, so the ways mapped or drawn into the
 * map after it stayed dark at night: 4391 m of 35 834 m. Sampled every `STEP` metres along the way, a
 * finding a sample with the length it stands for, keyed by its 10 m square.
 */

type Pt = { readonly x: number; readonly z: number };

/** How far the nearest lamp may stand from a lit way (m): a lamp lights the ground some 15 m round, two on a street 30 m apart. */
export const REACH = 30;
/** The samples' spacing along a way (m). */
export const STEP = 5;

/** The samples of the lit ways on the map (`onMap`) with no lamp within `reach`: one a `STEP` of each segment, at the middles of its pieces. */
export const litStreetDark = (ways: readonly LitWay[], props: readonly StreetPropItem[], onMap: (x: number, z: number) => boolean, reach = REACH): { at: string; what: string }[] => {
  const grid = new Map<string, Pt[]>();
  for (const i of props) {
    if (!i.prop.startsWith("lamp-")) continue;
    const k = `${Math.floor(i.x / reach)},${Math.floor(i.z / reach)}`;
    grid.set(k, [...(grid.get(k) ?? []), { x: i.x, z: i.z }]);
  }
  const lit = (x: number, z: number): boolean => {
    const [gx, gz] = [Math.floor(x / reach), Math.floor(z / reach)];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((grid.get(`${gx + i},${gz + j}`) ?? []).some((q) => Math.hypot(q.x - x, q.z - z) <= reach)) return true;
    return false;
  };
  const out: { at: string; what: string }[] = [];
  for (const w of ways) {
    if (!isLitWay(w.tags)) continue;
    for (let s = 1; s < w.pts.length; s++) {
      const [a, b] = [w.pts[s - 1]!, w.pts[s]!];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(1, Math.round(len / STEP));
      for (let k = 0; k < n; k++) {
        const x = a.x + ((b.x - a.x) * (k + 0.5)) / n;
        const z = a.z + ((b.z - a.z) * (k + 0.5)) / n;
        if (onMap(x, z) && !lit(x, z)) out.push({ at: `${x.toFixed(1)},${z.toFixed(1)}`, what: `w${w.id} ${w.tags.name ?? w.tags.highway} ${(len / n).toFixed(1)} m dark` });
      }
    }
  }
  return out;
};

/** The metres the findings stand for (from their `what`). */
export const darkMetres = (found: readonly { readonly what: string }[]): number => found.reduce((m, f) => m + Number(/ ([\d.]+) m dark$/.exec(f.what)?.[1] ?? 0), 0);
