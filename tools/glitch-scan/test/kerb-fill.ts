import { pointInRingEvenOdd } from "../../../packages/core/src";
import { SpatialHash } from "../../../packages/core/src/math/spatial-hash";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { parseLength } from "../../osm-import/src/building-tags.ts";
import { addedAreas, corrected, correctedLine } from "../../osm-import/src/corrections.ts";
import { withoutReplaced } from "../../osm-import/src/corrections-alchemia.ts";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { sidewalkIndex } from "../../osm-import/src/generate.ts";
import { areaBand, fitToKerb, lineBands, roadWidth } from "../../osm-import/src/ground.ts";
import { oneway } from "../../osm-import/src/markings.ts";
import type { OsmData } from "../../osm-import/src/osm.ts";
import { geoToWorld } from "../../osm-import/src/project.ts";

/**
 * The import's kerb fills (G-522, G-570) seen from the map data alone, not from the import's own
 * marks: a "fill" is drawn sidewalk that no paving of the map explains, the bands the import lays
 * from the map's lines (its tagged sidewalks, footways, paths, steps, zebras) and areas (squares,
 * footways) with their corrections. Two checks read it:
 * - `kerb-fill-wide-estimated`: a sample of a 0.25 m grid in a fill a metre wide and more, across
 *   from the axis of the nearest carriageway, when the map gives that carriageway no width and
 *   its mapped sidewalks do not fit it either (T-046, `fitToKerb`): the
 *   asphalt the estimate left out (parking lanes, bus bays), laid as a pavement (G-570, T-247);
 * - `bus-stop-on-fill`: a bus stop of the map (`highway=bus_stop`) within 2 m of a fill
 *   `STOP_FILL` wide and more (a kerb stone is narrower): its bay laid as a pavement (Brama
 *   Krakowska 01 on Lubartowska, G-570).
 */

type Pt = { readonly x: number; readonly z: number };
type Ring = readonly Pt[];
type Box = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
type Finding = { readonly at: string; readonly what: string };
type Boxed = { readonly ring: Ring; readonly box: Box };

/** The checks' grid (m). */
export const FILL_GRID = 0.25;
/** The widest fill along a carriageway of estimated width left as a pavement (m). */
export const WIDE_FILL = 1;
/** What the outlines' rounding to 0.1 m adds to a fill's width as measured (m): a fill just under `WIDE_FILL` reads up to this much wider. */
export const ROUNDING = 0.1;
/** How near a bus stop a fill counts (m). */
export const STOP_NEAR = 2;
/** The narrowest fill by a bus stop that counts (m): the import's kerb stones are 0.3 m. */
export const STOP_FILL = 0.5;
/** How far from a carriageway's axis a fill sample looks for it (m). */
const AXIS_REACH = 10;
/** The step across a fill measuring its width (m). */
const ACROSS = 0.05;

const PAVING = new Set(["sidewalk", "footway", "square", "cobble", "steps", "crossing"]);
const CARRIAGEWAY = new Set(["motorway", "trunk", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "unclassified", "residential", "living_street", "service", "busway", "road"]);

const boxed = (ring: Ring): Boxed => ({
  ring,
  box: { minX: Math.min(...ring.map((p) => p.x)), maxX: Math.max(...ring.map((p) => p.x)), minZ: Math.min(...ring.map((p) => p.z)), maxZ: Math.max(...ring.map((p) => p.z)) },
});

const inRing = (p: Pt, ring: Ring): boolean => pointInRingEvenOdd(p.x, p.z, ring);

/** Rings by the 8 m cells their boxes reach, in core's `SpatialHash`. */
class Bins<T extends Boxed> {
  private readonly grid = new SpatialHash<T>(8);
  constructor(items: readonly T[]) {
    for (const it of items) this.grid.insert(it, it.box.minX, it.box.minZ, it.box.maxX, it.box.maxZ);
  }
  has(p: Pt): boolean {
    return this.grid.some(p.x, p.z, p.x, p.z, (b) => inRing(p, b.ring));
  }
}

export interface FillWorld {
  /** The drawn sidewalks of the map's ground (off the bridges). */
  readonly sidewalks: readonly Ring[];
  /** The paving the map's lines and areas explain. */
  readonly explained: readonly Ring[];
  /** The map's carriageways' axes, and whether the map gives each a width. */
  readonly roads: readonly { readonly line: readonly Pt[]; readonly half: number; readonly measured: boolean }[];
  /** The map's bus stops. */
  readonly stops: readonly Pt[];
}

/** A fill: drawn sidewalk at `p` that no paving of the map explains. */
const fillAt = (sidewalks: Bins<Boxed>, explained: Bins<Boxed>) => (p: Pt) => sidewalks.has(p) && !explained.has(p);

/** Every sample of the grid in a drawn sidewalk outside the explained paving. */
const fillSamples = (w: FillWorld, fill: (p: Pt) => boolean): Pt[] => {
  const out: Pt[] = [];
  const seen = new Set<string>();
  for (const ring of w.sidewalks) {
    const b = boxed(ring).box;
    for (let i = Math.floor(b.minX / FILL_GRID); i * FILL_GRID <= b.maxX; i++)
      for (let k = Math.floor(b.minZ / FILL_GRID); k * FILL_GRID <= b.maxZ; k++) {
        const p = { x: (i + 0.5) * FILL_GRID, z: (k + 0.5) * FILL_GRID };
        const key = `${i},${k}`;
        if (seen.has(key) || !inRing(p, ring)) continue;
        seen.add(key);
        if (fill(p)) out.push(p);
      }
  }
  return out;
};

/**
 * The carriageway whose edge (its axis and half its width as the import lays it) lies nearest
 * `p` outside it, within `AXIS_REACH` of its axis: the nearest point of its axis, and that road.
 */
const nearestAxis = (roads: FillWorld["roads"], p: Pt) => {
  let best: { d: number; q: Pt; measured: boolean; off: number } | null = null;
  for (const r of roads)
    for (let i = 0; i + 1 < r.line.length; i++) {
      const [a, b] = [r.line[i]!, r.line[i + 1]!];
      if (Math.min(a.x, b.x) > p.x + AXIS_REACH || Math.max(a.x, b.x) < p.x - AXIS_REACH || Math.min(a.z, b.z) > p.z + AXIS_REACH || Math.max(a.z, b.z) < p.z - AXIS_REACH) continue;
      const [dx, dz] = [b.x - a.x, b.z - a.z];
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      const q = { x: a.x + dx * t, z: a.z + dz * t };
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      const off = Math.abs(d - r.half);
      if (d <= AXIS_REACH && (!best || off < best.off)) best = { d, q, measured: r.measured, off };
    }
  return best;
};

/** How wide the fill through `p` runs across the nearest carriageway's axis (m), and that axis; null off a fill or a carriageway. */
const fillWidth = (w: FillWorld, fill: (p: Pt) => boolean, p: Pt) => {
  const axis = nearestAxis(w.roads, p);
  if (!axis || axis.d < 1e-6) return null;
  const [ux, uz] = [(p.x - axis.q.x) / axis.d, (p.z - axis.q.z) / axis.d];
  let width = ACROSS;
  for (const sign of [1, -1]) for (let t = ACROSS; t < 4 && fill({ x: p.x + ux * t * sign, z: p.z + uz * t * sign }); t += ACROSS) width += ACROSS;
  return { width, axis };
};

/** `kerb-fill-wide-estimated`: one finding per sample of a fill `WIDE_FILL` wide and more by a carriageway of estimated width. */
export const kerbFillWideEstimated = (w: FillWorld): Finding[] => {
  const fill = fillAt(new Bins(w.sidewalks.map(boxed)), new Bins(w.explained.map(boxed)));
  return fillSamples(w, fill).flatMap((p) => {
    const got = fillWidth(w, fill, p);
    if (!got || got.axis.measured) return [];
    const { width, axis } = got;
    return width >= WIDE_FILL + ROUNDING ? [{ at: `${p.x.toFixed(0)},${p.z.toFixed(0)}`, what: `fill ${width.toFixed(2)} m wide at ${p.x.toFixed(2)},${p.z.toFixed(2)}, ${axis.d.toFixed(1)} m off an axis of estimated width` }] : [];
  });
};

/** `bus-stop-on-fill`: one finding per bus stop with a fill within `STOP_NEAR`. */
export const busStopOnFill = (w: FillWorld): Finding[] => {
  const fill = fillAt(new Bins(w.sidewalks.map(boxed)), new Bins(w.explained.map(boxed)));
  return w.stops.flatMap((s) => {
    for (let x = -STOP_NEAR; x <= STOP_NEAR; x += FILL_GRID)
      for (let z = -STOP_NEAR; z <= STOP_NEAR; z += FILL_GRID)
        if (Math.hypot(x, z) <= STOP_NEAR && fill({ x: s.x + x, z: s.z + z }) && (fillWidth(w, fill, { x: s.x + x, z: s.z + z })?.width ?? 0) >= STOP_FILL) return [{ at: `${s.x.toFixed(0)},${s.z.toFixed(0)}`, what: `bus stop at ${s.x.toFixed(1)},${s.z.toFixed(1)} by a fill` }];
    return [];
  });
};

/** The city's fill world from the map data and the generated chunks. */
export const cityFillWorld = (osm: OsmData): FillWorld => {
  const f = withoutReplaced(extractFeatures(osm));
  const lines = f.lines.map((l) => correctedLine(l));
  const areas = [...f.areas.map((a) => corrected(a)), ...addedAreas()];
  const paving = (b: { surface: string } | null): boolean => b !== null && PAVING.has(b.surface);
  // The streets fitted to their mapped sidewalks (T-046) lay their tagged sidewalks from the fitted kerb, as the import does.
  const index = sidewalkIndex(lines);
  const fit = (l: (typeof lines)[number]) => (l.tags.highway ? fitToKerb(l.tags, index.kerb(l), oneway(l.tags)) : l.tags);
  const fitted = (l: (typeof lines)[number]) => fit(l) !== l.tags;
  const explained = [
    ...lines.flatMap((l) => lineBands({ ...l, tags: fit(l) }, false)).filter((b) => paving(b) && !b.carriageway),
    ...areas.map((a) => areaBand(a)).filter(paving),
  ].map((b) => b!.ring);
  const roads = lines
    .filter((l) => CARRIAGEWAY.has(l.tags.highway ?? "") && l.tags.area !== "yes" && roadWidth(l.tags) > 0)
    .map((l) => ({ line: l.line, half: roadWidth(fit(l)) / 2, measured: parseLength(l.tags.width ?? l.tags["width:carriageway"]) !== null || fitted(l) }));
  const sidewalks = MAP_CHUNKS.flatMap((c) => c.ground.filter((g) => g.surface === "sidewalk" && !g.bridge)).map((g) => {
    const ring: Pt[] = [];
    for (let i = 0; i + 1 < g.outline.length; i += 2) ring.push({ x: g.outline[i]!, z: g.outline[i + 1]! });
    return ring;
  });
  const inChunks = (p: Pt) => MAP_CHUNKS.some(({ bounds: b }) => p.x >= b.minX && p.x < b.maxX && p.z >= b.minZ && p.z < b.maxZ);
  const stops = [...osm.nodes.values()]
    .filter((n) => n.tags?.highway === "bus_stop")
    .sort((a, b) => a.id - b.id)
    .map((n) => geoToWorld(n.lat, n.lon))
    .filter(inChunks);
  return { sidewalks, explained, roads, stops };
};
