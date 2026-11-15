import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types";
import { type Structure, StructureIndex } from "../../osm-import/src/structures.ts";

/**
 * `fill-on-construction` (G-866, the curator's review of G-853 r2): a 0.5 m sample of a piece the
 * import laid in a pedestrian street's frontage (`front`, `bare-fronts.ts`) inside a building
 * site of the map (`landuse=construction`, `building=construction`; `structures.ts`), out of its
 * holes: the setts and lawns of the street laid over a site whose ground the flights show as
 * a building's pit one year and crowns the next. One finding a sample, at its centre; a sample
 * within `EDGE` of the site's outline is none (a piece cut on the outline, rounded to the cm).
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** Side of the samples (m). */
const STEP = 0.5;
/** How near the site's outline a sample is on it (m). */
const EDGE = 0.05;

const edgeGap = (p: Pt, ring: readonly Pt[]): number =>
  Math.min(...ring.map((a, i) => segmentDistance(p.x, p.z, a.x, a.z, ring[(i + 1) % ring.length]!.x, ring[(i + 1) % ring.length]!.z)));

const inRing = (p: Pt, ring: readonly Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[i]!, ring[j]!];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

/** The samples of the frontages' pieces of `chunks` in a building site of `list`, each once. */
export const fillOnConstruction = (list: readonly Structure[], chunks: readonly Pick<LublinChunkData, "id" | "ground">[]): Finding[] => {
  const index = new StructureIndex(list.filter((s) => s.kind === "construction"));
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const c of chunks)
    for (const g of c.ground) {
      if (!g.front) continue;
      const ring = Array.from({ length: g.outline.length >> 1 }, (_, k) => ({ x: g.outline[2 * k]!, z: g.outline[2 * k + 1]! }));
      const [xs, zs] = [ring.map((p) => p.x), ring.map((p) => p.z)];
      for (let x = Math.floor(Math.min(...xs) / STEP) * STEP + STEP / 2; x < Math.max(...xs); x += STEP)
        for (let z = Math.floor(Math.min(...zs) / STEP) * STEP + STEP / 2; z < Math.max(...zs); z += STEP) {
          const p = { x, z };
          const key = `${x.toFixed(2)},${z.toFixed(2)}`;
          if (seen.has(key) || !inRing(p, ring)) continue;
          const s = index.at(p);
          if (!s || [s.ring, ...s.holes].some((r) => edgeGap(p, r) < EDGE)) continue;
          seen.add(key);
          out.push({ at: key, what: `${c.id}: ${g.surface} of a frontage on building site ${s.id}` });
        }
    }
  return out;
};
