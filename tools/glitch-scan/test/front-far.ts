import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types";
import type { Frontage } from "../../osm-import/src/bare-fronts.ts";

/**
 * `front-far` (G-889, the curator's review of #595): a 0.5 m sample of a piece the import laid in
 * a pedestrian street's frontage (`front`, `bare-fronts.ts`) further than `PAST` m past its reach
 * from every frontage's axis. A frontage reaches its street's reach and the margin of a town's
 * paved place (3 m) off the axis, and a strip the reach's edge leaves before a wall or a pavement
 * joins it up to a strip's width (3 m) past that: a piece past those is the street's setts laid
 * along a strip running off it, the scrub between the path and the car park behind Karmelicka
 * 12-37 m off its axis. One finding a sample, at its centre.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** How far past a frontage's reach its pieces lie at most (m): the margin and a strip's width. */
export const PAST = 6;
/** Side of the samples (m). */
const STEP = 0.5;
/** How far past `PAST` a sample's centre is past it (m): the floats of the import's cells. */
const SLACK = 0.05;

const inRing = (p: Pt, ring: readonly Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[i]!, ring[j]!];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

/** The samples of the frontages' pieces of `chunks` past `PAST` from every axis of `fronts`, each once. */
export const frontFar = (fronts: readonly Frontage[], chunks: readonly Pick<LublinChunkData, "id" | "ground">[]): Finding[] => {
  const seen = new Set<string>();
  const out: Finding[] = [];
  const boxes = fronts.map((f) => {
    const [xs, zs] = [f.line.map((p) => p.x), f.line.map((p) => p.z)];
    const d = f.reach + PAST + 1;
    return { f, minX: Math.min(...xs) - d, maxX: Math.max(...xs) + d, minZ: Math.min(...zs) - d, maxZ: Math.max(...zs) + d };
  });
  for (const c of chunks)
    for (const g of c.ground) {
      if (!g.front) continue;
      const ring = Array.from({ length: g.outline.length >> 1 }, (_, k) => ({ x: g.outline[2 * k]!, z: g.outline[2 * k + 1]! }));
      const [xs, zs] = [ring.map((p) => p.x), ring.map((p) => p.z)];
      const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      const near = boxes.filter((b) => b.minX <= maxX && minX <= b.maxX && b.minZ <= maxZ && minZ <= b.maxZ).map((b) => b.f);
      for (let x = Math.floor(minX / STEP) * STEP + STEP / 2; x < maxX; x += STEP)
        for (let z = Math.floor(minZ / STEP) * STEP + STEP / 2; z < maxZ; z += STEP) {
          const key = `${x.toFixed(2)},${z.toFixed(2)}`;
          if (seen.has(key) || !inRing({ x, z }, ring)) continue;
          let past = Infinity;
          for (const { line, reach } of near)
            for (let k = 0; k + 1 < line.length; k++) past = Math.min(past, segmentDistance(x, z, line[k]!.x, line[k]!.z, line[k + 1]!.x, line[k + 1]!.z) - reach);
          if (past <= PAST + SLACK) continue;
          seen.add(key);
          out.push({ at: key, what: `${c.id}: ${g.surface} of a frontage ${Number.isFinite(past) ? past.toFixed(1) : "far"} m past its reach` });
        }
    }
  return out;
};
