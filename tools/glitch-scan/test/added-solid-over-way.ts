import { segmentDistance } from "../../../packages/core/src";
import { SpatialHash } from "../../../packages/core/src/math/spatial-hash";
import type { AddedArea } from "../../osm-import/src/corrections.ts";
import { type Line } from "../../osm-import/src/features.ts";
import { type Pt, centroid, pointInRing } from "../../osm-import/src/geometry.ts";

/**
 * `added-solid-over-way` (G-677): a building the curator added to the map (`ADDED_AREAS` with
 * `building=*`) whose ring, the whole of it, also off the map, takes in a piece of an OSM
 * `highway=*` line with no `tunnel` or `covered`: a solid over a street or a flight that OSM maps
 * open to the sky, so a wall across the way once the map reaches it (VIVO's garage of T-261 over the
 * entrance's steps and footway, x 1121-1146, past the map's edge at x = 1120). Reads only the OSM
 * data and `ADDED_AREAS`, none of the game's tables.
 *
 * The pattern: segment-polygon intersection over a spatial index. The ways' segments go into a grid
 * of `CELL` m (core's `SpatialHash`), and a ring looks only at the segments whose boxes meet its
 * bounds, not at every way of the city. A segment is cut at its crossings with the ring's edges; a
 * piece counts when its middle lies in the ring over `EDGE_TOL` from its edges, so a way laid along
 * the ring's edge (the garage's corners stand on the footways' nodes) or touching a corner does not.
 */

type Finding = { readonly at: string; readonly what: string };

/** The grid's cell (m). */
const CELL = 16;

/** A piece of a way this close to the ring's edges (m) runs along them, not in. */
export const EDGE_TOL = 0.05;

/** The added solids over a way on purpose or until the map is widened, by id, with the entry of `docs/topografia.md` and why (G-677). */
export const SOLID_OVER_WAY_KNOWN: Readonly<Record<string, string>> = {
  "T-261/garaz-vivo": "T-261: the entrance to VIVO under the garage's roof, steps w376043570 and footway w295849313 at x 1121-1146, off the map: to settle with the map's widening",
};

const isOpen = (v: string | undefined): boolean => v === undefined || v === "no";

/** A way under the sky: `highway=*` with no tunnel and no roof over it. */
export const isOpenWay = (l: Line): boolean => l.tags.highway !== undefined && isOpen(l.tags.tunnel) && isOpen(l.tags.covered);

type Segment = { readonly way: number; readonly a: Pt; readonly b: Pt };

/** The ways' segments in core's `SpatialHash` by their boxes. */
const segmentGrid = (lines: readonly Line[]): SpatialHash<Segment> => {
  const grid = new SpatialHash<Segment>(CELL);
  lines.forEach((l, way) => {
    for (let k = 1; k < l.line.length; k++) {
      const s = { way, a: l.line[k - 1]!, b: l.line[k]! };
      grid.insert(s, Math.min(s.a.x, s.b.x), Math.min(s.a.z, s.b.z), Math.max(s.a.x, s.b.x), Math.max(s.a.z, s.b.z));
    }
  });
  return grid;
};

const distToSegment = (p: Pt, a: Pt, b: Pt): number => segmentDistance(p.x, p.z, a.x, a.z, b.x, b.z);

/** Where along a→b (0-1) it meets the ring's edges, its ends included. */
const cutsOf = (a: Pt, b: Pt, ring: readonly Pt[]): number[] => {
  const cuts = [0, 1];
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  for (let i = 0; i < ring.length; i++) {
    const [c, d] = [ring[i]!, ring[(i + 1) % ring.length]!];
    const [ex, ez] = [d.x - c.x, d.z - c.z];
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((c.x - a.x) * ez - (c.z - a.z) * ex) / den;
    const u = ((c.x - a.x) * dz - (c.z - a.z) * dx) / den;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
  }
  return cuts.sort((p, q) => p - q);
};

/** Does a piece of a→b lie inside the ring, off its edges? */
export const segmentInRing = (a: Pt, b: Pt, ring: readonly Pt[]): boolean => {
  const cuts = cutsOf(a, b, ring);
  for (let k = 1; k < cuts.length; k++) {
    const t = (cuts[k - 1]! + cuts[k]!) / 2;
    const m = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    if (!pointInRing(m, ring)) continue;
    if (ring.every((c, i) => distToSegment(m, c, ring[(i + 1) % ring.length]!) > EDGE_TOL)) return true;
  }
  return false;
};

/** The added buildings over an open way (`isOpenWay`), each with the ways it covers, as findings; those in `known` left out. */
export const addedSolidOverWay = (areas: readonly AddedArea[], lines: readonly Line[], known: Readonly<Record<string, string>> = SOLID_OVER_WAY_KNOWN): Finding[] => {
  const ways = lines.filter(isOpenWay);
  const grid = segmentGrid(ways);
  return areas.flatMap((a) => {
    if (a.tags.building === undefined || known[a.id] !== undefined) return [];
    const xs = a.ring.map((p) => p.x);
    const zs = a.ring.map((p) => p.z);
    const hit = new Set<number>();
    // A segment whose box misses the ring's has no piece in it: its middle would lie in both boxes.
    for (const s of grid.query(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs))) if (!hit.has(s.way) && segmentInRing(s.a, s.b, a.ring)) hit.add(s.way);
    if (hit.size === 0) return [];
    const c = centroid(a.ring);
    const over = [...hit].sort((p, q) => p - q).map((w) => `${ways[w]!.id} (highway=${ways[w]!.tags.highway})`);
    return [{ at: `${c.x.toFixed(1)},${c.z.toFixed(1)}`, what: `${a.id}: over ${over.join(", ")}` }];
  });
};
