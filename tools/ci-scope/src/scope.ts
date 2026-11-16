/**
 * What a pull request's CI runs (ADR-0046, decision of the user 16.11): a pull request runs the
 * checks that are cheap (typecheck, lint, architecture) always, the unit tests related to its
 * files by Vitest's import graph (`vitest related`) and e2e only when it touches what a browser
 * draws. A push to main and the nightly run run everything (`fullScope`). Pure functions: the
 * changed files and the repository's test files come in, `cli.ts` reads them and writes the outputs.
 */

/** `full`: every test with coverage; `related`: `vitest related <unitFiles>`; `none`: no unit job. */
export type UnitScope = "full" | "related" | "none";

export interface Scope {
  /** Anything but docs changed: the checks run (a change of docs alone runs nothing, as before). */
  readonly code: boolean;
  /** The map tables' generators, their data or the tables changed: job "Map tables" (ADR-0083). */
  readonly tables: boolean;
  readonly e2e: boolean;
  readonly unit: UnitScope;
  /** For `related`: the files `vitest related` takes (sources, and test files that run as they are). */
  readonly unitFiles: readonly string[];
  /** Why the scope is what it is, one line a rule that fired, for the run's log and summary. */
  readonly reasons: readonly string[];
}

/** A change of docs alone (as `ci.yml` had it before): no job runs. */
/** The JSON in `docs/` is data that tests and the generators read (the coverage register, the furniture's list), not docs. */
export const DOCS = /^(docs\/|changelog\.d\/)(?!.*\.json$)|\.md$/;

/** The tables' generators, their data and the tables (job "Map tables", unchanged from `ci.yml`). */
export const TABLES = /^(tools\/osm-import\/|tools\/orto\/|data\/|packages\/sim\/src\/content\/lublin\/)/;

/** Files every job depends on: dependencies, compiler settings, the workflows. Everything runs. */
export const SHARED: readonly RegExp[] = [
  /^\.github\//,
  /(^|\/)package\.json$/,
  /^pnpm-(lock|workspace)\.yaml$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /^\.(npmrc|nvmrc|node-version)$/,
];

/**
 * Every unit test, but no e2e: the test runner's settings, the CI's own tools (the reporter of the
 * unit shards, this selector), and `data/`, which tests read from disk past the import graph
 * (`tools/glitch-scan`, `tools/osm-import`).
 */
export const UNIT_FULL: readonly RegExp[] = [/(^|\/)vitest\.(config|workspace)\.[^/]+$/, /^tools\/(test-time|ci-scope)\//, /^data\//];

/** What a browser draws: e2e runs. */
export const E2E: readonly RegExp[] = [
  /^packages\/(engine|app|ui)\//,
  /^e2e\//,
  /^playwright\.config\.ts$/,
  /^packages\/sim\/src\/content\/lublin\/[^/]+\.generated\.ts$/,
  /^tools\/perf-budgets\.json$/,
  /^tools\/assets\//,
];

/** Code with no unit test: the lint, typecheck and architecture checks are enough. */
export const NO_UNIT: readonly RegExp[] = [
  /^e2e\//,
  /^playwright\.config\.ts$/,
  /^\.claude\//,
  /^(eslint\.config\.js|dependency-cruiser\.config\.cjs|render\.yaml|\.gitignore|\.gitattributes)$/,
  /^tools\/[^/]+\.(sh|mjs|json)$/,
];

/** Files that tests read from disk (models, sources of assets, their generators): the tests of these packages run. */
export const READ_BY: readonly { readonly files: RegExp; readonly tests: readonly string[] }[] = [
  { files: /^(packages\/app\/public\/|tools\/assets\/|tools\/[^/]+\.py$)/, tests: ["packages/app/", "packages/engine/"] },
];

/** Tests that scan the sources of every package (ADR-0056 i18n, ADR-0031 god objects): any change of code runs them. */
export const CROSS_CUTTING: readonly string[] = ["tools/i18n-scan/", "tools/code-health/"];

const CODE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const PACKAGE = /^(packages|tools)\/[^/]+\//;

const any = (patterns: readonly RegExp[], file: string): boolean => patterns.some((p) => p.test(file));

/** Everything, as a push to main, the nightly run and a run started by hand. */
export const fullScope = (reason: string): Scope => ({ code: true, tables: true, e2e: true, unit: "full", unitFiles: [], reasons: [reason] });

/** A push to main: everything, unless it changed docs alone (no job runs, as before). */
export const pushScope = (changed: readonly string[]): Scope =>
  changed.some((f) => !DOCS.test(f)) ? fullScope("push to main: everything") : { code: false, tables: false, e2e: false, unit: "none", unitFiles: [], reasons: ["docs only: nothing runs"] };

/** Every unit test with coverage and every e2e group: a pull request's run that stands for main's (`ci.yml`, job "What changed"). */
export const isFull = (s: Scope): boolean => s.unit === "full" && s.e2e;

const testsUnder = (testFiles: readonly string[], dirs: readonly string[]): string[] => testFiles.filter((t) => dirs.some((d) => t.startsWith(d)));

/** The pull request's scope from its changed files and the repository's test files (paths from the root, `/`). */
export const scope = (changed: readonly string[], testFiles: readonly string[]): Scope => {
  const code = changed.filter((f) => !DOCS.test(f));
  const tables = code.some((f) => TABLES.test(f));
  if (code.length === 0) return { code: false, tables: false, e2e: false, unit: "none", unitFiles: [], reasons: ["docs only: nothing runs"] };
  const shared = code.filter((f) => any(SHARED, f));
  if (shared.length > 0) return { ...fullScope(`shared files: ${shared.join(", ")}`), tables };
  const reasons: string[] = [];
  const e2eBy = code.filter((f) => any(E2E, f));
  if (e2eBy.length > 0) reasons.push(`e2e: ${e2eBy.join(", ")}`);
  else reasons.push("no e2e: nothing a browser draws changed");
  const fullBy = code.filter((f) => any(UNIT_FULL, f));
  if (fullBy.length > 0) return { code: true, tables, e2e: e2eBy.length > 0, unit: "full", unitFiles: [], reasons: [`every unit test: ${fullBy.join(", ")}`, ...reasons] };
  const sources = new Set<string>();
  const dirs = new Set<string>();
  const unknown: string[] = [];
  for (const f of code) {
    if (any(NO_UNIT, f)) continue;
    const read = READ_BY.filter((r) => r.files.test(f));
    for (const r of read) for (const d of r.tests) dirs.add(d);
    const pkg = PACKAGE.exec(f)?.[0];
    if (pkg && CODE.test(f)) sources.add(f);
    else if (pkg) dirs.add(pkg); // read from disk past the import graph (baselines, ink, JSON): the package's tests
    else if (read.length === 0) unknown.push(f);
  }
  if (unknown.length > 0) return { code: true, tables, e2e: true, unit: "full", unitFiles: [], reasons: [`files of no known area, everything: ${unknown.join(", ")}`] };
  if (code.some((f) => PACKAGE.test(f) && !any(NO_UNIT, f))) for (const d of CROSS_CUTTING) dirs.add(d);
  const unitFiles = [...new Set([...sources, ...testsUnder(testFiles, [...dirs])])].sort();
  if (unitFiles.length === 0) return { code: true, tables, e2e: e2eBy.length > 0, unit: "none", unitFiles: [], reasons: ["no unit test: no changed file has one", ...reasons] };
  return { code: true, tables, e2e: e2eBy.length > 0, unit: "related", unitFiles, reasons: [`unit tests related to ${unitFiles.length} file(s)`, ...reasons] };
};
