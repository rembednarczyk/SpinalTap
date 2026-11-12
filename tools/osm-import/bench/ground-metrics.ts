/**
 * Measures of a chunk's ground (ADR-0078): rings that cross themselves, the area the pieces
 * cover, overlap and leave as gaps between them on a raster, vertices and triangles.
 */
import { type Pt, type Rect, selfIntersects } from "../src/geometry.ts";

/** Raster cell (m). */
export const CELL = 0.25;
/** A bare cell is a gap when ground lies within this many cells of it on both sides, along x or z (gaps up to 1.25 m). */
export const REACH = 3;

/** A piece as the raster reads it: rings filled even-odd (an outer ring and its holes). */
export type Piece = readonly (readonly Pt[])[];

export interface Raster {
  readonly w: number;
  readonly h: number;
  /** Pieces over each cell, capped at 255. */
  readonly count: Uint8Array;
}

/** Scanline fill of every piece at the cells' centres. */
export const rasterize = (pieces: readonly Piece[], rect: Rect): Raster => {
  const w = Math.round((rect.maxX - rect.minX) / CELL);
  const h = Math.round((rect.maxZ - rect.minZ) / CELL);
  const count = new Uint8Array(w * h);
  for (const piece of pieces) {
    const all = piece.flat();
    if (all.length < 3) continue;
    const z0 = Math.max(0, Math.floor((Math.min(...all.map((p) => p.z)) - rect.minZ) / CELL));
    const z1 = Math.min(h - 1, Math.ceil((Math.max(...all.map((p) => p.z)) - rect.minZ) / CELL));
    for (let row = z0; row <= z1; row++) {
      const z = rect.minZ + (row + 0.5) * CELL;
      const xs: number[] = [];
      for (const ring of piece) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[i]!;
          const b = ring[j]!;
          if (a.z > z !== b.z > z) xs.push(a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k]! - rect.minX) / CELL - 0.5));
        const c1 = Math.min(w - 1, Math.ceil((xs[k + 1]! - rect.minX) / CELL - 0.5) - 1);
        for (let c = c0; c <= c1; c++) if (count[row * w + c]! < 255) count[row * w + c]!++;
      }
    }
  }
  return { w, h, count };
};

/** Bare cells with ground within `REACH` cells on both sides, along x or along z. */
export const gapCells = ({ w, h, count }: Raster): number => {
  const covered = (c: number, r: number) => c >= 0 && r >= 0 && c < w && r < h && count[r * w + c]! > 0;
  const near = (c: number, r: number, dc: number, dr: number) => {
    for (let k = 1; k <= REACH; k++) if (covered(c + dc * k, r + dr * k)) return true;
    return false;
  };
  let n = 0;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (count[r * w + c]! > 0) continue;
      if ((near(c, r, -1, 0) && near(c, r, 1, 0)) || (near(c, r, 0, -1) && near(c, r, 0, 1))) n++;
    }
  }
  return n;
};

export interface GroundMeasure {
  readonly pieces: number;
  readonly rings: number;
  readonly selfCrossing: number;
  readonly vertices: number;
  readonly triangles: number;
  /** m² */
  readonly covered: number;
  readonly overlap: number;
  readonly gaps: number;
}

/** `holes`: how many of the rings are holes (each adds two triangles to its polygon's). */
export const measure = (pieces: readonly Piece[], rect: Rect, holes: number): GroundMeasure => {
  const raster = rasterize(pieces, rect);
  const rings = pieces.flat();
  const vertices = rings.reduce((n, r) => n + r.length, 0);
  let [covered, overlap] = [0, 0];
  for (const v of raster.count) {
    if (v > 0) covered++;
    if (v > 1) overlap++;
  }
  const a = CELL * CELL;
  return {
    pieces: pieces.length,
    rings: rings.length,
    selfCrossing: rings.filter((r) => selfIntersects(r)).length,
    vertices,
    // Any triangulation of a polygon without Steiner points: V + 2H - 2 per outer ring.
    triangles: vertices + 2 * holes - 2 * (rings.length - holes),
    covered: covered * a,
    overlap: overlap * a,
    gaps: gapCells(raster) * a,
  };
};

/** Cells one raster covers and the other leaves bare (m²): what a variant adds and what it loses. */
export const difference = (a: Raster, b: Raster): { onlyA: number; onlyB: number } => {
  let [onlyA, onlyB] = [0, 0];
  for (let i = 0; i < a.count.length; i++) {
    if (a.count[i]! > 0 && b.count[i] === 0) onlyA++;
    if (b.count[i]! > 0 && a.count[i] === 0) onlyB++;
  }
  return { onlyA: onlyA * CELL * CELL, onlyB: onlyB * CELL * CELL };
};
