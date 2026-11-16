/**
 * Which part of the city a pull request's glitch scan compares (`tools/glitch-scan/test/glitch-scan.test.ts`,
 * ADR-0054, decision of the user 16.11): the scan reads the map tables, its own code and the
 * generators' and the sources' files; a pull request that changes only the tables of some districts
 * (`packages/sim/src/content/lublin/<district>.generated.ts`) compares the keys of those districts'
 * chunks and their neighbours (`GLITCH_SCAN_CHUNKS`, `tools/glitch-scan/src/scan-chunks.ts`); a change
 * of anything else the scan reads compares the whole city; a change of nothing it reads does not
 * touch it (and `vitest related` does not run it). Pure: the changed files and what the scan reads come in.
 */

/** `full`: the whole city; `chunks`: the districts in `scanChunks`; `none`: nothing the scan reads changed. */
export type ScanScope = "full" | "chunks" | "none";

export interface GlitchScan {
  readonly scan: ScanScope;
  /** For `chunks`: the districts whose tables changed, the names of their table files (sorted). */
  readonly scanChunks: readonly string[];
  readonly reason: string;
}

/** A district's table: its chunks' ground, buildings and ways, one file a district (ADR-0083). */
export const CHUNK_TABLE = /^packages\/sim\/src\/content\/lublin\/([a-z0-9-]+)\.generated\.ts$/;

/** Tables of every chunk in one file (the street furniture, `pnpm osm:props`): a change of them compares the whole city. */
export const SHARED_TABLES: ReadonlySet<string> = new Set(["props"]);

/**
 * What the scan reads from disk past its imports (`readFileSync` in the scan, the import's and the
 * orthophoto's code): the sources (`data/`), the coverage register and the furniture's list in
 * `docs/`, its own base and README. Its imports come from `imports.ts` (`scanReads`).
 */
export const SCAN_DISK: readonly RegExp[] = [/^data\//, /^docs\/mapa-pokrycie\.json$/, /^docs\/world\//, /^tools\/glitch-scan\//];

export const NO_SCAN: GlitchScan = { scan: "none", scanChunks: [], reason: "glitch scan: nothing it reads changed" };

/** The whole city: a push to main, the nightly run, every unit test of a pull request. */
export const fullScan = (reason: string): GlitchScan => ({ scan: "full", scanChunks: [], reason: `glitch scan: whole city (${reason})` });

const most = (files: readonly string[], n = 5) => `${files.slice(0, n).join(", ")}${files.length > n ? ` and ${files.length - n} more` : ""}`;

/** The scan's part from a pull request's changed files (not docs) and whether the scan reads a file. */
export const glitchScan = (code: readonly string[], reads: (file: string) => boolean): GlitchScan => {
  const read = code.filter((f) => reads(f) || SCAN_DISK.some((p) => p.test(f)));
  if (read.length === 0) return NO_SCAN;
  const chunks = new Set<string>();
  const other: string[] = [];
  for (const f of read) {
    const district = CHUNK_TABLE.exec(f)?.[1];
    if (district !== undefined && !SHARED_TABLES.has(district)) chunks.add(district);
    else other.push(f);
  }
  if (other.length > 0) return fullScan(`it reads ${most(other)}`);
  const scanChunks = [...chunks].sort();
  return { scan: "chunks", scanChunks, reason: `glitch scan: the chunks of ${scanChunks.join(", ")} and their neighbours (only their tables changed)` };
};
