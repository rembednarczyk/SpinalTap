/**
 * The generator proper: map data and terrain in, chunks out. Pure and deterministic: the same
 * input gives the same chunks, byte for byte, whatever order the files were read in.
 */
import { LUBLIN_ANCHOR } from "../../../packages/core/src/world/city-geo.ts";
import { makeBuilding } from "./buildings.ts";
import { ALL_CHUNKS, type ChunkSpec } from "./config.ts";
import { type HeightSource } from "./dtm.ts";
import { type Area, type Line, extractFeatures } from "./features.ts";
import { type Band, areaBand, chunkGround, crossingBand, crossingWay, cutSidewalk, lineBands, markedCrossing, roadWidth } from "./ground.ts";
import { geoToWorld } from "./project.ts";
import { type Marking, chunkMarkings, cutLine, roadMarkings, stopLines } from "./markings.ts";
import { type Pt, type Rect, centroid, inRect, pointInRing, rectsOverlap, ringBounds } from "./geometry.ts";
import { allPois, chunkPois, chunkStreets } from "./labels.ts";
import { type PassageOut, buildingPassages } from "./passages.ts";
import { type ChunkOut } from "./model.ts";
import { type OsmData } from "./osm.ts";
import { chunkTerrain, sampleField } from "./terrain.ts";

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
}

export interface Generated {
  readonly chunks: readonly ChunkOut[];
  readonly stats: readonly ChunkStats[];
}

const SKIP_BUILDING = new Set(["no", "construction", "roof", "ruins", "demolished", "proposed"]);

const buildingAreas = (areas: readonly Area[], data: OsmData): Area[] => {
  const inRelation = new Set<string>();
  for (const r of data.relations.values()) {
    if (r.tags?.building === undefined) continue;
    for (const m of r.members) if (m.type === "way" && m.role !== "inner") inRelation.add(`w${m.ref}`);
  }
  return areas.filter((a) => a.tags.building !== undefined && !SKIP_BUILDING.has(a.tags.building) && !inRelation.has(a.id));
};

/** A coarse spatial hash of points along mapped sidewalks (`footway=sidewalk`). */
const sidewalkIndex = (lines: readonly Line[]) => {
  const cell = 10;
  const grid = new Map<string, Pt[]>();
  const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  for (const l of lines) {
    if (l.tags.footway !== "sidewalk") continue;
    for (let i = 0; i + 1 < l.line.length; i++) {
      const a = l.line[i]!;
      const b = l.line[i + 1]!;
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 3));
      for (let k = 0; k <= n; k++) {
        const p = { x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n };
        const list = grid.get(key(p.x, p.z)) ?? [];
        list.push(p);
        grid.set(key(p.x, p.z), list);
      }
    }
  }
  /** True when separate sidewalks run along at least a third of the road. */
  return (road: Line): boolean => {
    const reach = roadWidth(road.tags) / 2 + 7;
    let near = 0;
    let total = 0;
    for (let i = 0; i + 1 < road.line.length; i++) {
      const a = road.line[i]!;
      const b = road.line[i + 1]!;
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 8));
      for (let k = 0; k < n; k++) {
        const p = { x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n };
        total++;
        let hit = false;
        for (let dx = -1; dx <= 1 && !hit; dx++)
          for (let dz = -1; dz <= 1 && !hit; dz++)
            hit = (grid.get(`${Math.floor(p.x / cell) + dx},${Math.floor(p.z / cell) + dz}`) ?? []).some((q) => Math.hypot(q.x - p.x, q.z - p.z) <= reach);
        if (hit) near++;
      }
    }
    return total > 0 && near / total >= 1 / 3;
  };
};

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
) => {
  const altitude = LUBLIN_ANCHOR.altitude;
  const t = chunkTerrain(sampleField(src, spec.rect, 12), spec.rect, altitude);
  const shopPoints = pois.filter((p) => p.kind === "shop" || p.kind === "food" || p.kind === "bar" || p.kind === "service").map((p) => p.at);
  const namedPoints = pois
    .filter((p) => p.kind === "hotel" || p.kind === "sight" || p.kind === "culture" || p.kind === "church")
    .map((p) => ({ at: p.at, name: p.kind === "hotel" && !/hotel/i.test(p.name) ? `Hotel ${p.name}` : p.name }));
  const out = [];
  let skipped = 0;
  let withHoles = 0;
  for (const a of buildings) {
    if (!inRect(centroid(a.ring), spec.rect)) continue;
    const r = makeBuilding(a, { src, grid: t.grid, altitude, range: spec.district.defaultLevels, shopPoints, namedPoints });
    if ("skipped" in r) {
      skipped++;
      continue;
    }
    if (a.holes > 0) withHoles++;
    out.push(r.ok);
  }
  const ground = chunkGround(
    bands.filter((b) => rectsOverlap(b.box, spec.rect)),
    spec.rect,
  );
  const r = spec.rect;
  const own = new Set(out.map((b) => b.id));
  const through = passages.filter((p) => own.has(p.building));
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
  const { areas, lines } = extractFeatures(data);
  const buildings = buildingAreas(areas, data);
  const mapped = sidewalkIndex(lines);
  const near = (pts: readonly Pt[]) => chunks.some((c) => rectsOverlap(ringBounds(pts), grow(c.rect, 1)));
  const bands: (Band & { box: Rect })[] = [];
  for (const a of areas) {
    const b = areaBand(a);
    if (b && near(b.ring)) bands.push({ ...b, box: ringBounds(b.ring) });
  }
  const water = bands.filter((b) => b.surface === "water").map((b) => b.ring);
  for (const l of lines) {
    if (!near(l.line)) continue;
    for (const b of lineBands(l, l.tags.highway ? mapped(l) : false, water)) bands.push({ ...b, box: ringBounds(b.ring) });
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
  const passages = buildingPassages(lines.filter((l) => near(l.line)), buildings);
  const results = chunks.map((c) => generateChunk(c, src, buildings, bands, lines, pois, markings, passages));
  return { chunks: results.map((r) => r.chunk), stats: results.map((r) => r.stats) };
};
