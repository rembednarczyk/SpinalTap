/**
 * The height of what stands over the ground (ADR-0077 step 1.5, audit 14.11 gap 4): GUGiK NMPT
 * 0.5 m (the surface model, WCS `DSM_PL-EVRF2007-NH`) less the NMT under it (`data/terrain`), for
 * every district of the map, so the import can size each tree by the crown over its node. The
 * coverage in PL-EVRF2007-NH is the later scan: the one in PL-KRON86-NH, like the NMT, is older and
 * has bare ground where Plac Litewski has had young trees since its rebuilding (probe of 14.11: 0.2 m
 * against 6.3 m over the same square), so the heights are moved to the NMT's datum by `DATUM`.
 *
 * - `pnpm gugik:nmpt` fetches the surface model in tiles of `TILE` m on a fixed PUWG grid into the
 *   cache outside the repo (`nmpt-fetch.ts`), then reduces it (`nmpt-extract.ts`) to the committed
 *   extract `data/gugik/nmpt/<district>.{json,bin}`.
 * - The extract is a 1 m grid in PUWG 1992 over the district's rectangle grown by `MARGIN`: each
 *   cell the highest of its four 0.5 m cells of NMPT less the NMT at that cell's centre, in steps of
 *   `CHM_STEP` m as one byte (0 at or under the ground, `NO_DATA` where the surface model has none).
 *   The same cache and NMT give the same bytes.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS, type DistrictSpec } from "../../osm-import/src/config.ts";
import { type Dtm, type DtmHeader, dtmAtGrid, dtmFromBytes } from "../../osm-import/src/dtm.ts";
import { type Pt } from "../../osm-import/src/geometry.ts";
import { REPO } from "../../osm-import/src/paths.ts";
import { type Puwg, puwgFrame, worldToPuwg } from "../../osm-import/src/project.ts";
import { CACHE_DIR } from "./sources.ts";

/** The WCS of the surface model (heights PL-EVRF2007-NH). */
export const NMPT_WCS =
  "https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMPT/GRID1/WCS/DigitalSurfaceModel?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=DSM_PL-EVRF2007-NH&FORMAT=image/x-aaigrid";
/**
 * PL-EVRF2007-NH less PL-KRON86-NH over the map (m): the median of NMPT less NMT over the cells
 * of bare ground (within 0.5 m of the NMT) of each district, 0.14 to 0.155 m (probe of 14.11).
 */
export const DATUM = 0.15;
/** Side of a fetched tile (m) on the PUWG grid: 500 × 500 cells of 0.5 m. */
export const TILE = 250;
/** The surface model's cell (m). */
export const DSM_STEP = 0.5;
/** How far past a district's rectangle the extract reaches (m): a tree on its edge sees its whole crown. */
export const MARGIN = 10;
/** One byte of the extract (m). */
export const CHM_STEP = 0.2;
export const NO_DATA = 255;
const TOP = 254;

export const NMPT_CACHE = join(CACHE_DIR, "nmpt");
export const NMPT_DIR = join(REPO, "data/gugik/nmpt");

/** The URL of the tile whose south-west corner is (e, n). */
export const tileUrl = (e: number, n: number): string => `${NMPT_WCS}&SUBSET=x(${e},${e + TILE})&SUBSET=y(${n},${n + TILE})`;
/** The cache file of that tile: float32 little-endian, row 0 north. */
export const tileFile = (e: number, n: number): string => join(NMPT_CACHE, `nmpt-evrf-${e}-${n}.f32`);

/** A PUWG box in whole metres: west, east, south, north edges. */
export interface Box {
  readonly e0: number;
  readonly e1: number;
  readonly n0: number;
  readonly n1: number;
}

/** The PUWG box (whole metres) around a district's rectangle grown by `MARGIN`. */
export const districtBox = (d: DistrictSpec): Box => {
  const r = d.rect;
  const corners: Puwg[] = (
    [
    { x: r.minX - MARGIN, z: r.minZ - MARGIN },
    { x: r.maxX + MARGIN, z: r.minZ - MARGIN },
    { x: r.minX - MARGIN, z: r.maxZ + MARGIN },
      { x: r.maxX + MARGIN, z: r.maxZ + MARGIN },
    ] as const
  ).map((p) => worldToPuwg(p));
  return {
    e0: Math.floor(Math.min(...corners.map((c) => c.e))),
    e1: Math.ceil(Math.max(...corners.map((c) => c.e))),
    n0: Math.floor(Math.min(...corners.map((c) => c.n))),
    n1: Math.ceil(Math.max(...corners.map((c) => c.n))),
  };
};

/** South-west corners of the tiles of the fixed grid that cover a box, west to east, south to north. */
export const tilesOf = (b: Box): { e: number; n: number }[] => {
  const out: { e: number; n: number }[] = [];
  for (let n = Math.floor(b.n0 / TILE) * TILE; n < b.n1; n += TILE) for (let e = Math.floor(b.e0 / TILE) * TILE; e < b.e1; e += TILE) out.push({ e, n });
  return out;
};

/** An ESRI ASCII grid, row 0 north. */
export interface AsciiGrid {
  readonly cols: number;
  readonly rows: number;
  /** West and south edges. */
  readonly xll: number;
  readonly yll: number;
  readonly cell: number;
  /** NaN where the grid has no data. */
  readonly values: Float32Array;
}

/**
 * The grid of a WCS answer in `image/x-aaigrid`: the bare grid or the multipart answer of the
 * geoportal (the grid part, then a `.prj` part). Anything not a whole grid is refused, so a
 * changed answer shows up instead of a hole in the extract.
 */
export const parseAsciiGrid = (text: string): AsciiGrid => {
  const at = text.search(/^ncols\b/im);
  if (at < 0) throw new Error("no ESRI ASCII grid in the answer");
  const lines = text.slice(at).split(/\r?\n/);
  const head: Record<string, number> = {};
  let k = 0;
  for (; k < lines.length; k++) {
    const m = /^\s*([a-z_]+)\s+(-?[\d.eE+-]+)\s*$/i.exec(lines[k]!);
    if (!m) break;
    head[m[1]!.toLowerCase()] = Number(m[2]);
  }
  const cols = head.ncols ?? 0;
  const rows = head.nrows ?? 0;
  const xll = head.xllcorner ?? head.xllcenter;
  const yll = head.yllcorner ?? head.yllcenter;
  const cell = head.cellsize;
  if (!cols || !rows || xll === undefined || yll === undefined || !cell) throw new Error("incomplete ESRI ASCII grid header");
  const nodata = head.nodata_value;
  const values = new Float32Array(cols * rows);
  let i = 0;
  for (; k < lines.length && i < values.length; k++) {
    const line = lines[k]!.trim();
    if (!line) continue;
    if (line.startsWith("--")) break;
    for (const t of line.split(/\s+/)) {
      const v = Number(t);
      values[i++] = !Number.isFinite(v) || v === nodata ? Number.NaN : v;
    }
  }
  if (i !== values.length) throw new Error(`ESRI ASCII grid: ${i} of ${values.length} values`);
  return { cols, rows, xll, yll, cell, values };
};

/** The extract's header (`<district>.json`). */
export interface ChmHeader {
  readonly source: string;
  readonly of: string;
  readonly crs: "EPSG:2180";
  /** West edge of column 0 and north edge of row 0. */
  readonly e0: number;
  readonly n0: number;
  readonly cols: number;
  readonly rows: number;
  readonly step: 1;
  readonly scale: number;
  readonly noData: number;
}

export interface Chm {
  readonly header: ChmHeader;
  readonly cells: Uint8Array;
}

/** One byte of a height over the ground (m); NaN as `NO_DATA`. */
export const encodeChm = (h: number): number => (Number.isNaN(h) ? NO_DATA : h <= 0 ? 0 : Math.min(TOP, Math.round(h / CHM_STEP)));

/**
 * The extract over `box`: each 1 m cell the highest of its four 0.5 m cells of `dsm` less `dtm` at
 * that cell's centre (both by PUWG easting and northing, NaN without data).
 */
export const reduceChm = (box: Box, dsm: (e: number, n: number) => number, dtm: (e: number, n: number) => number): Chm => {
  const cols = box.e1 - box.e0;
  const rows = box.n1 - box.n0;
  const cells = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let top = Number.NaN;
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const e = box.e0 + c + DSM_STEP * (i + 0.5);
          const n = box.n1 - r - DSM_STEP * (j + 0.5);
          const h = dsm(e, n) - DATUM - dtm(e, n);
          if (!Number.isNaN(h) && !(h <= top)) top = h;
        }
      }
      cells[r * cols + c] = encodeChm(top);
    }
  }
  const header: ChmHeader = {
    source: "GUGiK NMPT 0.5 m (geoportal.gov.pl, WCS DSM_PL-EVRF2007-NH) less DATUM less GUGiK NMT 1 m (data/terrain, PL-KRON86-NH)",
    of: "the highest of the four 0.5 m cells of NMPT less NMT, m over the ground",
    crs: "EPSG:2180",
    e0: box.e0,
    n0: box.n1,
    cols,
    rows,
    step: 1,
    scale: CHM_STEP,
    noData: NO_DATA,
  };
  return { header, cells };
};

/** A district's NMT as read by the extract (`data/terrain`), or null without it. */
export const loadDistrictDtm = (slug: string, root = REPO): Dtm | null => {
  const head = join(root, "data/terrain", `${slug}.json`);
  if (!existsSync(head)) return null;
  return { header: JSON.parse(readFileSync(head, "utf8")) as DtmHeader, cells: dtmFromBytes(new Uint8Array(readFileSync(join(root, "data/terrain", `${slug}.bin`)))) };
};

/** The districts' extracts that are in `data/gugik/nmpt` (none without them). */
export const loadChms = (root = REPO): Chm[] =>
  DISTRICTS.flatMap((d) => {
    const head = join(root, "data/gugik/nmpt", `${d.slug}.json`);
    if (!existsSync(head)) return [];
    return [{ header: JSON.parse(readFileSync(head, "utf8")) as ChmHeader, cells: new Uint8Array(readFileSync(join(root, "data/gugik/nmpt", `${d.slug}.bin`))) }];
  });

/** The height over the ground of the cell holding (e, n) in the first extract that has one (m), NaN without. */
export const chmAt = (chms: readonly Chm[], e: number, n: number): number => {
  for (const { header: h, cells } of chms) {
    const c = Math.floor(e - h.e0);
    const r = Math.floor(h.n0 - n);
    if (c < 0 || r < 0 || c >= h.cols || r >= h.rows) continue;
    const v = cells[r * h.cols + c]!;
    if (v !== h.noData) return v * h.scale;
  }
  return Number.NaN;
};

/** The NMT of a district at a PUWG point, NaN off it (`dtmAtGrid`). */
export const dtmAt = (d: Dtm) => (e: number, n: number): number => dtmAtGrid(d, { e, n });

const FRAME = puwgFrame();
const GAMMA = (FRAME.gammaDeg * Math.PI) / 180;

/** A PUWG offset (m) as a world one, by the local similarity (exact to a millimetre over a few metres). */
const toWorld = (de: number, dn: number): Pt => ({
  x: (Math.cos(GAMMA) * de + Math.sin(GAMMA) * dn) / FRAME.scale,
  z: (-Math.sin(GAMMA) * de + Math.cos(GAMMA) * dn) / FRAME.scale,
});

/**
 * The highest height over the ground in the extract's cells whose centres lie within `radius` of
 * the world point p, leaving out those `blocked` says no to (by the cell centre's world point): the
 * crown over a tree's node, off the roofs. Null where no cell is left.
 */
export const highestAround = (chms: readonly Chm[], p: Pt, radius: number, blocked: (q: Pt) => boolean): number | null => {
  const g = worldToPuwg(p);
  let top: number | null = null;
  for (let n = Math.floor(g.n - radius); n <= Math.ceil(g.n + radius); n++) {
    for (let e = Math.floor(g.e - radius); e <= Math.ceil(g.e + radius); e++) {
      const [de, dn] = [e + 0.5 - g.e, n + 0.5 - g.n];
      if (de * de + dn * dn > radius * radius) continue;
      const h = chmAt(chms, e + 0.5, n + 0.5);
      if (Number.isNaN(h) || (top !== null && h <= top)) continue;
      const o = toWorld(de, dn);
      if (blocked({ x: p.x + o.x, z: p.z + o.z })) continue;
      top = h;
    }
  }
  return top;
};
