/**
 * What `pnpm map:refresh` watches and the thresholds of its verdict (README.md). The thresholds are
 * a proposal of 14.11 (backlog, strategy point 3: a lighter process): below them a refresh needs
 * no curator's review.
 */

/** The files a refresh may change, by directory (recursive), repo paths. Caches are left out. */
export const WATCHED_DIRS = ["data/osm", "data/terrain", "data/gugik", "data/orto", "packages/sim/src/content/lublin"] as const;

/** Directories under the watched ones never compared (not committed). */
export const IGNORED_DIRS = ["data/osm/cache"] as const;

/** The city's tables (`pnpm osm:build`, `pnpm osm:props`): the objects are counted in these. */
export const TABLE_DIR = "packages/sim/src/content/lublin";
export const PROPS_TABLE = "props.generated.ts";

/** The glitch scan's base and the report of its last run. */
export const SCAN_BASE = "tools/glitch-scan/test/baseline";
export const SCAN_REPORT = "reports/glitch-scan.json";

/** Where the refresh writes its report, its logs and the steps' side files. */
export const OUT_DIR = "reports";
export const WORK_DIR = "reports/map-refresh";

export interface Thresholds {
  /** Share of all objects (chunk fields and props) that may come or go. */
  readonly objectsShare: number;
  /** A kind's change over `max(kindShare × before, kindMin)` objects is over the threshold. */
  readonly kindShare: number;
  readonly kindMin: number;
  /** m² of ground surface moved (the sum of |Δ area| over the surfaces, and orto:diff's changed m²). */
  readonly surfaceM2: number;
  /** m of the largest terrain shift (orto:diff). */
  readonly terrainM: number;
}

export const THRESHOLDS: Thresholds = { objectsShare: 0.02, kindShare: 0.02, kindMin: 2, surfaceM2: 1, terrainM: 0.05 };

/**
 * The scan's kinds whose new keys alone need no review (S4, cosmetic: ADR-0054). Every other kind
 * counts as S1–S3. A proposal: a kind joins only by a decision written in docs/glitches.md.
 */
export const S4_KINDS: ReadonlySet<string> = new Set(["lamp-style-change-on-way", "osm-tower-default-height", "levels-tag-lost", "kerb-fill-wide-estimated"]);

/** Who asks the services (ADR-0042, agents' rules): no user data. */
export const USER_AGENT = "SekiSenshi-topo/1.0";
