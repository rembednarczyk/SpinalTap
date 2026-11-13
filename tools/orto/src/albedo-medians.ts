/**
 * The committed medians of the import's surfaces on the orthophoto (`data/orto/albedo-medians.json`,
 * G-721, G-734): for each flight of `albedo-report.ts` the day photographed, and for each surface
 * the median RGB, its luma, the luma against the lawns' and the samples counted. Written by
 * `albedo-report.ts --write-medians`, read by the glitch scan's `paving-albedo-drift`, so the scan
 * checks the renderer's palette without the orthophoto cache. Small and deterministic: rounded
 * numbers, keys in order, no time of writing.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COVER_DIR } from "./config.ts";

export const MEDIANS_FILE = join(COVER_DIR, "albedo-medians.json");

export interface SurfaceMedian {
  readonly rgb: readonly [number, number, number];
  readonly luma: number;
  /** Luma against the lawns' (`grass`) in the same flight. */
  readonly toGrass: number;
  readonly samples: number;
}

export interface FlightMedians {
  /** The days the sheets under the map were photographed. */
  readonly photographed: readonly string[];
  readonly surfaces: Readonly<Record<string, SurfaceMedian>>;
}

export interface AlbedoMedians {
  readonly about: string;
  /** The flight the renderer's palette is calibrated on (`ground-plan.ts`): the current image. */
  readonly reference: string;
  readonly flights: Readonly<Record<string, FlightMedians>>;
}

export interface MedianRow {
  readonly surface: string;
  readonly median: readonly number[];
  readonly luma: number;
  readonly samples: number;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The file's content from the report's rows by flight, the first flight the reference. */
export const mediansOf = (flights: readonly { readonly id: string; readonly photographed: readonly string[]; readonly rows: readonly MedianRow[] }[]): AlbedoMedians => ({
  about: "Mediany barw nawierzchni importu na ortofoto PZGiK (tools/orto/src/albedo-report.ts --write-medians). Paleta renderera (ORTHO_PAVING w ground-plan.ts) i kontrola skanu paving-albedo-drift.",
  reference: flights[0]?.id ?? "",
  flights: Object.fromEntries(
    flights.map((f) => {
      const grass = f.rows.find((r) => r.surface === "grass")?.luma ?? 0;
      const surfaces = Object.fromEntries(
        [...f.rows]
          .filter((r) => r.samples > 0)
          .sort((a, b) => a.surface.localeCompare(b.surface))
          .map((r) => [r.surface, { rgb: r.median.map((v) => Math.round(v)) as unknown as [number, number, number], luma: Math.round(r.luma * 10) / 10, toGrass: grass ? r3(r.luma / grass) : 0, samples: r.samples }]),
      );
      return [f.id, { photographed: [...f.photographed].sort(), surfaces }];
    }),
  ),
});

export const mediansText = (m: AlbedoMedians): string => `${JSON.stringify(m, null, 2)}\n`;

export const readMedians = (file = MEDIANS_FILE): AlbedoMedians | undefined => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as AlbedoMedians) : undefined);
