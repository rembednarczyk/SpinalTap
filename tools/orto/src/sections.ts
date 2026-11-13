/**
 * The cell report's fixed sections (ADR-0077, decision of 12.11: the map keeper reads numbers
 * instead of writing probes), one implementation of each method:
 * 1. `fit.ts`: the game's footprints against LoD2 (mask IoU, best shift, halves, pairs by IoU);
 * 2. `lean.ts`: the lean of each cached orthophoto flight, the flight leaning least;
 * 3. `bare-parts.ts`: the bare ground in yards, frontages, gaps by the carriageway and LoD2 footprints,
 *    with the photograph's classes from that flight without the samples under a shifted roof;
 * 4. `absent.ts`: LoD2 and LoD1 2024 buildings the game lacks (NMPT skipped while not in `data/`),
 *    and the game's buildings LoD2 lacks, with LoD1 2024 near them or not;
 * 5. `known.ts`: the scan's hits in the cell with the glitches and T rows the registers name.
 * Each has a short table and a one-sentence verdict, in the report's JSON and text.
 */
import { loadLod1, loadLod2, tilesOf } from "../../gugik/src/extracts.ts";
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { type AbsentSection, type GameOnlySection, absentSection, absentText, gameOnlySection, gameOnlyText } from "./absent.ts";
import { type PartsSection, partsSection, partsText } from "./bare-parts.ts";
import { type CellSpec, FLIGHTS, defaultCache } from "./config.ts";
import { type Cover } from "./cover.ts";
import { type FitSection, fitSection, fitText } from "./fit.ts";
import { CHUNKS } from "./game.ts";
import { type KnownSection, knownText, loadKnown } from "./known.ts";
import { type LeanSection, leanSection, leanText } from "./lean.ts";
import { flatRing } from "./overlay.ts";
import { THRESHOLDS } from "./thresholds.ts";
import { loadTile } from "./tiles.ts";

export interface Sections {
  readonly footprints: FitSection;
  readonly lean: LeanSection;
  readonly bare: PartsSection;
  readonly absent: AbsentSection;
  /** The game's buildings without LoD2 under them (the other way round of `absent`). */
  readonly gameOnly: GameOnlySection;
  readonly known: KnownSection;
  /** Time each section took (ms). */
  readonly ms: Readonly<Record<string, number>>;
}

export interface SectionsInput {
  readonly cell: CellSpec;
  readonly cover?: Cover;
  readonly landuseBareAt?: (x: number, z: number) => boolean;
  readonly cleared: readonly Rect[];
  readonly cache?: string;
}

const grown = (r: Rect, d: number): Rect => ({ minX: r.minX - d, minZ: r.minZ - d, maxX: r.maxX + d, maxZ: r.maxZ + d });
const meets = (r: Rect) => (ring: readonly Pt[]) => ring.some((p) => p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ);

/** The game's buildings once each (a building over a chunk's edge may be in both). */
const gameBuildings = () => {
  const seen = new Set<string>();
  return CHUNKS.flatMap((c) => c.buildings).filter((b) => !seen.has(b.id) && seen.add(b.id)).map((b) => ({ id: b.id, ring: flatRing(b.outline, b.x, b.z) }));
};

export const cellSections = (inp: SectionsInput): Sections => {
  const ms: Record<string, number> = {};
  const timed = <T>(name: string, f: () => T): T => {
    const t = performance.now();
    const v = f();
    ms[name] = Math.round(performance.now() - t);
    return v;
  };
  const rect = inp.cell.rect;
  const near = meets(grown(rect, 50));
  const tiles = tilesOf(grown(rect, 60));
  const lod2 = loadLod2(tiles).filter((b) => near(b.ring));
  const lod2Rings = lod2.map((b) => b.ring);
  const game = gameBuildings().filter((b) => near(b.ring));
  const lod1 = loadLod1(tiles).filter((b) => near(b.ring));
  const gameOnly = timed("gameOnly", () => gameOnlySection(rect, game, lod2Rings, lod1));
  const footprints = timed("footprints", () => fitSection(rect, game, lod2, gameOnly.buildings.length));
  const cache = inp.cache ?? defaultCache();
  const photos = FLIGHTS.flatMap((f) => {
    const tile = loadTile(cache, f.id, inp.cell);
    return tile ? [{ flight: f.id, tile }] : [];
  });
  const lean = timed("lean", () => leanSection(rect, lod2Rings.filter(meets(grown(rect, 10))), photos));
  const rec = lean.flights.find((f) => f.flight === lean.recommended);
  const photo = rec ? { flight: rec.flight, tile: photos.find((p) => p.flight === rec.flight)!.tile, dx: rec.dx, dz: rec.dz } : undefined;
  const bare = timed("bare", () =>
    partsSection({
      rect,
      buildings: game.map((b) => b.ring),
      pieces: CHUNKS.flatMap((c) => c.ground.map((g) => ({ surface: g.surface, ring: flatRing(g.outline) }))).filter((g) => near(g.ring)),
      carParks: CHUNKS.flatMap((c) => (c.carParks ?? []).map((p) => flatRing(p.outline))).filter(near),
      lod2: lod2Rings,
      thresholds: THRESHOLDS,
      ...(inp.cover ? { cover: inp.cover } : {}),
      ...(photo ? { photo } : {}),
      ...(inp.landuseBareAt ? { landuseBareAt: inp.landuseBareAt } : {}),
    }),
  );
  const absent = timed("absent", () => absentSection(rect, lod2, lod1, game.map((b) => b.ring), inp.cleared));
  const known = timed("known", () => loadKnown(inp.cell.id, rect));
  return { footprints, lean, bare, absent, gameOnly, known, ms };
};

export const sectionsText = (s: Sections): string[] => [...fitText(s.footprints), ...leanText(s.lean), ...partsText(s.bare), ...absentText(s.absent), ...gameOnlyText(s.gameOnly), ...knownText(s.known)];
