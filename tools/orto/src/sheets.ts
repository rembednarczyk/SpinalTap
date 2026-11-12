/**
 * Which sheet of the orthophoto a tile shows (ADR-0077): the WMS gives no date, the sheet index
 * (`SkorowidzeWgAktualnosci`, GetFeatureInfo at the tile's middle) does. Its answer is an HTML page
 * with the sheets as `skorDo5cm.push({…})` records: read as text, never run.
 */
import { type GridBox } from "./tiles.ts";

export const SHEET_INDEX = "https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/SkorowidzeWgAktualnosci";

export interface Sheet {
  /** Map sheet (godło), e.g. `M-34-34-A-c-1-2`. */
  readonly sheet: string;
  /** Day of the flight (YYYY-MM-DD). */
  readonly date: string;
  /** Ground pixel (m). */
  readonly pixel: number;
  readonly colour: string;
}

/** The index's layer for a flight's year: one a year from 2024, older ones together. */
export const indexLayer = (year: number): string => (year >= 2024 ? `SkorowidzeOrtofotomapy${year}` : "SkorowidzeOrtofotomapyStarsze");

export const featureInfoUrl = (layer: string, box: GridBox): string => {
  const [e, n] = [(box.minE + box.maxE) / 2, (box.minN + box.maxN) / 2];
  return `${SHEET_INDEX}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=${layer}&QUERY_LAYERS=${layer}&STYLES=&CRS=EPSG:2180&BBOX=${n - 10},${e - 10},${n + 10},${e + 10}&WIDTH=10&HEIGHT=10&I=5&J=5&INFO_FORMAT=text/html&FEATURE_COUNT=50`;
};

/** The sheets an index page lists. */
export const parseSheets = (html: string): Sheet[] => {
  const out: Sheet[] = [];
  for (const m of html.matchAll(/push\(\{([^}]*)\}\)/g)) {
    const f = Object.fromEntries([...m[1]!.matchAll(/(\w+):"([^"]*)"/g)].map((x) => [x[1]!, x[2]!]));
    if (f.godlo && f.aktualnosc && f.wielkoscPiksela) out.push({ sheet: f.godlo, date: f.aktualnosc, pixel: Number(f.wielkoscPiksela), colour: f.kolor ?? "" });
  }
  return out;
};

/**
 * The colour sheet a flight shows: of the month asked for (`YYYY-MM`), or for the current image the
 * one the high-resolution service puts on top (the finest pixel, then the newest).
 */
export const sheetOf = (sheets: readonly Sheet[], month?: string): Sheet | undefined =>
  sheets
    .filter((s) => s.colour === "RGB" && (!month || s.date.startsWith(month)))
    .sort((a, b) => a.pixel - b.pixel || b.date.localeCompare(a.date))[0];
