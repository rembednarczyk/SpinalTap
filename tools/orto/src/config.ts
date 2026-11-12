/**
 * The orthophoto tool's settings (ADR-0077): the PZGiK WMS services, the cache outside the
 * repository, the map cells it covers (the importer's chunks) and the cover grid.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_CHUNKS, DISTRICTS } from "../../osm-import/src/config.ts";
import type { Rect } from "../../osm-import/src/geometry.ts";

/** Repository root: the tool lives in `tools/orto/src`. */
export const REPO = fileURLToPath(new URL("../../../", import.meta.url));
/** Where the cover rasters are committed. */
export const COVER_DIR = join(REPO, "data/orto");

/** WMS of the orthophoto, the high resolution first (10 cm or better), the standard one where it has no image. */
export const WMS_SERVICES = [
  { id: "HighResolution", url: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/HighResolution" },
  { id: "StandardResolution", url: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution" },
] as const;
/** The archive (WMS with a `TIME` dimension, ISO 8601, monthly): an image of a chosen flight, e.g. a summer one. */
export const WMS_TIME_SERVICE = { id: "StandardResolutionTime", url: "https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolutionTime" } as const;

/**
 * The flights the cover is made of, each a cache folder. The current image (HighResolution: the
 * newest sheet of the finest pixel, by the sheet index of 11.11.2026 the flight of 12.04.2025, 5 cm,
 * leaves not yet out) shows the ground under the trees; two summer flights from the archive show the
 * lawns green. A sample's greenness is their mean (`classify.ts`), tuned on the truth: one flight
 * alone reaches 67% (April) to 85% (June, September) agreement, the three 90% (`thresholds.ts`).
 */
export interface Flight {
  readonly id: string;
  /** The archive's `TIME`; none for the current image. */
  readonly time?: string;
  /** The sheet index's years to look the tile's sheet up in (`sheets.ts`). */
  readonly indexYears: readonly number[];
}

export const FLIGHTS: readonly Flight[] = [
  { id: "2025-04", indexYears: [2026, 2025] },
  { id: "2024-06", time: "2024-06-01T00:00:00.000Z", indexYears: [2024] },
  { id: "2023-09", time: "2023-09-01T00:00:00.000Z", indexYears: [2023] },
];

export const WMS_LAYER = "Raster";
export const USER_AGENT = "SekiSenshi-topo/1.0";
/** Pause between two requests (ms): one at a time, never retried after HTTP 429. */
export const PAUSE_MS = 2500;
/** Ground size of an orthophoto pixel requested (m). */
export const ORTHO_STEP = 0.25;
/** The service's largest image side (GetCapabilities: MaxWidth, MaxHeight). */
export const MAX_SIDE = 4096;
/** The tile is fetched this far round its cell (m), so the cover's edge samples have pixels. */
export const TILE_MARGIN = 3;

/** The cover grid (m): a sample is the middle of a cell, as the glitch scan's `landuse-bare`. */
export const COVER_STEP = 0.5;

export const defaultCache = (): string => process.env.SEKI_ORTO_CACHE ?? join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "seki-orto");

export interface CellSpec {
  readonly id: string;
  /** The district's file slug: `data/orto/<slug>.cover.png`. */
  readonly slug: string;
  readonly rect: Rect;
}

export const CELLS: readonly CellSpec[] = ALL_CHUNKS.map((c) => ({ id: c.id, slug: c.district.slug, rect: c.rect }));

export const DISTRICT_RECTS: readonly { readonly slug: string; readonly rect: Rect }[] = DISTRICTS.map((d) => ({ slug: d.slug, rect: d.rect }));

export const cellById = (id: string): CellSpec => {
  const c = CELLS.find((x) => x.id === id);
  if (!c) throw new Error(`no cell ${id}; cells: ${CELLS.map((x) => x.id).join(", ")}`);
  return c;
};
