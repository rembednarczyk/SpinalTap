/**
 * Orthophoto tiles in the cache: one PNG a map cell in the PUWG 1992 grid (EPSG:2180), with a
 * sidecar of where it lies. Pure helpers; the network is in `fetch.ts`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { type Puwg, worldToPuwg } from "../../osm-import/src/project.ts";
import { type CellSpec, ORTHO_STEP, TILE_MARGIN } from "./config.ts";
import { decodeRgb } from "./png.ts";
import { type Sheet } from "./sheets.ts";

/** A box in the PUWG 1992 grid: eastings and northings (m). */
export interface GridBox {
  readonly minE: number;
  readonly minN: number;
  readonly maxE: number;
  readonly maxN: number;
}

export interface TileMeta {
  readonly cell: string;
  readonly flight: string;
  readonly service: string;
  /** The archive's `TIME` asked for, when the tile is from the archive. */
  readonly time?: string;
  readonly crs: "EPSG:2180";
  readonly box: GridBox;
  readonly width: number;
  readonly height: number;
  /** The day it was fetched (YYYY-MM-DD). */
  readonly fetched: string;
  /** The sheet it shows at its middle, from the sheet index; absent when the index did not answer. */
  readonly sheet?: Sheet;
  /** The share of blank pixels, written only when over `BLANK_MAX`: the services had no image of the flight there. */
  readonly blank?: number;
}

export interface Tile {
  readonly meta: TileMeta;
  readonly rgb: Uint8Array;
  /** 1 where the service had no image. */
  readonly empty: Uint8Array;
}

/** The grid box round a world rectangle grown by `margin`, snapped outwards to whole `step`s. */
export const gridBox = (rect: Rect, margin = TILE_MARGIN, step = ORTHO_STEP): GridBox => {
  const corners: Pt[] = [
    { x: rect.minX - margin, z: rect.minZ - margin },
    { x: rect.maxX + margin, z: rect.minZ - margin },
    { x: rect.minX - margin, z: rect.maxZ + margin },
    { x: rect.maxX + margin, z: rect.maxZ + margin },
  ];
  const g = corners.map((p) => worldToPuwg(p));
  const snap = (v: number, up: boolean) => (up ? Math.ceil(v / step) : Math.floor(v / step)) * step;
  return {
    minE: snap(Math.min(...g.map((p) => p.e)), false),
    minN: snap(Math.min(...g.map((p) => p.n)), false),
    maxE: snap(Math.max(...g.map((p) => p.e)), true),
    maxN: snap(Math.max(...g.map((p) => p.n)), true),
  };
};

/** WMS 1.3.0 GetMap of a box: EPSG:2180's axis order is northing first. */
export const getMapUrl = (service: string, layer: string, box: GridBox, width: number, height: number, time?: string): string =>
  `${service}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layer}&STYLES=&CRS=EPSG:2180` +
  `&BBOX=${box.minN},${box.minE},${box.maxN},${box.maxE}&WIDTH=${width}&HEIGHT=${height}&FORMAT=image/png${time ? `&TIME=${time}` : ""}`;

export const tileFiles = (cache: string, flight: string, cell: string) => ({ dir: join(cache, flight), png: join(cache, flight, `${cell}.png`), meta: join(cache, flight, `${cell}.json`) });

export const loadTile = (cache: string, flight: string, cell: CellSpec): Tile | undefined => {
  const f = tileFiles(cache, flight, cell.id);
  if (!existsSync(f.png) || !existsSync(f.meta)) return undefined;
  const meta = JSON.parse(readFileSync(f.meta, "utf8")) as TileMeta;
  const img = decodeRgb(new Uint8Array(readFileSync(f.png)));
  if (img.width !== meta.width || img.height !== meta.height) throw new Error(`${f.png}: ${img.width}×${img.height}, sidecar says ${meta.width}×${meta.height}`);
  return { meta, rgb: img.rgb, empty: img.empty };
};

/** A tile with more of its pixels blank than this shows no photograph: no flight there (G-771). */
export const BLANK_MAX = 0.95;

/** The share of an image with no photograph: transparent, or the blank white of a service outside its sheets. */
export const blankShare = (img: { readonly rgb: Uint8Array; readonly empty: Uint8Array }): number => {
  let blank = 0;
  for (let i = 0; i < img.empty.length; i++) if (img.empty[i] || (img.rgb[i * 3] === 255 && img.rgb[i * 3 + 1] === 255 && img.rgb[i * 3 + 2] === 255)) blank++;
  return img.empty.length ? blank / img.empty.length : 1;
};

const blankMemo = new WeakMap<Tile, boolean>();
export const isBlank = (t: Tile): boolean => {
  let b = blankMemo.get(t);
  if (b === undefined) blankMemo.set(t, (b = blankShare(t) > BLANK_MAX));
  return b;
};

/**
 * The flights' tiles a sample's colour may be read from, the current image first: a blank one is
 * no flight, so it is left out rather than averaged in as white paving. Without the current image
 * (the leaf-off ground under the crowns) none.
 */
export const usableTiles = <T extends Tile>(tiles: readonly T[]): T[] => (tiles.length && !isBlank(tiles[0]!) ? tiles.filter((t) => !isBlank(t)) : []);

/** The tile's pixel holding a grid point, or -1 off it or where it has no image. */
export const pixelAt = (t: Tile, g: Puwg): number => {
  const m = t.meta;
  const col = Math.floor(((g.e - m.box.minE) / (m.box.maxE - m.box.minE)) * m.width);
  const row = Math.floor(((m.box.maxN - g.n) / (m.box.maxN - m.box.minN)) * m.height);
  if (col < 0 || row < 0 || col >= m.width || row >= m.height) return -1;
  const i = row * m.width + col;
  return t.empty[i] ? -1 : i;
};
