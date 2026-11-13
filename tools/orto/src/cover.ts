/**
 * The cover raster (ADR-0077): a district's 0.5 m grid in world metres (x east, z north; row 0 the
 * north edge), one class a sample, as `data/orto/<slug>.cover.png` (4-bit palette) with its header
 * `<slug>.cover.json`. Built from the cached orthophoto: a sample's colour is the mean of the
 * tile's pixels at four points inside it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { puwgFrame, worldToPuwg } from "../../osm-import/src/project.ts";
import { COVER, COVER_NAMES, COVER_PALETTE, type Colour, classify } from "./classify.ts";
import { CELLS, COVER_DIR, COVER_STEP } from "./config.ts";
import { decodeIndexed, encodeIndexed4 } from "./png.ts";
import { type Thresholds } from "./thresholds.ts";
import { type Tile, pixelAt, usableTiles } from "./tiles.ts";

export interface CoverHeader {
  readonly district: string;
  /** West edge of column 0 and north edge of row 0 (world metres). */
  readonly x0: number;
  readonly z1: number;
  readonly step: number;
  readonly width: number;
  readonly height: number;
  readonly classes: readonly string[];
  readonly source: string;
  /** The tiles the cover was made of: cell, flight, service, day fetched. */
  readonly tiles: readonly { readonly cell: string; readonly flight: string; readonly service: string; readonly fetched: string }[];
  readonly thresholds: Thresholds;
}

export interface Cover {
  readonly header: CoverHeader;
  readonly cls: Uint8Array;
}

export const SOURCE = "Ortofotomapa PZGiK (GUGiK, geoportal.gov.pl), WMS ORTO HighResolution / StandardResolution, EPSG:2180";

export const coverFiles = (slug: string, dir = COVER_DIR) => ({ png: join(dir, `${slug}.cover.png`), header: join(dir, `${slug}.cover.json`) });

export const emptyCover = (district: string, rect: Rect, thresholds: Thresholds, step = COVER_STEP): Cover => {
  const width = Math.round((rect.maxX - rect.minX) / step);
  const height = Math.round((rect.maxZ - rect.minZ) / step);
  return { header: { district, x0: rect.minX, z1: rect.maxZ, step, width, height, classes: [...COVER_NAMES], source: SOURCE, tiles: [], thresholds }, cls: new Uint8Array(width * height) };
};

/** Centre of the sample (col, row). */
export const sampleCentre = (h: CoverHeader, col: number, row: number): Pt => ({ x: h.x0 + (col + 0.5) * h.step, z: h.z1 - (row + 0.5) * h.step });

/** The class of the sample holding (x, z); `none` off the raster. */
export const coverAt = (c: Cover, x: number, z: number): number => {
  const h = c.header;
  const col = Math.floor((x - h.x0) / h.step);
  const row = Math.floor((h.z1 - z) / h.step);
  return col < 0 || row < 0 || col >= h.width || row >= h.height ? COVER.none : c.cls[row * h.width + col]!;
};

/**
 * The mean colour of the samples of `rect` (cells of the raster) from one tile: R, G, B a sample
 * and a count of the tile's pixels found (0 where it has none).
 */
export interface Sampled {
  readonly rgb: Float32Array;
  readonly n: Uint16Array;
}

/** The columns and rows of the raster in `rect`, end exclusive. */
const span = (h: CoverHeader, rect: Rect) => ({
  c0: Math.max(0, Math.floor((rect.minX - h.x0) / h.step)),
  c1: Math.min(h.width, Math.ceil((rect.maxX - h.x0) / h.step)),
  r0: Math.max(0, Math.floor((h.z1 - rect.maxZ) / h.step)),
  r1: Math.min(h.height, Math.ceil((h.z1 - rect.minZ) / h.step)),
});

export const sampleColours = (h: CoverHeader, tile: Tile, rect: Rect): Sampled => {
  const rgb = new Float32Array(h.width * h.height * 3);
  const n = new Uint16Array(h.width * h.height);
  const f = puwgFrame();
  const [cs, sn] = [Math.cos((f.gammaDeg * Math.PI) / 180) * f.scale, Math.sin((f.gammaDeg * Math.PI) / 180) * f.scale];
  const q = h.step / 4;
  const subs: readonly (readonly [number, number])[] = [
    [-q, -q],
    [q, -q],
    [-q, q],
    [q, q],
  ];
  const { c0, c1, r0, r1 } = span(h, rect);
  for (let row = r0; row < r1; row++)
    for (let col = c0; col < c1; col++) {
      const p = sampleCentre(h, col, row);
      const g = worldToPuwg(p);
      const k = row * h.width + col;
      for (const [dx, dz] of subs) {
        // The grid turned by the meridian convergence: (e, n) = scale · R(γ) · (x, z).
        const i = pixelAt(tile, { e: g.e + cs * dx - sn * dz, n: g.n + sn * dx + cs * dz });
        if (i < 0) continue;
        for (let ch = 0; ch < 3; ch++) rgb[k * 3 + ch]! += tile.rgb[i * 3 + ch]!;
        n[k]!++;
      }
    }
  return { rgb, n };
};

/**
 * The colours of `rect` averaged over a square of `radius` samples round each (within `rect`): a
 * lawn's or a pavement's colour over 1.5 m, not a single tuft, joint or twig.
 */
export const smoothColours = (h: CoverHeader, s: Sampled, rect: Rect, radius: number): Sampled => {
  if (radius <= 0) return s;
  const rgb = new Float32Array(s.rgb.length);
  const n = new Uint16Array(s.n.length);
  const { c0, c1, r0, r1 } = span(h, rect);
  for (let row = r0; row < r1; row++)
    for (let col = c0; col < c1; col++) {
      const k = row * h.width + col;
      if (!s.n[k]) continue;
      for (let rr = Math.max(r0, row - radius); rr <= Math.min(r1 - 1, row + radius); rr++)
        for (let cc = Math.max(c0, col - radius); cc <= Math.min(c1 - 1, col + radius); cc++) {
          const j = rr * h.width + cc;
          for (let ch = 0; ch < 3; ch++) rgb[k * 3 + ch]! += s.rgb[j * 3 + ch]!;
          n[k]! += s.n[j]!;
        }
    }
  return { rgb, n };
};

/** Classifies the samples of `rect` into `cover` from the flights' tiles, the current image first; blank tiles left out (`usableTiles`). */
export const classifyRect = (cover: Cover, flights: readonly Tile[], rect: Rect): void => {
  const h = cover.header;
  const tiles = usableTiles(flights);
  const sampled = tiles.map((t) => smoothColours(h, sampleColours(h, t, rect), rect, h.thresholds.smooth));
  const k0 = Math.max(0, Math.floor((h.z1 - rect.maxZ) / h.step)) * h.width;
  const k1 = Math.min(h.height, Math.ceil((h.z1 - rect.minZ) / h.step)) * h.width;
  for (let k = k0; k < k1; k++) {
    const colours: Colour[] = [];
    for (const { rgb, n } of sampled) if (n[k]) colours.push([rgb[k * 3]! / n[k]!, rgb[k * 3 + 1]! / n[k]!, rgb[k * 3 + 2]! / n[k]!]);
    // Every flight or none: a sample seen by only some would be judged on another season.
    if (colours.length && colours.length === tiles.length) cover.cls[k] = classify(colours, h.thresholds);
  }
};

export const coverToFiles = (c: Cover): { readonly png: Uint8Array; readonly header: string } => ({
  png: encodeIndexed4({ width: c.header.width, height: c.header.height, index: c.cls, palette: COVER_PALETTE }),
  header: `${JSON.stringify(c.header, null, 2)}\n`,
});

export const readCover = (slug: string, dir = COVER_DIR): Cover | undefined => {
  const f = coverFiles(slug, dir);
  if (!existsSync(f.png) || !existsSync(f.header)) return undefined;
  const header = JSON.parse(readFileSync(f.header, "utf8")) as CoverHeader;
  const img = decodeIndexed(new Uint8Array(readFileSync(f.png)));
  if (img.width !== header.width || img.height !== header.height) throw new Error(`${f.png}: size differs from its header`);
  return { header, cls: img.index };
};

/** The cover holding a world point, among the districts' rasters. */
export const coverFor = (covers: readonly Cover[], p: Pt): Cover | undefined =>
  covers.find((c) => {
    const h = c.header;
    return p.x >= h.x0 && p.x < h.x0 + h.width * h.step && p.z <= h.z1 && p.z > h.z1 - h.height * h.step;
  });

/** The cells of a district, by slug. */
export const cellsOf = (slug: string) => CELLS.filter((c) => c.slug === slug);
