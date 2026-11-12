/**
 * The overlay (ADR-0077): what the import draws against what the orthophoto shows, in m² by cover
 * class. For a ring (an added area, a ground piece) and for a cell: its bare ground (no ground
 * piece, no building), the scan's `landuse-bare` part of it, and each surface the import draws.
 */
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { COVER, COVER_NAMES, type CoverName } from "./classify.ts";
import { type Cover, type CoverHeader, coverFor } from "./cover.ts";
import { type ClassCounts, areaOf, countAt, samplesIn, zeroCounts } from "./rings.ts";

export const flatRing = (flat: readonly number[], ox = 0, oz = 0): Pt[] => {
  const ring: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) ring.push({ x: flat[i]! + ox, z: flat[i + 1]! + oz });
  return ring;
};

/** The raster holding most of a ring's vertices (the first may lie just off it). */
const coverOfRing = (covers: readonly Cover[], ring: readonly Pt[]): Cover | undefined => {
  const votes = new Map<Cover, number>();
  for (const p of ring) {
    const c = coverFor(covers, p);
    if (c) votes.set(c, (votes.get(c) ?? 0) + 1);
  }
  return [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
};

/** Samples by class in a ring, from the raster holding most of its vertices. */
export const ringCounts = (covers: readonly Cover[], ring: readonly Pt[]): ClassCounts | undefined => {
  const cover = coverOfRing(covers, ring);
  return cover ? countAt(cover, samplesIn(cover.header, ring)) : undefined;
};

/** m² by class in a ring, from the raster holding most of its vertices. */
export const ringOverlay = (covers: readonly Cover[], ring: readonly Pt[]): ClassCounts | undefined => {
  const cover = coverOfRing(covers, ring);
  return cover ? areaOf(countAt(cover, samplesIn(cover.header, ring)), cover.header.step) : undefined;
};

/** A mask over the raster: 1 where one of the rings covers a sample. */
const mask = (h: CoverHeader, rings: readonly (readonly Pt[])[]): Uint8Array => {
  const m = new Uint8Array(h.width * h.height);
  for (const r of rings) for (const k of samplesIn(h, r)) m[k] = 1;
  return m;
};

/** The samples of the raster inside `rect`. */
const rectSamples = (h: CoverHeader, rect: Rect): number[] => samplesIn(h, [
  { x: rect.minX, z: rect.minZ },
  { x: rect.maxX, z: rect.minZ },
  { x: rect.maxX, z: rect.maxZ },
  { x: rect.minX, z: rect.maxZ },
]);

export interface BareOverlay {
  /** m² of the cell's bare ground by cover class. */
  readonly bare: ClassCounts;
  /** m² of it the scan's `landuse-bare` counts (a town's paved area by the shops and stops). */
  readonly landuseBare: ClassCounts;
  /** m² by cover class under each surface the import draws. */
  readonly surfaces: Readonly<Record<string, ClassCounts>>;
  /** m² by class under the buildings (roofs and their lean on the photograph). */
  readonly buildings: ClassCounts;
}

/**
 * The cell's ground against the cover. `chunks` are all the map's (a building or a piece over the
 * cell's edge counts); `landuseBareAt` is the scan's check over the city.
 */
export const cellOverlay = (cover: Cover, rect: Rect, chunks: readonly LublinChunkData[], landuseBareAt: (x: number, z: number) => boolean): BareOverlay => {
  const h = cover.header;
  const near = (pts: readonly Pt[]) => pts.some((p) => p.x > rect.minX - 50 && p.x < rect.maxX + 50 && p.z > rect.minZ - 50 && p.z < rect.maxZ + 50);
  const buildings = chunks.flatMap((c) => c.buildings.map((b) => flatRing(b.outline, b.x, b.z))).filter(near);
  const pieces = chunks.flatMap((c) => c.ground.map((g) => ({ surface: g.surface, ring: flatRing(g.outline) }))).filter((g) => near(g.ring));
  const inBuilding = mask(h, buildings);
  const onGround = mask(h, pieces.map((g) => g.ring));
  const bare = zeroCounts();
  const landuse = zeroCounts();
  const roofs = zeroCounts();
  for (const k of rectSamples(h, rect)) {
    const name: CoverName = COVER_NAMES[cover.cls[k]!] ?? "none";
    if (cover.cls[k] === COVER.none) continue;
    if (inBuilding[k]) {
      roofs[name]++;
      continue;
    }
    if (onGround[k]) continue;
    bare[name]++;
    if (landuseBareAt(h.x0 + ((k % h.width) + 0.5) * h.step, h.z1 - (Math.floor(k / h.width) + 0.5) * h.step)) landuse[name]++;
  }
  const surfaces: Record<string, ClassCounts> = {};
  const inCell = new Uint8Array(h.width * h.height);
  for (const k of rectSamples(h, rect)) inCell[k] = 1;
  // A sample counts under the last piece drawn over it, as the renderer lifts them (`SURFACE_LIFT`, draw order).
  const top = new Int32Array(h.width * h.height).fill(-1);
  pieces.forEach((g, i) => {
    for (const k of samplesIn(h, g.ring)) if (inCell[k] && !inBuilding[k]) top[k] = i;
  });
  for (let k = 0; k < top.length; k++) {
    if (top[k]! < 0 || cover.cls[k] === COVER.none) continue;
    const s = pieces[top[k]!]!.surface;
    (surfaces[s] ??= zeroCounts())[COVER_NAMES[cover.cls[k]!]!]++;
  }
  const m2 = (c: ClassCounts) => areaOf(c, h.step);
  return { bare: m2(bare), landuseBare: m2(landuse), surfaces: Object.fromEntries(Object.entries(surfaces).map(([s, c]) => [s, m2(c)])), buildings: m2(roofs) };
};
