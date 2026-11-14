/**
 * `data/orto/sources.json` (ADR-0077): where the covers come from and how they were made, so a
 * cover can be checked or made again: the services and layer, each flight and the sheets its tiles
 * show (the day of the photograph, its pixel), the days fetched, the classifier's version and
 * thresholds. The raw tiles stay in the cache outside the repository.
 */
import { join } from "node:path";
import { type Rect } from "../../osm-import/src/geometry.ts";
import { COVER_NAMES } from "./classify.ts";
import { COVER_DIR, COVER_STEP, FLIGHTS, ORTHO_STEP, USER_AGENT, WMS_LAYER, WMS_SERVICES, WMS_TIME_SERVICE } from "./config.ts";
import { type Sheet, SHEET_INDEX } from "./sheets.ts";
import { THRESHOLDS } from "./thresholds.ts";

export const MANIFEST = join(COVER_DIR, "sources.json");

/** Raised with any change to `classify.ts`, `thresholds.ts` or the sampling in `cover.ts`. */
export const CLASSIFIER_VERSION = 4;

export interface CoverEntry {
  readonly slug: string;
  readonly rect: Rect;
  readonly bytes: number;
  readonly cells: readonly string[];
  readonly tiles: readonly { readonly cell: string; readonly flight: string; readonly service: string; readonly fetched: string; readonly sheet?: Sheet }[];
  /** Samples by class. */
  readonly samples: Readonly<Record<string, number>>;
}

export const manifest = (covers: readonly CoverEntry[]) => ({
  about: "Pokrycie terenu z ortofotomapy PZGiK (ADR-0077): rastry data/orto/<obszar>.cover.png, narzędzie tools/orto. Atrybucja: data/osm/ATTRIBUTION.md.",
  license: "Ortofotomapa PZGiK (Główny Urząd Geodezji i Kartografii): udostępniana bezpłatnie, do dowolnego wykorzystania (art. 40a ustawy Prawo geodezyjne i kartograficzne), regulamin: https://www.geoportal.gov.pl/pl/o-geoportalu/regulamin/",
  services: { current: WMS_SERVICES, archive: WMS_TIME_SERVICE, sheetIndex: SHEET_INDEX, layer: WMS_LAYER, crs: "EPSG:2180", format: "image/png", userAgent: USER_AGENT },
  requestedPixel: ORTHO_STEP,
  flights: FLIGHTS.map((f) => {
    const sheets = covers.flatMap((c) => c.tiles.filter((t) => t.flight === f.id && t.sheet).map((t) => t.sheet!));
    const dates = [...new Set(sheets.map((s) => s.date))].sort();
    const pixels = [...new Set(sheets.map((s) => s.pixel))].sort();
    return { ...f, photographed: dates, sheetPixel: pixels, sheets: [...new Set(sheets.map((s) => s.sheet))].sort() };
  }),
  classifier: { version: CLASSIFIER_VERSION, grid: COVER_STEP, classes: COVER_NAMES, thresholds: THRESHOLDS },
  covers,
});
