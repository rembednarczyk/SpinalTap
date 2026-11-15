import { COVER } from "../../orto/src/classify.ts";
import { type Cover, coverAt, coverFor } from "../../orto/src/cover.ts";
import { withoutReplaced } from "../../osm-import/src/corrections-alchemia.ts";
import { addedAreas, corrected } from "../../osm-import/src/corrections.ts";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { type Pt, type Rect, ringBounds } from "../../osm-import/src/geometry.ts";
import { areaSurface } from "../../osm-import/src/ground.ts";
import type { OsmData } from "../../osm-import/src/osm.ts";
import { RingBins } from "../../osm-import/src/ring-bins.ts";

/**
 * `lawn-strip-on-paving` (G-825, the curator's review of its second round): a 0.5 m sample of the
 * orthophoto's paving or asphalt under the game's grass that no lawn of the map holds and the bare
 * ground rule did not lay, more than `KERB_WIDTH` and at most `STRIP_REACH` from a carriageway's
 * edge: a strip between a moved kerb and a lawn laid as the lawn's over the kerb and the pavement
 * behind it (Lwowska by Rondo Mohyły, Al. Tysiąclecia's north-east corner). Within `KERB_WIDTH`
 * of the edge the grass meets the asphalt on the kerb, as everywhere in the game. One finding a
 * sample. The grass, the lawns and the rule's pieces are read off the tables and the map, not off
 * the strips the import laid, so a strip laid anew shows.
 */

type Finding = { readonly at: string; readonly what: string };
type Boxed = { readonly ring: readonly Pt[]; readonly box: Rect };
/** The chunks' ground as the tables keep it. */
export interface StripChunk {
  readonly id: string;
  readonly ground: readonly { readonly surface: string; readonly outline: readonly number[] }[];
}

/** A kerb's width (m): grass up to the asphalt over it is the game's kerb, not a lawn on the pavement. */
export const KERB_WIDTH = 0.6;
/** How far from a carriageway's edge a strip to a lawn reaches (m): the kerb fill's reach of 3 m and its 0.3 m into the lawn. */
export const STRIP_REACH = 3.3;
/** How far the import's lawn may stray from the map's outline (m): `openPavings` simplifies it by 0.3 m. */
const LAWN_SIMPLIFY = 0.3;
/** The samples' step (m), the cover's. */
const STEP = 0.5;
const HARD: ReadonlySet<number> = new Set([COVER.paving, COVER.asphalt]);

const ringOf = (o: readonly number[]): Pt[] => Array.from({ length: o.length >> 1 }, (_, k) => ({ x: o[2 * k]!, z: o[2 * k + 1]! }));
const boxed = (ring: readonly Pt[]): Boxed => ({ ring, box: ringBounds(ring) });

/** The distance from p to the nearest edge of `ring`. */
const edgeDistance = (p: Pt, ring: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[j]!, ring[i]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z));
  }
  return best;
};

/**
 * The samples of hard cover under `chunks`' grass off the map's `lawns` and the bare ground rule's
 * pieces `fills` (grass laid from the cover's green), past a kerb's width from the nearest road.
 */
export const lawnStripOnPaving = (chunks: readonly StripChunk[], lawns: readonly (readonly Pt[])[], fills: readonly (readonly Pt[])[], covers: readonly Cover[]): Finding[] => {
  const mapped = lawns.filter((r) => r.length >= 3).map(boxed);
  const known = new RingBins([...mapped, ...fills.filter((r) => r.length >= 3).map(boxed)]);
  const around = (b: Rect) => (r: Boxed) => r.box.minX <= b.maxX + STRIP_REACH && r.box.maxX >= b.minX - STRIP_REACH && r.box.minZ <= b.maxZ + STRIP_REACH && r.box.maxZ >= b.minZ - STRIP_REACH;
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    const roads = c.ground.filter((g) => g.surface === "road").map((g) => boxed(ringOf(g.outline)));
    for (const g of c.ground) {
      if (g.surface !== "grass") continue;
      const grass = boxed(ringOf(g.outline));
      const [near, lawnsNear] = [roads.filter(around(grass.box)), mapped.filter(around(grass.box))];
      if (!near.length || !lawnsNear.length) continue;
      const one = new RingBins([grass]);
      // The samples on the cover's grid of 0.5 m, so two pieces sharing an edge find a sample once.
      for (let x = Math.floor(grass.box.minX / STEP) * STEP + STEP / 2; x <= grass.box.maxX; x += STEP)
        for (let z = Math.floor(grass.box.minZ / STEP) * STEP + STEP / 2; z <= grass.box.maxZ; z += STEP) {
          const key = `${x.toFixed(2)},${z.toFixed(2)}`;
          if (seen.has(key) || !one.holds(x, z) || known.holds(x, z)) continue;
          const cover = coverFor(covers, { x, z });
          if (!cover || !HARD.has(coverAt(cover, x, z))) continue;
          const d = Math.min(...near.map((r) => edgeDistance({ x, z }, r.ring)));
          if (d <= KERB_WIDTH || d > STRIP_REACH) continue;
          // A strip runs from the kerb to a lawn, the lawn's outline as the import simplifies it is the lawn's.
          const toLawn = Math.min(...lawnsNear.map((r) => edgeDistance({ x, z }, r.ring)));
          if (toLawn <= LAWN_SIMPLIFY || toLawn > STRIP_REACH) continue;
          seen.add(key);
          out.push({ at: `${x.toFixed(0)},${z.toFixed(0)}`, what: `${c.id}: grass on ${coverAt(cover, x, z) === COVER.asphalt ? "asphalt" : "paving"} ${key}, ${d.toFixed(2)} m from the kerb` });
        }
    }
  }
  return out;
};

/** The map's lawns as the import reads them: OSM's areas corrected, and those added (`generate`). */
export const mapLawns = (osm: OsmData): (readonly Pt[])[] =>
  [...withoutReplaced(extractFeatures(osm)).areas.map((a) => corrected(a)), ...addedAreas()].filter((a) => areaSurface(a.tags) === "grass").map((a) => a.ring);
