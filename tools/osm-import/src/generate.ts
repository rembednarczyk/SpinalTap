/**
 * The generator proper: map data and terrain in, chunks out. Pure and deterministic: the same
 * input gives the same chunks, byte for byte, whatever order the files were read in.
 */
import { LUBLIN_ANCHOR } from "../../../packages/core/src/world/city-geo.ts";
import { asBuilding, isPart, orphanParts, partsByBuilding } from "./building-parts.ts";
import { smallAlone } from "./building-alone.ts";
import { makeBuilding } from "./buildings.ts";
import { corrected } from "./corrections.ts";
import { ALL_CHUNKS, type ChunkSpec } from "./config.ts";
import { type HeightSource } from "./dtm.ts";
import { type Area, type Line, extractFeatures } from "./features.ts";
import { type Band, areaBand, chunkGround, crossingBand, crossingWay, cutSidewalk, fitToKerb, lineBands, markedCrossing, roadWidth } from "./ground.ts";
import { geoToWorld } from "./project.ts";
import { type Marking, chunkMarkings, cutLine, oneway, roadMarkings, stopLines } from "./markings.ts";
import { type Pt, type Rect, centroid, inRect, pointInRing, rectsOverlap, ringBounds } from "./geometry.ts";
import { busStopPosts, chunkBusStops, chunkCarParks } from "./kerbside.ts";
import { allPois, chunkFootWays, chunkPois, chunkServiceWays, chunkStreets } from "./labels.ts";
import { type PassageOut, buildingPassages, streetLevelTunnels } from "./passages.ts";
import { type ChunkOut } from "./model.ts";
import { type OsmData } from "./osm.ts";
import { chunkTerrain, sampleField } from "./terrain.ts";
import { type WorldVenue, allVenues, assignVenues, venueOut } from "./venues.ts";

export interface ChunkStats {
  readonly id: string;
  readonly buildings: number;
  readonly fromHeight: number;
  readonly fromLevels: number;
  readonly skipped: number;
  readonly withHoles: number;
  readonly ground: number;
  readonly cell: number;
  readonly terrainError: { readonly max: number; readonly p99: number };
  readonly minY: number;
  readonly maxY: number;
  /** Venues signed on the chunk's buildings (ADR-0064 stage 4). */
  readonly venues: number;
}

/** What became of the map's venues (ADR-0064 stage 4): the importer's control numbers. */
export interface VenueStats {
  readonly total: number;
  /** On a building of a chunk. */
  readonly signed: number;
  /** With a 2077 name from the table; the rest are generic by kind. */
  readonly named: number;
  readonly colourOsm: number;
  readonly colourTable: number;
  readonly colourKind: number;
}

export interface Generated {
  readonly chunks: readonly ChunkOut[];
  readonly stats: readonly ChunkStats[];
  readonly venues: VenueStats;
}

const SKIP_BUILDING = new Set(["no", "construction", "roof", "ruins", "demolished", "proposed"]);

const buildingAreas = (areas: readonly Area[], data: OsmData): Area[] => {
  const inRelation = new Set<string>();
  for (const r of data.relations.values()) {
    if (r.tags?.building === undefined) continue;
    for (const m of r.members) if (m.type === "way" && m.role !== "inner") inRelation.add(`w${m.ref}`);
  }
  // A building under ground (a cellar, a shelter, G-077) has nothing over the street above it.
  return areas.filter((a) => a.tags.building !== undefined && !SKIP_BUILDING.has(a.tags.building) && a.tags.location !== "underground" && !inRelation.has(a.id));
};

type SidewalkPoint = Pt & { readonly tx: number; readonly tz: number };

/** Samples along a line every `step` metres, with the line's direction there. */
const samplesAlong = (line: readonly Pt[], step: number): (Pt & { tx: number; tz: number })[] => {
  const out: (Pt & { tx: number; tz: number })[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n, tx: (b.x - a.x) / (len || 1), tz: (b.z - a.z) / (len || 1) });
  }
  return out;
};

/**
 * How far short of a mapped sidewalk's axis a fitted carriageway ends, metres: its middle stays off
 * the asphalt where it wiggles a little nearer than the median. Not at the sidewalk's inner edge
 * (2 x (axis - half the sidewalk)): the asphalt under the sidewalk's inner half is what keeps the
 * two-way lanes (1.2 m and more off the axis, ADR-0055) and their cars on the road.
 */
const KERB_MARGIN = 0.5;
/** A street side's mapped sidewalk counts as running along it over this many samples (2 m apart) and more. */
const MIN_KERB_SAMPLES = 5;

/** A coarse spatial hash of points along mapped sidewalks (`footway=sidewalk`), with their direction. */
const sidewalkIndex = (lines: readonly Line[]) => {
  const cell = 10;
  const grid = new Map<string, SidewalkPoint[]>();
  const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  for (const l of lines) {
    if (l.tags.footway !== "sidewalk") continue;
    const pts = samplesAlong(l.line, 3);
    const end = pts[pts.length - 1];
    if (end) pts.push({ ...l.line[l.line.length - 1]!, tx: end.tx, tz: end.tz });
    for (const p of pts) {
      const list = grid.get(key(p.x, p.z)) ?? [];
      list.push(p);
      grid.set(key(p.x, p.z), list);
    }
  }
  const around = (p: Pt): SidewalkPoint[] => {
    const out: SidewalkPoint[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) out.push(...(grid.get(`${Math.floor(p.x / cell) + dx},${Math.floor(p.z / cell) + dz}`) ?? []));
    return out;
  };
  return {
    /** True when separate sidewalks run along at least a third of the road. */
    along: (road: Line): boolean => {
      const reach = roadWidth(road.tags) / 2 + 7;
      const samples = samplesAlong(road.line, 8);
      const near = samples.filter((p) => around(p).some((q) => Math.hypot(q.x - p.x, q.z - p.z) <= reach)).length;
      return samples.length > 0 && near / samples.length >= 1 / 3;
    },
    /**
     * How far from the road's axis its carriageway may reach, `KERB_MARGIN` short of its mapped
     * sidewalks where they run along it (parallel, beside it) with their axis on its carriageway
     * by type: the median on each side, the nearer side's. Only a side whose sidewalk runs along
     * half the road and more counts (`MIN_KERB_SAMPLES` at least): a sidewalk turning in to a
     * crossing at a junction says nothing of the rest of the street (T-062). Null without one.
     */
    kerb: (road: Line): number | null => {
      const reach = roadWidth(road.tags) / 2;
      const sides: [number[], number[]] = [[], []];
      const samples = samplesAlong(road.line, 2);
      for (const p of samples) {
        const best = [Infinity, Infinity];
        for (const q of around(p)) {
          const along = (q.x - p.x) * p.tx + (q.z - p.z) * p.tz;
          const across = (q.z - p.z) * p.tx - (q.x - p.x) * p.tz;
          if (Math.abs(along) > 2 || Math.abs(across) >= reach || Math.abs(q.tx * p.tx + q.tz * p.tz) < 0.9) continue;
          const side = across >= 0 ? 0 : 1;
          best[side] = Math.min(best[side]!, Math.abs(across) - KERB_MARGIN);
        }
        best.forEach((b, side) => {
          if (Number.isFinite(b)) sides[side]!.push(b);
        });
      }
      const medians = sides.filter((s) => s.length >= MIN_KERB_SAMPLES && s.length * 2 >= samples.length).map((s) => [...s].sort((a, b) => a - b)[Math.floor(s.length / 2)]!);
      return medians.length > 0 ? Math.min(...medians) : null;
    },
  };
};

/**
 * Points that make a plain building round them public (G-097). An office of government is left
 * out: it is as often a bureau rented in a tenement as an office building of its own.
 */
const CIVIC_POINTS = new Set(["amenity=townhall", "amenity=courthouse", "amenity=library", "amenity=theatre", "amenity=arts_centre"]);

const grow = (r: Rect, m: number): Rect => ({ minX: r.minX - m, minZ: r.minZ - m, maxX: r.maxX + m, maxZ: r.maxZ + m });

const generateChunk = (
  spec: ChunkSpec,
  src: HeightSource,
  buildings: readonly Area[],
  bands: readonly (Band & { box: Rect })[],
  lines: readonly Line[],
  pois: ReturnType<typeof allPois>,
  markings: readonly Marking[],
  passages: readonly PassageOut[],
  parts: ReadonlyMap<string, readonly Area[]>,
  alone: ReadonlySet<string>,
  venues: ReadonlyMap<string, readonly WorldVenue[]>,
  kerb: { readonly carParks: readonly Area[]; readonly busStops: readonly Pt[] },
) => {
  const altitude = LUBLIN_ANCHOR.altitude;
  const t = chunkTerrain(sampleField(src, spec.rect, 12), spec.rect, altitude);
  const shopPoints = pois.filter((p) => p.kind === "shop" || p.kind === "food" || p.kind === "bar" || p.kind === "service").map((p) => p.at);
  const namedPoints = pois
    .filter((p) => p.kind === "hotel" || p.kind === "sight" || p.kind === "culture" || p.kind === "church")
    .map((p) => ({ at: p.at, name: p.kind === "hotel" && !/hotel/i.test(p.name) ? `Hotel ${p.name}` : p.name, ...(p.addr ? { addr: p.addr } : {}) }));
  const civicPoints = pois.flatMap((p) => (CIVIC_POINTS.has(p.tag) ? [{ at: p.at, name: p.name, amenity: p.tag.replace("amenity=", ""), ...(p.addr ? { addr: p.addr } : {}) }] : []));
  const out = [];
  let skipped = 0;
  let withHoles = 0;
  for (const a of buildings) {
    if (!inRect(centroid(a.ring), spec.rect)) continue;
    const r = makeBuilding(a, { src, grid: t.grid, altitude, range: spec.district.defaultLevels, shopPoints, namedPoints, civicPoints, alone }, parts.get(a.id));
    if ("skipped" in r) {
      skipped++;
      continue;
    }
    if (a.holes > 0) withHoles++;
    const signs = venues.get(a.id);
    const ok = signs ? { ...r.ok, venues: signs.map((v) => venueOut(v, r.ok)) } : r.ok;
    // A building's parts follow it, in its chunk, wherever their own centroids fall.
    out.push(ok, ...r.lifted);
  }
  const ground = chunkGround(
    bands.filter((b) => rectsOverlap(b.box, spec.rect)),
    spec.rect,
  );
  const r = spec.rect;
  const own = new Set(out.map((b) => b.id));
  const through = passages.filter((p) => own.has(p.building));
  const service = chunkServiceWays(lines, spec.rect);
  const foot = chunkFootWays(lines, spec.rect);
  const parks = chunkCarParks(kerb.carParks, spec.rect);
  const stops = chunkBusStops(kerb.busStops, spec.rect);
  const chunk: ChunkOut = {
    id: spec.id,
    district: spec.district.id,
    bounds: { minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ },
    terrain: t.grid,
    buildings: out,
    ground,
    streets: chunkStreets(lines, spec.rect),
    markings: chunkMarkings(markings, spec.rect),
    pois: chunkPois(pois, spec.rect),
    ...(through.length > 0 ? { passages: through } : {}),
    ...(service.length > 0 ? { serviceWays: service } : {}),
    ...(foot.length > 0 ? { footWays: foot } : {}),
    ...(parks.length > 0 ? { carParks: parks } : {}),
    ...(stops.length > 0 ? { busStops: stops } : {}),
  };
  const stats: ChunkStats = {
    id: spec.id,
    buildings: out.length,
    fromHeight: out.filter((b) => b.source === "height").length,
    fromLevels: out.filter((b) => b.source === "levels").length,
    skipped,
    withHoles,
    ground: ground.length,
    cell: t.grid.cell,
    terrainError: { max: t.maxError, p99: t.p99Error },
    minY: Math.min(...t.grid.heights),
    maxY: Math.max(...t.grid.heights),
    venues: out.reduce((n, b) => n + (b.venues?.length ?? 0), 0),
  };
  return { chunk, stats };
};

/** Distance from p to the segment a-b. */
const segmentDistance = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * k - p.x, a.z + dz * k - p.z);
};

export const generate = (data: OsmData, src: HeightSource, chunks: readonly ChunkSpec[] = ALL_CHUNKS): Generated => {
  const features = extractFeatures(data);
  // The explicit corrections of estimated tags (corrections.ts), before anything reads them.
  const areas = features.areas.map((a) => corrected(a));
  // A street of default width ends where the sidewalks mapped along it begin (T-046).
  const sidewalks = sidewalkIndex(features.lines);
  const lines = features.lines.map((l) => (l.tags.highway ? { ...l, tags: fitToKerb(l.tags, sidewalks.kerb(l), oneway(l.tags)) } : l));
  const outlines = buildingAreas(areas, data);
  const partAreas = areas.filter(isPart);
  const orphans = new Set(orphanParts(outlines, partAreas));
  const buildings = [...outlines, ...[...orphans].map(asBuilding)];
  const near = (pts: readonly Pt[]) => chunks.some((c) => rectsOverlap(ringBounds(pts), grow(c.rect, 1)));
  const bands: (Band & { box: Rect })[] = [];
  for (const a of areas) {
    const b = areaBand(a);
    if (b && near(b.ring)) bands.push({ ...b, box: ringBounds(b.ring) });
  }
  const water = bands.filter((b) => b.surface === "water").map((b) => b.ring);
  const rects = chunks.map((c) => c.rect);
  const tunnels = streetLevelTunnels(data);
  // Paved only where it runs through a building: elsewhere it may pass under a street of its own.
  const atStreet = new Set([...tunnels].filter((id) => lines.some((l) => l.osmId === id && buildingPassages([l], buildings, rects, tunnels).length > 0)));
  for (const [k, l] of lines.entries()) {
    if (!near(l.line)) continue;
    // Whether sidewalks are mapped along it: read off the street's width by type, as before it was fitted.
    for (const b of lineBands(l, l.tags.highway ? sidewalks.along(features.lines[k]!) : false, water, atStreet.has(l.osmId))) bands.push({ ...b, box: ringBounds(b.ring) });
  }
  // Zebras at the crossing nodes of the carriageways, in node order.
  const roads = lines.filter((l) => l.tags.highway !== undefined && near(l.line));
  // A crossing node a mapped crossing way runs through is striped by that way already.
  const crossingWays = roads.filter((l) => crossingWay(l.tags));
  const onCrossingWay = (p: Pt) => crossingWays.some((l) => l.line.some((q, i) => i + 1 < l.line.length && segmentDistance(p, q, l.line[i + 1]!) < 1.5));
  for (const n of [...data.nodes.values()].sort((a, b) => a.id - b.id)) {
    if (!n.tags || !markedCrossing(n.tags)) continue;
    const at = geoToWorld(n.lat, n.lon);
    if (!near([at]) || onCrossingWay(at)) continue;
    const b = crossingBand(`n${n.id}`, at, roads);
    if (b) bands.push({ ...b, box: ringBounds(b.ring) });
  }
  // A laid sidewalk stops at the kerb of the street it meets (ADR-0042): cut where it runs over another carriageway.
  const carriageways = bands.filter((b) => b.carriageway);
  const laid = bands.filter((b) => b.along);
  for (const b of laid) {
    const others = carriageways.filter((c) => c.source !== b.source && rectsOverlap(c.box, b.box));
    const pieces = cutSidewalk(b, (p) => others.some((c) => p.x >= c.box.minX && p.x <= c.box.maxX && p.z >= c.box.minZ && p.z <= c.box.maxZ && pointInRing(p, c.ring)));
    bands.splice(bands.indexOf(b), 1, ...pieces.map((x) => ({ ...x, box: ringBounds(x.ring) })));
  }
  // Road markings (ADR-0052): cut where they run into another carriageway or a zebra.
  const zebras = bands.filter((b) => b.surface === "crossing");
  const onOther = (p: Pt, source: string) => carriageways.some((c) => c.source !== source && p.x >= c.box.minX && p.x <= c.box.maxX && p.z >= c.box.minZ && p.z <= c.box.maxZ && pointInRing(p, c.ring));
  const onZebra = (p: Pt) => zebras.some((c) => p.x >= c.box.minX && p.x <= c.box.maxX && p.z >= c.box.minZ && p.z <= c.box.maxZ && pointInRing(p, c.ring));
  const markings: Marking[] = [];
  for (const l of roads) for (const m of roadMarkings(l)) for (const piece of cutLine(m.line, (p) => onOther(p, m.source) || onZebra(p))) markings.push({ ...m, line: piece });
  for (const n of [...data.nodes.values()].sort((a, b) => a.id - b.id)) {
    if (n.tags?.highway !== "traffic_signals") continue;
    const at = geoToWorld(n.lat, n.lon);
    if (near([at])) markings.push(...stopLines(`n${n.id}`, at, roads, onOther));
  }
  const pois = allPois(data);
  const passages = buildingPassages(lines.filter((l) => near(l.line)), buildings, rects, atStreet);
  const parts = partsByBuilding(buildings, partAreas.filter((p) => !orphans.has(p)));
  // Standing alone is a property of the whole map, not of a chunk: one pass for all of them.
  const alone = smallAlone(buildings);
  // Shops, cafés, bars and the rest on the buildings they are in or at (ADR-0064 stage 4).
  // All of them, so a building at a chunk's edge gets the same venues whichever chunks are built.
  const venues = assignVenues(allVenues(data, areas), buildings.map((b) => ({ id: b.id, ring: b.ring })));
  const mapped = allVenues(data, areas).filter((v) => chunks.some((c) => inRect(v.at, c.rect)));
  const kerb = { carParks: areas, busStops: busStopPosts(data, features.lines, areas) };
  const results = chunks.map((c) => generateChunk(c, src, buildings, bands, lines, pois, markings, passages, parts, alone, venues, kerb));
  const count = (f: (v: WorldVenue) => boolean) => mapped.filter(f).length;
  const venueStats: VenueStats = {
    total: mapped.length,
    signed: results.reduce((n, r) => n + r.stats.venues, 0),
    named: count((v) => v.named),
    colourOsm: count((v) => v.colourFrom === "osm"),
    colourTable: count((v) => v.colourFrom === "table"),
    colourKind: count((v) => v.colourFrom === "kind"),
  };
  return { chunks: results.map((r) => r.chunk), stats: results.map((r) => r.stats), venues: venueStats };
};
