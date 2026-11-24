/**
 * The building sites' table (ADR-0087 stage 1): every site of the map the generator
 * (`construction-site.ts`) lays, over the generated chunks' ground, written by `pnpm osm:props`
 * into `packages/sim/src/content/lublin/construction.generated.ts`, one piece per line like the
 * furniture's table (`rowText`, ADR-0083).
 *
 * A site is an outline OSM tags `landuse=construction` or `building=construction` (not a
 * `building:part`: a dome on a roof) whose middle lies in a chunk, the finished ones aside
 * (`withBuiltSites`, G-872). A `building=construction` inside a site's land is that site's.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { loadMapLod1 } from "./load.ts";
import { withBuiltSites } from "./built-sites.ts";
import { DISTRICTS } from "./config.ts";
import { FOOT_KINDS, type SiteGround, type SiteNeighbour, lineDistance } from "./construction-ground.ts";
import { type SiteOutline, type SitePlan, planSite } from "./construction-site.ts";
import { type Pt, type Rect, centroid, pointInRing, ringBounds } from "./geometry.ts";
import { type OsmData, type Tags, mergeOsm, parseExtract } from "./osm.ts";
import { REPO } from "./paths.ts";
import type { BoardSpan } from "./props-boards.ts";
import { propRows, rowText } from "./props-emit.ts";
import { Site } from "./props-site.ts";
import { structuresOf } from "./structures.ts";

/** The table the generator writes, and the simulation imports. */
export const SITES_OUT = join(REPO, "packages/sim/src/content/lublin/construction.generated.ts");

/** How far a site's pieces keep from the map's own walls and fences (m). */
const BARRIER_GAP = 0.5;
/** How far round a site's box its neighbours are looked for (m). */
const NEIGHBOURS = 30;

const tagsOf = (osm: OsmData, id: string): Tags | undefined => (id.startsWith("w") ? osm.ways.get(Number(id.slice(1)))?.tags : osm.relations.get(Number(id.slice(1).split("/")[0]))?.tags);

/** The sites of a map's extract, by id: `landuse=construction` and `building=construction` outlines, a building's inside a site's land left to it. */
export const siteOutlines = (osm: OsmData): SiteOutline[] => {
  const all = structuresOf(osm).filter((s) => {
    const t = tagsOf(osm, s.id);
    return s.kind === "construction" && (t?.landuse === "construction" || t?.building === "construction");
  });
  const land = all.filter((s) => tagsOf(osm, s.id)?.landuse === "construction");
  return all.filter((s) => tagsOf(osm, s.id)?.landuse === "construction" || !land.some((l) => pointInRing(centroid(s.ring), l.ring))).map((s) => ({ id: s.id, ring: s.ring }));
};

/** The map's sites from the committed extracts, the finished ones aside (G-872). */
export const loadSiteOutlines = (root = REPO): SiteOutline[] =>
  siteOutlines(withBuiltSites(mergeOsm(DISTRICTS.map((d) => parseExtract(readFileSync(join(root, "data/osm", `${d.slug}.json`), "utf8")))), loadMapLod1(root)));

const flat = (f: readonly number[]): Pt[] => Array.from({ length: f.length >> 1 }, (_, k) => ({ x: f[2 * k]!, z: f[2 * k + 1]! }));

const near = (box: Rect, pts: readonly Pt[], by: number): boolean => pts.some((p) => p.x > box.minX - by && p.x < box.maxX + by && p.z > box.minZ - by && p.z < box.maxZ + by);

/** What the sites read of the map besides the chunks: the buildings' OSM tags by id, the venues' boards the renderer hangs. */
export interface SiteMapInfo {
  readonly tags?: ReadonlyMap<string, Tags>;
  readonly boards?: readonly BoardSpan[];
  /** The plan's furniture at its points (lamps, bins, benches of the map): a site's pieces keep off them. */
  readonly furniture?: readonly Pt[];
}

/** How far a site's piece keeps from the plan's furniture at its points (m): a lamp's base and a hand. */
const FURNITURE_GAP = 0.9;

/** Does a venue's board hang on the wall from a to b: its frame's wall along it, 0.6 m or nearer to its middle? */
const boardOn = (a: Pt, b: Pt, s: BoardSpan): boolean => {
  const [len, wl] = [Math.hypot(b.x - a.x, b.z - a.z), Math.hypot(s.wallB.x - s.wallA.x, s.wallB.z - s.wallA.z)];
  if (len < 1e-6 || wl < 1e-6) return false;
  const cross = ((b.x - a.x) * (s.wallB.z - s.wallA.z) - (b.z - a.z) * (s.wallB.x - s.wallA.x)) / (len * wl);
  return Math.abs(cross) < 0.1 && segmentDistance((a.x + b.x) / 2, (a.z + b.z) / 2, s.wallA.x, s.wallA.z, s.wallB.x, s.wallB.z) < 0.6;
};

/** A neighbour's walls with a venue's board on them (G-893). */
export const boardWalls = (ring: readonly Pt[], boards: readonly BoardSpan[]): (readonly [Pt, Pt])[] =>
  ring.flatMap((a, i): (readonly [Pt, Pt])[] => {
    const b = ring[(i + 1) % ring.length]!;
    return boards.some((s) => boardOn(a, b, s)) ? [[a, b]] : [];
  });

/** The ground round a site from the chunks: `Site`'s surfaces, the frontages' fills, the map's barriers and streets near it. */
export const chunkGround = (site: Site, box: Rect, info: SiteMapInfo = {}): SiteGround => {
  const chunks = site.chunks;
  const fronts = chunks.flatMap((c) => c.ground.filter((g) => g.front).map((g) => flat(g.outline))).filter((r) => near(box, r, 1));
  const barriers = chunks.flatMap((c) => (c.barriers ?? []).filter((b) => b.kind !== "gate").map((b) => flat(b.line))).filter((l) => near(box, l, 2));
  const streets = site.streets.filter((s) => near(box, s.line, 80));
  const drive = streets.filter((s) => !FOOT_KINDS.has(s.kind));
  const furniture = (info.furniture ?? []).filter((q) => q.x > box.minX - 2 && q.x < box.maxX + 2 && q.z > box.minZ - 2 && q.z < box.maxZ + 2);
  const byFurniture = (p: Pt) => furniture.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < FURNITURE_GAP);
  const byBarrier = (p: Pt) => barriers.some((l) => l.some((a, i) => i + 1 < l.length && segmentDistance(p.x, p.z, a.x, a.z, l[i + 1]!.x, l[i + 1]!.z) < BARRIER_GAP));
  // The buildings round it (stage 2), each once (a building cut at a seam is in each chunk's table),
  // with their protection (G-894) and the walls with a venue's board (G-893).
  const boards = (info.boards ?? []).filter((s) => near(box, [s.wallA, s.wallB], NEIGHBOURS));
  const seen = new Set<string>();
  const neighbours: SiteNeighbour[] = [];
  for (const b of chunks.flatMap((c) => c.buildings)) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    const ring = flat(b.outline).map((p) => ({ x: p.x + b.x, z: p.z + b.z }));
    if (!near(box, ring, NEIGHBOURS)) continue;
    const t = info.tags?.get(b.id.split("/")[0]!);
    const walls = boardWalls(ring, boards);
    neighbours.push({
      ring,
      top: Math.round((b.y + b.height + Math.max(0, b.roof ?? 0)) * 100) / 100,
      ...(t?.historic !== undefined || t?.heritage !== undefined ? { heritage: true } : {}),
      ...(walls.length > 0 ? { boardWalls: walls } : {}),
    });
  }
  return {
    neighbours,
    free: (p) => {
      if (!site.chunkAt(p) || site.deckAt(p) !== null) return false;
      const s = site.surfaceAt(p);
      return (s === null || s === "green") && !fronts.some((r) => pointInRing(p, r)) && !byBarrier(p) && !byFurniture(p);
    },
    // A square's or a courtyard's paving inside the site takes its fence (the user's decision of 24.11); a sidewalk or a path stays open.
    fenceFree: (p) => {
      if (!site.chunkAt(p) || site.deckAt(p) !== null) return false;
      const s = site.surfaceAt(p);
      return (s === null || s === "green" || (s === "walk" && site.onAreaPaving(p))) && !fronts.some((r) => pointInRing(p, r)) && !byBarrier(p) && !byFurniture(p);
    },
    open: (p) => site.chunkAt(p) !== null && site.standable(p),
    verge: (p) => {
      if (!site.chunkAt(p) || site.deckAt(p) !== null || !site.standable(p)) return false;
      const s = site.surfaceAt(p);
      // A frontage's fill (the strip between the building line and the pavement) is ground a cone may stand on.
      return (s === null || s === "green" || s === "walk") && !byBarrier(p);
    },
    heightAt: (p) => site.heightAt(p),
    cellAt: (p) => site.chunkAt(p)?.terrain.cell ?? Infinity,
    driveDistance: (p) => Math.min(Infinity, ...drive.map((s) => lineDistance(p, s.line))),
    walkDistance: (p) => Math.min(Infinity, ...streets.map((s) => lineDistance(p, s.line))),
  };
};

/** Every site of `outlines` with its middle in a chunk, laid over the chunks' ground, by id. */
export const planSites = (outlines: readonly SiteOutline[], chunks: readonly LublinChunkData[], info: SiteMapInfo = {}): SitePlan[] => {
  const site = new Site(chunks);
  return outlines
    .filter((o) => site.chunkAt(centroid(o.ring)) !== null)
    .map((o) => planSite(o, chunkGround(site, ringBounds(o.ring), info)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
};

const flatOf = (pts: readonly Pt[]): number[] => pts.flatMap((p) => [p.x, p.z]);

/** An outline one corner (x, z) per line, like a row's pieces (`rowText`), so a moved corner changes one line. */
const cornersText = (pts: readonly Pt[], indent: string): string =>
  pts.length === 0 ? "[]" : `[\n${pts.map((p) => `${indent}  ${JSON.stringify(p.x)},${JSON.stringify(p.z)},`).join("\n")}\n${indent}]`;

/** The text of `construction.generated.ts`. */
export const emitSites = (plans: readonly SitePlan[]): string =>
  [
    "// Generated by tools/osm-import (`pnpm osm:props`) from the map's building sites and the chunks' ground. Do not edit.",
    "// The building sites of Lublin 2077 (ADR-0087): outlines from OpenStreetMap © OpenStreetMap contributors, ODbL 1.0 (a derived",
    "// database under the ODbL), the rest laid by the generator (`construction-site.ts`). See data/osm/ATTRIBUTION.md.",
    "// Format (tools/osm-import/src/construction-table.ts): one corner of the outline and one piece per line, kinds in name",
    "// order, pieces in placement order.",
    'import type { LublinConstructionSiteData } from "./types";',
    "",
    "/** Per site: its set, the board's keys, the dig and its pieces as flat rows of x, y, z (world metres), yaw (radians), variant. */",
    "export const LUBLIN_CONSTRUCTION_SITES: readonly LublinConstructionSiteData[] = [",
    ...plans.flatMap((p) => [
      `  { id: ${JSON.stringify(p.id)}, seed: ${p.seed}, set: ${JSON.stringify(p.set)}, area: ${p.area},`,
      `    outline: ${cornersText(p.outline, "    ")},`,
      `    board: ${JSON.stringify(p.board)},`,
      `    dig: ${p.dig ? `{ outline: ${JSON.stringify(flatOf(p.dig.outline))}, y: ${p.dig.y}, blend: ${p.dig.blend} }` : "null"},`,
      "    pieces: {",
      ...propRows(p.pieces as StreetPropItem[]).map(([k, row]) => `      ${JSON.stringify(k)}: ${rowText(row, "      ")},`),
      "    },",
      "  },",
    ]),
    "];",
    "",
  ].join("\n");
