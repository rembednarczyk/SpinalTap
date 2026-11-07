import { WORLD_CHUNKS } from "../../../packages/sim/src/content/world-map";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import type { Line } from "../../osm-import/src/features.ts";
import { REPLACED_WAYS, type ReplacedWay } from "../../osm-import/src/corrections-alchemia.ts";

/**
 * `cut-on-road` (G-500, ADR-0074 stage 7): ground the game digs out of a chunk (`ChunkDef.cuts`:
 * Alchemia's food hall, its stairs, P-1's ramp trench and stair shaft; the metro's shafts are the
 * streaming's, not a chunk's) or a solid of the game's own rising out of the ground (`ChunkDef.rooms`)
 * on the axis of an OSM street or footway. ADR-0042 keeps the map's streets: a set piece may stand
 * on one only where the import drops it in the set piece's favour (`REPLACED_WAYS`, each with its
 * row in the topography register). Stage 4's ramp and stair core stood on the car park's aisle
 * w177513189, its asphalt broken off at the parapets.
 */

type Finding = { readonly at: string; readonly what: string };
type Pt = { readonly x: number; readonly z: number };

/** A footprint of the game's: a cut's rectangle or a solid's convex outline, in world metres. */
export interface Footprint {
  readonly name: string;
  readonly ring: readonly Pt[];
}

export interface CutOnRoadInput {
  readonly footprints: readonly Footprint[];
  readonly ways: readonly Line[];
  readonly replaced: readonly ReplacedWay[];
}

/** Samples along a way (m). */
const STEP = 0.25;
/** A solid rises out of the ground by more than this (m) to count: under it, it is a room in the ground. */
const OUT = 0.05;

const inRing = (p: Pt, ring: readonly Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[i]!, ring[j]!];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

/** A replaced way counts as replaced only with its register's row. */
const replacedIds = (replaced: readonly ReplacedWay[]): ReadonlySet<string> => new Set(replaced.filter((w) => /^T-\d{3}$/.test(w.ref)).map((w) => w.id));

/** One finding per footprint and way it stands on: the length of the way's axis inside it. */
export const cutOnRoad = (input: CutOnRoadInput): Finding[] => {
  const skip = replacedIds(input.replaced);
  const out: Finding[] = [];
  const boxes = input.footprints.map((f) => ({
    f,
    minX: Math.min(...f.ring.map((p) => p.x)),
    maxX: Math.max(...f.ring.map((p) => p.x)),
    minZ: Math.min(...f.ring.map((p) => p.z)),
    maxZ: Math.max(...f.ring.map((p) => p.z)),
  }));
  for (const w of input.ways) {
    if (skip.has(w.id)) continue;
    const hit = new Map<string, { length: number; at: Pt }>();
    for (let i = 0; i + 1 < w.line.length; i++) {
      const [a, b] = [w.line[i]!, w.line[i + 1]!];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.max(1, Math.ceil(len / STEP));
      for (let k = 0; k < n; k++) {
        const p = { x: a.x + ((b.x - a.x) * (k + 0.5)) / n, z: a.z + ((b.z - a.z) * (k + 0.5)) / n };
        const under = new Set(boxes.filter((q) => p.x >= q.minX && p.x <= q.maxX && p.z >= q.minZ && p.z <= q.maxZ && inRing(p, q.f.ring)).map((q) => q.f.name));
        for (const name of under) {
          const h = hit.get(name) ?? { length: 0, at: p };
          hit.set(name, { length: h.length + len / n, at: h.at });
        }
      }
    }
    for (const [name, h] of hit) out.push({ at: `${h.at.x.toFixed(0)},${h.at.z.toFixed(0)}`, what: `${name} on ${w.id} (${w.tags.highway}${w.tags.name ? ` ${w.tags.name}` : ""}) over ${h.length.toFixed(1)} m` });
  }
  return out;
};

const rect = (r: { minX: number; maxX: number; minZ: number; maxZ: number }): Pt[] => [
  { x: r.minX, z: r.minZ },
  { x: r.maxX, z: r.minZ },
  { x: r.maxX, z: r.maxZ },
  { x: r.minX, z: r.maxZ },
];

/**
 * The game's footprints: every chunk's cuts, and the prisms (or a block's box) of its own solids
 * whose top rises out of the ground at their middle. A prop's prisms share its name (the chunk and
 * the prop), so a way under several of them is one finding.
 */
export const gameFootprints = (): Footprint[] =>
  WORLD_CHUNKS.flatMap((c) => [
    ...(c.cuts ?? []).map((k, i): Footprint => ({ name: `${c.id} cut ${i}`, ring: rect(k.bounds) })),
    ...(c.rooms ?? []).flatMap((p, j): Footprint[] => {
      if (!p.solid) return [];
      const shapes = p.prisms
        ? p.prisms.map((q) => ({ ring: q.points.map((v) => ({ x: v.x + p.center.x, z: v.z + p.center.z })), top: q.top + p.center.y }))
        : p.view.kind === "block"
          ? [{ ring: rect({ minX: p.center.x - p.view.size.x / 2, maxX: p.center.x + p.view.size.x / 2, minZ: p.center.z - p.view.size.z / 2, maxZ: p.center.z + p.view.size.z / 2 }), top: p.center.y + p.view.size.y / 2 }]
          : [];
      return shapes.flatMap((s) => {
        const mid = { x: s.ring.reduce((a, v) => a + v.x, 0) / s.ring.length, z: s.ring.reduce((a, v) => a + v.z, 0) / s.ring.length };
        return s.top > groundY(mid.x, mid.z) + OUT ? [{ name: `${c.id} solid ${j}`, ring: s.ring }] : [];
      });
    }),
  ]);

/** The check in the game: its footprints against the map's streets and footways `ways`. */
export const cutOnRoadInGame = (ways: readonly Line[]): Finding[] => cutOnRoad({ footprints: gameFootprints(), ways, replaced: REPLACED_WAYS });
