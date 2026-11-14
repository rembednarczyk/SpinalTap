import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { USER_AGENT } from "./config.ts";

/**
 * The steps of `pnpm map:refresh` in their order: fetch (network), extract (the caches outside the
 * repo into `data/`), build (the city's tables from `data/`), check (scan, hashes). A step that
 * cannot run says why; the plan is the same on every machine for the same options and files.
 */

export type Source = "osm" | "gugik" | "orto";
export const SOURCES: readonly Source[] = ["osm", "gugik", "orto"];
export type Group = "fetch" | "extract" | "build" | "check";

export interface Step {
  readonly id: string;
  readonly group: Group;
  readonly source?: Source;
  /** The command, run in the repo's root. */
  readonly cmd: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  /** A non-zero exit is a result, not a failure (the scan and the hashes say what they found by it). */
  readonly mayFail?: true;
}

export interface Planned {
  readonly step: Step;
  /** Why it does not run, or null. */
  readonly skip: string | null;
}

export interface PlanOptions {
  readonly offline: boolean;
  readonly sources: readonly Source[];
  /** Offline, the extract steps from the caches outside the repo, where they are. */
  readonly fromCache: boolean;
  readonly skip: ReadonlySet<string>;
}

const node = (script: string, ...args: string[]) => ["node", script, ...args];
/** Node's fetch through the proxy of the environment, when it has one. */
const NET = { NODE_USE_ENV_PROXY: "1" } as const;
const cacheHome = () => process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
const gugikCache = () => join(cacheHome(), "seki-gugik");
const ortoCache = () => process.env.SEKI_ORTO_CACHE ?? join(cacheHome(), "seki-orto");

export const STEPS: readonly Step[] = [
  { id: "osm-fetch", group: "fetch", source: "osm", cmd: node("tools/osm-import/src/fetch.ts", "--refresh"), env: NET },
  { id: "osm-hydrants", group: "fetch", source: "osm", cmd: node("tools/osm-import/src/fetch-hydrants.ts"), env: NET },
  { id: "osm-entrances", group: "fetch", source: "osm", cmd: node("tools/osm-import/src/fetch-entrances.ts"), env: NET },
  { id: "osm-trees", group: "fetch", source: "osm", cmd: node("tools/osm-import/src/fetch-trees.ts"), env: NET },
  { id: "gugik-fetch", group: "fetch", source: "gugik", cmd: node("tools/gugik/src/fetch.ts"), env: NET },
  { id: "orto-fetch", group: "fetch", source: "orto", cmd: node("tools/orto/src/fetch.ts", "--all"), env: NET },
  { id: "gugik-extract", group: "extract", source: "gugik", cmd: node("tools/gugik/src/extract.ts") },
  { id: "orto-build", group: "extract", source: "orto", cmd: node("tools/orto/src/build.ts") },
  { id: "osm-build", group: "build", cmd: node("tools/osm-import/src/build.ts", "--stats=reports/map-refresh/osm-build.json") },
  { id: "osm-props", group: "build", cmd: node("tools/osm-import/src/props.ts") },
  { id: "scan", group: "check", cmd: ["pnpm", "exec", "vitest", "run", "tools/glitch-scan/test/glitch-scan.test.ts"], env: { GLITCH_BASELINE: "" }, mayFail: true },
  { id: "hashes", group: "check", cmd: node("tools/hashes/src/check.ts", "--out", "reports/map-refresh/hashes.json"), mayFail: true },
];

/**
 * Why osm:fetch may not go online on this checkout, or null: it must send the agents' User-Agent
 * and stop at an HTTP 429 (fixed on main by this branch and by PR #550).
 */
export const osmFetchUnsafe = (root: string): string | null => {
  const config = readFileSync(join(root, "tools/osm-import/src/config.ts"), "utf8");
  const fetch = readFileSync(join(root, "tools/osm-import/src/fetch.ts"), "utf8");
  if (!config.includes(`USER_AGENT = "${USER_AGENT}"`)) return `osm:fetch wysyła inny User-Agent niż ${USER_AGENT}`;
  if (!fetch.includes("res.status === 429")) return "osm:fetch ponawia zapytanie po HTTP 429";
  return null;
};

/** Whether osm:fetch also writes `data/osm/points/furniture.json` (PR #550). */
export const osmFetchWritesFurniture = (root: string): boolean => readFileSync(join(root, "tools/osm-import/src/fetch.ts"), "utf8").includes("--points-only");

const extractSkip = (s: Step, o: PlanOptions): string | null => {
  if (o.offline && !o.fromCache) return "offline; z --from-cache z lokalnych pamięci podręcznych";
  const cache = s.source === "gugik" ? gugikCache() : ortoCache();
  return existsSync(cache) ? null : `brak pamięci podręcznej ${cache}`;
};

const skipOf = (root: string, s: Step, o: PlanOptions): string | null => {
  if (o.skip.has(s.id) || o.skip.has(s.group)) return "--skip";
  if (s.source && !o.sources.includes(s.source)) return `źródło ${s.source} poza --sources`;
  if (s.group === "fetch") {
    if (o.offline) return "offline";
    if (s.id === "osm-fetch") return osmFetchUnsafe(root);
  }
  if (s.group === "extract") return extractSkip(s, o);
  return null;
};

/** The steps for the options, each with why it is skipped. */
export const plan = (root: string, o: PlanOptions, steps: readonly Step[] = STEPS): Planned[] => steps.map((step) => ({ step, skip: skipOf(root, step, o) }));
