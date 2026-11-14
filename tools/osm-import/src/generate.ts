/**
 * The generator proper: map data and terrain in, chunks out. Pure and deterministic: the same
 * input gives the same chunks, byte for byte, whatever order the files were read in.
 */
import { LUBLIN_ANCHOR } from "../../../packages/core/src/world/city-geo.ts";
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import { type Lod1Building, type Lod2Building } from "../../gugik/src/extracts.ts";
import { asBuilding, isPart, orphanParts, partsByBuilding } from "./building-parts.ts";
import { belowGround, parseLength } from "./building-tags.ts";
import { smallAlone } from "./building-alone.ts";
import { buildingsWithTowers, mappedTowers } from "./building-towers.ts";
import { type WorldBarrier, chunkBarriers, worldBarriers } from "./barriers.ts";
import { toAbutments } from "./bridge-ends.ts";
import { bridgeFills, onCarriagewayDecks } from "./bridge-fill.ts";
import { type EdgeCut, edgeOutlines, partsWithin } from "./building-edge.ts";
import { makeBuilding } from "./buildings.ts";
import { type Cover } from "../../orto/src/cover.ts";
import { type CoverFill, coverFiller, pathLoops, townPlaces, withFills } from "./bare-cover.ts";
import { type AddedArea, addedAreas, corrected, correctedLine } from "./corrections.ts";
import { withoutReplaced } from "./corrections-alchemia.ts";
import { orthoPieces, orthoSides } from "./corrections-kerb.ts";
import { ALL_CHUNKS, type ChunkSpec, DISTRICTS } from "./config.ts";
import { type HeightSource } from "./dtm.ts";
import { type Area, type Line, extractFeatures } from "./features.ts";
import { type Band, areaBand, chunkGround, crossingBand, crossingWay, cutSidewalk, fitToKerb, groundJoints, isCarriageway, lineBands, markedCrossing, openPavings, roadWidth } from "./ground.ts";
import { geoToWorld } from "./project.ts";
import { type Marking, chunkMarkings, cutLine, oneway, roadMarkings, stopLines } from "./markings.ts";
import { type Pt, type Rect, centroid, inRect, pointInRing, rectsOverlap, ringBounds } from "./geometry.ts";
import { FILL_MARGIN, kerbFills, stretchZebras } from "./kerb-fill.ts";
import { type KerbSample, fitLanes, taperedJoins } from "./lane-fit.ts";
import { roundJoints } from "./line-buffer.ts";
import { busStopPosts, chunkBusStops, chunkCarParks, chunkMultiLaneWays } from "./kerbside.ts";
import { type StreetHalves, streetHalves } from "./street-half.ts";
import { type LaidWay, type StreetWidths, carriagewaySource, streetWidths } from "./street-section.ts";
import { allPois, chunkFlights, chunkFootWays, chunkPois, chunkServiceWays, chunkStreets } from "./labels.ts";
import { type PassageOut, buildingPassages, streetLevelTunnels } from "./passages.ts";
import { type BuildingOut, type ChunkOut, type GroundOut, type SteepWayOut } from "./model.ts";
import { type OsmData, type Tags } from "./osm.ts";
import { lod1Index, withLod1Height } from "./lod1-heights.ts";
import { lod2Index, withLod2Roof } from "./lod2-roofs.ts";
import { withSurfaceTop } from "./corrections-surface.ts";
import { RingBins } from "./ring-bins.ts";
import { type ChunkTerrain, chunkTerrain, gridsHeight, sampleField } from "./terrain.ts";
import { chunkSteepWays, steepWays } from "./steep-ways.ts";
import { groundRaisedGreen, raisedGreen } from "./raised-green.ts";
import { overTunnels, tunnelLines } from "./tunnel-decks.ts";
import { type WorldVenue, allVenues, assignVenues, venueOut } from "./venues.ts";

export interface ChunkStats {
  readonly id: string;
  readonly buildings: number;
  readonly fromHeight: number;
  readonly fromLevels: number;
  /** Heights from GUGiK LoD1 2024 (ADR-0077 step 3). */
  readonly fromLod1: number;
  /** Walls and roofs from GUGiK LoD2 2017 (ADR-0077 step 4). */
  readonly fromLod2: number;
  readonly skipped: number;
  readonly withHoles: number;
  readonly ground: number;
  readonly cell: number;
  readonly terrainError: { readonly max: number; readonly p99: number };
  readonly minY: number;
  readonly maxY: number;
  /** Venues signed on the chunk's buildings (ADR-0064 stage 4). */
  readonly venues: number;
  /** The pieces of its ground the orthophoto's cover laid (ADR-0077 steps 1.1 and 1.2), for the control numbers of the tests. */
  readonly fills: readonly GroundOut[];
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
  /** Where the streets' carriageway widths come from (ADR-0080 decision 2): the importer's control numbers. */
  readonly widths: StreetWidths;
}

const SKIP_BUILDING = new Set(["no", "construction", "roof", "ruins", "demolished", "proposed"]);

const buildingAreas = (areas: readonly Area[], data: OsmData): Area[] => {
  const inRelation = new Set<string>();
  for (const r of data.relations.values()) {
    if (r.tags?.building === undefined) continue;
    for (const m of r.members) if (m.type === "way" && m.role !== "inner") inRelation.add(`w${m.ref}`);
  }
  return areas.filter((a) => a.tags.building !== undefined && !SKIP_BUILDING.has(a.tags.building) && !belowGround(a.tags) && !inRelation.has(a.id));
};

/** `plain`: a point of a footway without `footway=sidewalk` (`kerb` reads it on a street's side tagged `separate`). */
type SidewalkPoint = Pt & { readonly tx: number; readonly tz: number; readonly plain?: true };

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

/**
 * Whether a footway without `footway=sidewalk` is a street's sidewalk where that street's side
 * says its sidewalk is mapped `separate`ly: Lublin maps many sidewalks as plain footways (the one
 * along Radziwiłłowska by Plac Litewski, G-655). A crossing and a paved area are not.
 */
const plainFootway = (t: Tags): boolean => t.highway === "footway" && t.footway !== "sidewalk" && t.footway !== "crossing" && t.area !== "yes";

/** The sides of a street (left, right of its direction) whose sidewalks the map says are separate ways. */
const separateSides = (t: Tags): [boolean, boolean] => {
  const all = t.sidewalk === "separate" || t["sidewalk:both"] === "separate";
  return [all || t["sidewalk:left"] === "separate", all || t["sidewalk:right"] === "separate"];
};

/** A coarse spatial hash of points along mapped sidewalks (`footway=sidewalk`, and plain footways: `plainFootway`), with their direction. */
export const sidewalkIndex = (lines: readonly Line[]) => {
  const cell = 10;
  const grid = new Map<string, SidewalkPoint[]>();
  const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  for (const l of lines) {
    const plain = plainFootway(l.tags);
    if (l.tags.footway !== "sidewalk" && !plain) continue;
    const pts: SidewalkPoint[] = samplesAlong(l.line, 3);
    const end = pts[pts.length - 1];
    if (end) pts.push({ ...l.line[l.line.length - 1]!, tx: end.tx, tz: end.tz });
    for (const p of pts) {
      const list = grid.get(key(p.x, p.z)) ?? [];
      list.push(plain ? { ...p, plain } : p);
      grid.set(key(p.x, p.z), list);
    }
  }
  const around = (p: Pt): SidewalkPoint[] => {
    const out: SidewalkPoint[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) out.push(...(grid.get(`${Math.floor(p.x / cell) + dx},${Math.floor(p.z / cell) + dz}`) ?? []));
    return out;
  };
  /**
   * Each sample of the road 2 m apart, its arc length and how far from the axis its carriageway
   * may reach on its left and right (Infinity: no sidewalk there), `KERB_MARGIN` short of its
   * mapped sidewalks running along it (parallel, beside it) with their axis on its carriageway by
   * type; a plain footway counts on the sides `plain` says.
   */
  const kerbSamples = (road: Line, plain: readonly [boolean, boolean]): KerbSample[] => {
    const reach = roadWidth(road.tags) / 2;
    let at = 0;
    return samplesAlong(road.line, 2).map((p, i, all) => {
      if (i > 0) at += Math.hypot(p.x - all[i - 1]!.x, p.z - all[i - 1]!.z);
      const kerb: [number, number] = [Infinity, Infinity];
      for (const q of around(p)) {
        const along = (q.x - p.x) * p.tx + (q.z - p.z) * p.tz;
        const across = (q.z - p.z) * p.tx - (q.x - p.x) * p.tz;
        if (Math.abs(along) > 2 || Math.abs(across) >= reach || Math.abs(q.tx * p.tx + q.tz * p.tz) < 0.9) continue;
        const side = across >= 0 ? 0 : 1;
        if (q.plain && !plain[side]) continue;
        kerb[side] = Math.min(kerb[side], Math.abs(across) - KERB_MARGIN);
      }
      return { at, kerb };
    });
  };
  return {
    /** True when separate sidewalks run along at least a third of the road. */
    along: (road: Line): boolean => {
      const reach = roadWidth(road.tags) / 2 + 7;
      const samples = samplesAlong(road.line, 8);
      const near = samples.filter((p) => around(p).some((q) => !q.plain && Math.hypot(q.x - p.x, q.z - p.z) <= reach)).length;
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
      const samples = kerbSamples(road, [false, false]);
      const sides = [0, 1].map((side) => samples.flatMap((p) => (Number.isFinite(p.kerb[side]) ? [p.kerb[side]!] : [])));
      const medians = sides.filter((s) => s.length >= MIN_KERB_SAMPLES && s.length * 2 >= samples.length).map((s) => [...s].sort((a, b) => a - b)[Math.floor(s.length / 2)]!);
      return medians.length > 0 ? Math.min(...medians) : null;
    },
    /**
     * A street of mapped `lanes` (G-655) fitted side by side and stretch by stretch to its
     * sidewalks and, on a side tagged `separate`, its plain footways (`plainFootway`, `fitLanes`):
     * its carriageway's pieces, or null where none runs along it.
     */
    lanes: (road: Line): Line[] | null => (Number(road.tags.lanes) > 0 ? fitLanes(road, kerbSamples(road, separateSides(road.tags)), MIN_KERB_SAMPLES) : null),
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
  t: ChunkTerrain,
  buildings: readonly (Area & { readonly edge?: EdgeCut })[],
  bands: readonly (Band & { box: Rect })[],
  lines: readonly Line[],
  pois: ReturnType<typeof allPois>,
  markings: readonly Marking[],
  passages: readonly PassageOut[],
  parts: ReadonlyMap<string, readonly Area[]>,
  alone: ReadonlySet<string>,
  towered: ReadonlySet<string>,
  venues: ReadonlyMap<string, readonly WorldVenue[]>,
  kerb: { readonly carParks: readonly Area[]; readonly busStops: readonly Pt[] },
  barriers: readonly WorldBarrier[],
  heights: { readonly lod1?: ReturnType<typeof lod1Index>; readonly lod2?: ReturnType<typeof lod2Index>; readonly orphans: ReadonlySet<string> },
  halves: StreetHalves,
  steep: readonly SteepWayOut[],
  fill?: CoverFill,
) => {
  const altitude = LUBLIN_ANCHOR.altitude;
  const shopPoints = pois.filter((p) => p.kind === "shop" || p.kind === "food" || p.kind === "bar" || p.kind === "service").map((p) => p.at);
  const namedPoints = pois
    .filter((p) => p.kind === "hotel" || p.kind === "sight" || p.kind === "culture" || p.kind === "church")
    .map((p) => ({ at: p.at, name: p.kind === "hotel" && !/hotel/i.test(p.name) ? `Hotel ${p.name}` : p.name, ...(p.addr ? { addr: p.addr } : {}) }));
  const civicPoints = pois.flatMap((p) => (CIVIC_POINTS.has(p.tag) ? [{ at: p.at, name: p.name, amenity: p.tag.replace("amenity=", ""), ...(p.addr ? { addr: p.addr } : {}) }] : []));
  const out = [];
  let skipped = 0;
  let withHoles = 0;
  for (const a of buildings) {
    if (!inRect(centroid(a.edge?.ring ?? a.ring), spec.rect)) continue;
    const own = a.edge ? partsWithin(parts.get(a.id) ?? [], a.edge.rect) : parts.get(a.id);
    const r = makeBuilding(a, { src, grid: t.grid, altitude, range: spec.district.defaultLevels, shopPoints, namedPoints, civicPoints, alone, towered }, own, a.edge?.ring);
    if ("skipped" in r) {
      skipped++;
      continue;
    }
    if (a.holes > 0) withHoles++;
    const crowned = heights.orphans.has(a.id) || (parts.get(a.id)?.length ?? 0) > 0;
    const lod1 = withLod1Height(r.ok, heights.lod1, crowned, a.edge && a.ring);
    const roofed = withLod2Roof(lod1, {
      ...(heights.lod2 ? { lod2: heights.lod2 } : {}),
      ...(heights.lod1 ? { lod1: heights.lod1 } : {}),
      tags: a.tags,
      crowned,
      ...(r.ok.source === "levels" ? { tagged: r.ok.levels } : {}),
      ...(a.edge ? { whole: a.ring } : {}),
    });
    const built = withSurfaceTop(roofed);
    // A building cut at the map's edge signs only the venues on its part on the map (G-556).
    const edge = a.edge?.rect;
    const signs = edge ? venues.get(a.id)?.filter((v) => inRect(v.at, edge)) : venues.get(a.id);
    const ok = signs?.length ? { ...built, venues: signs.map((v) => venueOut(v, built)) } : built;
    // A building's parts follow it, in its chunk, wherever their own centroids fall.
    out.push(ok, ...r.lifted);
  }
  const inChunk = bands.filter((b) => rectsOverlap(b.box, spec.rect));
  const laid = chunkGround(inChunk, spec.rect);
  // The bare ground left laid from the orthophoto's cover (ADR-0077 step 1.1). Read off the ground
  // without the joints' patches (G-760): a patch laps over a fill's edge, it does not cut the fill
  // to a speck that is then dropped.
  const plain = inChunk.some((b) => b.patch) ? chunkGround(inChunk.filter((b) => !b.patch), spec.rect) : laid;
  const fills = fill ? fill(spec.rect, plain, shopOutlines(out, buildings)) : [];
  const ground = fill ? withFills(laid, fills) : laid;
  const r = spec.rect;
  const own = new Set(out.map((b) => b.id));
  const through = passages.filter((p) => own.has(p.building));
  const service = chunkServiceWays(lines, spec.rect);
  const foot = chunkFootWays(lines, spec.rect);
  const flights = chunkFlights(lines, spec.rect);
  const steepWays = chunkSteepWays(steep, spec.rect);
  const parks = chunkCarParks(kerb.carParks, spec.rect);
  const stops = chunkBusStops(kerb.busStops, spec.rect);
  const wide = chunkMultiLaneWays(lines, spec.rect);
  const walls = chunkBarriers(barriers, spec.rect);
  const chunk: ChunkOut = {
    id: spec.id,
    district: spec.district.id,
    bounds: { minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ },
    terrain: t.grid,
    buildings: out,
    ground,
    streets: chunkStreets(lines, spec.rect, halves),
    markings: chunkMarkings(markings, spec.rect),
    pois: chunkPois(pois, spec.rect),
    ...(through.length > 0 ? { passages: through } : {}),
    ...(service.length > 0 ? { serviceWays: service } : {}),
    ...(foot.length > 0 ? { footWays: foot } : {}),
    ...(flights.length > 0 ? { flights } : {}),
    ...(steepWays.length > 0 ? { steepWays } : {}),
    ...(parks.length > 0 ? { carParks: parks } : {}),
    ...(stops.length > 0 ? { busStops: stops } : {}),
    ...(wide.length > 0 ? { multiLaneWays: wide } : {}),
    ...(walls.length > 0 ? { barriers: walls } : {}),
  };
  const stats: ChunkStats = {
    id: spec.id,
    buildings: out.length,
    fromHeight: out.filter((b) => b.source === "height").length,
    fromLevels: out.filter((b) => b.source === "levels").length,
    fromLod1: out.filter((b) => b.source === "lod1").length,
    fromLod2: out.filter((b) => b.source === "lod2").length,
    skipped,
    withHoles,
    ground: ground.length,
    cell: t.grid.cell,
    terrainError: { max: t.maxError, p99: t.p99Error },
    minY: Math.min(...t.grid.heights),
    maxY: Math.max(...t.grid.heights),
    venues: out.reduce((n, b) => n + (b.venues?.length ?? 0), 0),
    fills,
  };
  return { chunk, stats };
};

/** The shops and public buildings of a chunk and the stops' shelters, as `landuse-bare` reads them: their forecourts are a town's paved places. */
const shopOutlines = (out: readonly BuildingOut[], buildings: readonly Area[]): Pt[][] => {
  const shelter = new Set(buildings.filter((a) => a.tags.shelter_type === "public_transport" || a.tags.public_transport !== undefined).map((a) => a.id));
  return out.filter((b) => b.use === "commercial" || b.use === "civic" || shelter.has(b.id)).map((b) => Array.from({ length: b.outline.length / 2 }, (_, k) => ({ x: b.outline[2 * k]! + b.x, z: b.outline[2 * k + 1]! + b.z })));
};

/**
 * `lod1`: GUGiK LoD1 2024 buildings (`Inputs.lod1`) for the heights the map lacks (`lod1-heights.ts`);
 * `lod2`: GUGiK LoD2 2017 buildings (`Inputs.lod2`) for the roofs it lacks (`lod2-roofs.ts`); without, the tags' heights and roofs.
 * `covers`: the districts' orthophoto cover (`Inputs.covers`) the bare ground is laid from (`bare-cover.ts`); without, it stays bare.
 */
/** A gap's patch is no carriageway, sidewalk or kerb: only the ground of its band (G-760); a slit is laid edge to edge (G-777). */
const patchBand = (of: Band, ring: Pt[], slit?: true): Band => ({ surface: of.surface, ring, bridge: false, source: of.source, holed: true, patch: true, ...(slit ? { slit } : {}) });

/** The bands less the slits a carriageway is widened over to its paving: the widening covers them, a slit would lie under it (G-777). */
const slitsOffWidened = <B extends Band & { box: Rect }>(bands: readonly B[], widened: readonly (readonly Pt[])[]): B[] => {
  const wide = widened.map((ring) => ({ ring, box: ringBounds(ring) }));
  return bands.filter((b) => !b.slit || !wide.some((w) => rectsOverlap(w.box, b.box) && pointInRing(centroid(b.ring), w.ring)));
};

export const generate = (
  data: OsmData,
  src: HeightSource,
  chunks: readonly ChunkSpec[] = ALL_CHUNKS,
  added?: readonly AddedArea[],
  lod1?: readonly Lod1Building[],
  lod2?: readonly Lod2Building[],
  covers?: readonly Cover[],
): Generated => {
  // The ways a set piece of the game replaces (ADR-0074 stage 7) are left out before anything reads them.
  const features = withoutReplaced(extractFeatures(data));
  // The explicit corrections of estimated tags and the areas OSM lacks (corrections.ts), before anything reads them.
  const areas = [...features.areas.map((a) => corrected(a)), ...addedAreas(added)];
  const mapLines = features.lines.map((l) => correctedLine(l));
  // A street of default width ends where the sidewalks mapped along it begin (T-046).
  const sidewalks = sidewalkIndex(mapLines);
  const lines = mapLines.map((l) => (l.tags.highway ? { ...l, tags: fitToKerb(l.tags, sidewalks.kerb(l), oneway(l.tags)) } : l));
  // A street of mapped lanes ends at its sidewalks side by side and stretch by stretch (G-655): its
  // carriageway's pieces, for its bands, markings and zebras. Its axis stays the map's for the rest.
  // So does a street measured on the orthophoto off its axis in OSM: on the asphalt (ADR-0080 PR 10).
  const fittedLanes = new Map<string, readonly Line[]>();
  for (const l of lines) {
    const pieces = l.tags.highway ? (sidewalks.lanes(l) ?? orthoPieces(l)) : null;
    if (pieces) fittedLanes.set(l.id, pieces);
  }
  const carriageway = (l: Line): readonly Line[] => fittedLanes.get(l.id) ?? [l];
  const outlines = buildingAreas(areas, data);
  const partAreas = areas.filter(isPart);
  const orphans = new Set(orphanParts(outlines, partAreas));
  const buildings = [...outlines, ...[...orphans].map(asBuilding)];
  // The chunks' rects grown once, and each outline's box taken once, not once a chunk: the whole city's outlines are tested.
  const grown = (m: number) => chunks.map((c) => grow(c.rect, m));
  const [rects1, rectsFill] = [grown(1), grown(FILL_MARGIN)];
  const nearAny = (pts: readonly Pt[], rs: readonly Rect[]) => {
    const box = ringBounds(pts);
    return rs.some((r) => rectsOverlap(box, r));
  };
  const near = (pts: readonly Pt[]) => nearAny(pts, rects1);
  // The ground is laid as far past the chunks as the kerbs' fills in them read it (G-522).
  const nearGround = (pts: readonly Pt[]) => nearAny(pts, rectsFill);
  const areaBands: (Band & { box: Rect })[] = [];
  for (const a of areas) {
    const b = areaBand(a);
    if (b && nearGround(b.ring)) areaBands.push({ ...b, box: ringBounds(b.ring) });
  }
  const holed = new Set(areas.filter((a) => a.holes > 0).map((a) => a.id));
  const bands = openPavings(areaBands, (b) => !holed.has(b.source));
  const water = bands.filter((b) => b.surface === "water").map((b) => b.ring);
  const rects = chunks.map((c) => c.rect);
  const tunnels = streetLevelTunnels(data);
  // Paved only where it runs through a building: elsewhere it may pass under a street of its own.
  const atStreet = new Set([...tunnels].filter((id) => lines.some((l) => l.osmId === id && buildingPassages([l], buildings, rects, tunnels).length > 0)));
  // A bridge's deck reaches its abutment (G-344): level from bank to bank, not tilted down to the
  // bank under the bridge, nor down the bank on the game's terrain (G-739). Its band only: the street,
  // its markings and lanes end where the map has them.
  // So is a street's stretch over a tunnel it dips over (G-088): a deck, as on a bridge.
  const terrains = chunks.map((c) => ({ rect: c.rect, ...chunkTerrain(sampleField(src, c.rect, 12), c.rect, LUBLIN_ANCHOR.altitude) }));
  const tunnelWays = tunnelLines(lines);
  const laidLines: LaidWay[] = [];
  for (const [k, l] of toAbutments(lines, areas, gridsHeight(terrains)).entries()) {
    if (!nearGround(l.line)) continue;
    // Whether sidewalks are mapped along it: read off the street's width by type, as before it was fitted.
    const mapped = l.tags.highway ? sidewalks.along(mapLines[k]!) : false;
    for (const c of carriageway(l)) {
      const width = carriagewaySource(features.lines[k]!.tags, mapLines[k]!.tags, c.tags, orthoSides(l.id));
      for (const piece of overTunnels(c, tunnelWays, src)) laidLines.push({ piece, mapped, atStreet: atStreet.has(l.osmId), width });
    }
  }
  // A band's end is round where its way meets another on the ground, as far as nothing else covers it: the corner square ends left bare (ADR-0078, G-658).
  const joined = groundJoints(laidLines);
  for (const { piece, mapped, atStreet: at } of laidLines) for (const b of lineBands(piece, mapped, water, at, joined)) bands.push({ ...b, box: ringBounds(b.ring) });
  bands.splice(0, bands.length, ...roundJoints(bands, patchBand).map((b) => ({ ...b, box: ringBounds(b.ring) })));
  // Zebras at the crossing nodes of the carriageways, in node order.
  const roads = lines.flatMap(carriageway).filter((l) => l.tags.highway !== undefined && near(l.line));
  // A crossing node a mapped crossing way runs through is striped by that way already.
  const crossingWays = roads.filter((l) => crossingWay(l.tags));
  const onCrossingWay = (p: Pt) => crossingWays.some((l) => l.line.some((q, i) => i + 1 < l.line.length && segmentDistance(p.x, p.z, q.x, q.z, l.line[i + 1]!.x, l.line[i + 1]!.z) < 1.5));
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
  // The sidewalks whole, where they run over the asphalt too: no carriageway is widened over one (G-082).
  const walks = laid.filter((b) => !b.bridge).map((b) => b.ring);
  for (const b of laid) {
    const others = carriageways.filter((c) => c.source !== b.source && rectsOverlap(c.box, b.box));
    const pieces = cutSidewalk(b, (p) => others.some((c) => p.x >= c.box.minX && p.x <= c.box.maxX && p.z >= c.box.minZ && p.z <= c.box.maxZ && pointInRing(p, c.ring)));
    bands.splice(bands.indexOf(b), 1, ...pieces.map((x) => ({ ...x, box: ringBounds(x.ring) })));
  }
  // A lawn mapped above the ground lies on the roof of a structure under it, off the buildings and carriageways (G-647).
  const raised = new Set(areas.filter((a) => raisedGreen(a.tags)).map((a) => a.id));
  const decks = areas.filter((a) => a.tags.building !== undefined && a.tags.building !== "no" && belowGround(a.tags)).map((a) => a.ring);
  bands.splice(0, bands.length, ...groundRaisedGreen(bands, raised, decks, buildings.map((a) => a.ring)));
  // A bridge is one deck: its outline fills the gap between its sidewalk and its carriageway (G-340).
  for (const b of bridgeFills(areas, bands)) bands.push({ ...b, box: ringBounds(b.ring) });
  // Its sidewalk level with its carriageway in every cross section (G-737), the fill too.
  bands.splice(0, bands.length, ...onCarriagewayDecks(areas, bands));
  // A pavement reaches the kerb (G-522): the bare strip between a carriageway and its paving is
  // closed, by the carriageway itself where the map gives it no width (G-570), its zebras with it.
  // A street fitted to its mapped sidewalks (T-046) has its width from them, as a measured one.
  const measured = new Set(mapLines.filter((l, k) => parseLength(l.tags.width ?? l.tags["width:carriageway"]) !== null || lines[k]!.tags !== l.tags).map((l) => l.id));
  // A joint's patch laps over the next street: the kerbs are read off the bands without it, as its lap is no kerb's (G-760).
  const kerbs = kerbFills(bands.filter((b) => !b.patch), buildings.filter((a) => nearGround(a.ring)).map((a) => a.ring), (source) => !measured.has(source), walks);
  for (const [b, { ring, runs }] of kerbs.widened) bands.splice(bands.indexOf(b as (typeof bands)[number]), 1, { ...b, widen: runs, box: ringBounds([...b.ring, ...ring]) });
  for (const b of kerbs.fills) bands.push({ ...b, box: ringBounds(b.ring) });
  bands.splice(0, bands.length, ...slitsOffWidened(bands, [...kerbs.widened.values()].map((w) => w.ring)));
  // The carriageways' reach each side of their axes, fitted and widened, for the traffic's lanes (ADR-0080).
  const halves = streetHalves(bands);
  const widths = streetWidths(laidLines, (w) => isCarriageway(w.piece.tags) || w.atStreet, kerbs.widened);
  const nodeZebras = bands.filter((b) => b.surface === "crossing" && b.source.startsWith("n"));
  stretchZebras(nodeZebras, [...kerbs.widened.values()].map((w) => w.ring)).forEach((z, i) => bands.splice(bands.indexOf(nodeZebras[i]!), 1, { ...z, box: ringBounds(z.ring) }));
  // Road markings (ADR-0052): cut where they run into another carriageway or a zebra.
  const zebras = bands.filter((b) => b.surface === "crossing");
  // By the cells round the point, not every carriageway of the city for every half metre of every line (G-719).
  const [carriagewayBins, zebraBins] = [new RingBins(carriageways), new RingBins(zebras)];
  const onOther = (p: Pt, source: string) => carriagewayBins.scan(p.x, p.z, (c) => c.source !== source);
  const onZebra = (p: Pt) => zebraBins.holds(p.x, p.z);
  const markings: Marking[] = [];
  // A fitted street's lines run on from piece to piece and on to the next way (G-675).
  for (const m of taperedJoins(roads.flatMap(roadMarkings), new Set(fittedLanes.keys()))) for (const piece of cutLine(m.line, (p) => onOther(p, m.source) || onZebra(p))) markings.push({ ...m, line: piece });
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
  // The map's towers stand for the whole map too: a church's belfry may be mapped across a chunk's edge.
  const towered = buildingsWithTowers(buildings, mappedTowers(data));
  // Shops, cafés, bars and the rest on the buildings they are in or at (ADR-0064 stage 4).
  // All of them, so a building at a chunk's edge gets the same venues whichever chunks are built.
  const venues = assignVenues(allVenues(data, areas), buildings.map((b) => ({ id: b.id, ring: b.ring })));
  const mapped = allVenues(data, areas).filter((v) => chunks.some((c) => inRect(v.at, c.rect)));
  const kerb = { carParks: areas, busStops: busStopPosts(data, mapLines, areas) };
  // A building across the map's edge, centred off it, is cut at the edge rather than dropped (G-556);
  // the whole map's districts, so it is cut the same whichever chunks are built.
  const cut = edgeOutlines(buildings, DISTRICTS.map((d) => d.rect));
  const placed = buildings.map((b) => {
    const edge = cut.get(b.id);
    return edge ? { ...b, edge } : b;
  });
  // Walls, fences and hedges (ADR-0077) clear of the buildings, carriageways, steps and the ways through them.
  const barriers = worldBarriers(data, lines, areas, { buildings, bands, lines });
  const heights = { ...(lod1 ? { lod1: lod1Index(lod1) } : {}), ...(lod2 ? { lod2: lod2Index(lod2) } : {}), orphans: new Set([...orphans].map((p) => p.id)) };
  const fill = covers && coverFiller(covers, placed.map((b) => ("edge" in b ? b.edge.ring : b.ring)), townPlaces(data, areas, pathLoops(lines)));
  // On the ways as laid: a stretch on a deck over a tunnel is no bank (G-088).
  const steep = steepWays(laidLines.map((l) => l.piece), gridsHeight(terrains));
  const results = chunks.map((c, i) => generateChunk(c, src, terrains[i]!, placed, bands, lines, pois, markings, passages, parts, alone, towered, venues, kerb, barriers, heights, halves, steep, fill));
  return { chunks: results.map((r) => r.chunk), stats: results.map((r) => r.stats), venues: venueStatsOf(mapped, results.reduce((n, r) => n + r.stats.venues, 0)), widths };
};

/** The tally of the venues the map has in the built chunks (`mapped`), `signed` of them hung on a building. */
const venueStatsOf = (mapped: readonly WorldVenue[], signed: number): VenueStats => {
  const count = (f: (v: WorldVenue) => boolean) => mapped.filter(f).length;
  return {
    total: mapped.length,
    signed,
    named: count((v) => v.named),
    colourOsm: count((v) => v.colourFrom === "osm"),
    colourTable: count((v) => v.colourFrom === "table"),
    colourKind: count((v) => v.colourFrom === "kind"),
  };
};
