/**
 * Time gate of the unit tests (ADR-0046, user decision 12.11): a test file of a pull request that
 * runs more than 50% and more than 2 s longer than the same file on main gets a warning. Not a red
 * test: the times come from shared CI runners. Pure functions, no clock: the times come in.
 */

/** Time of one test file, ms: the whole (import and tests) and the import part of it. */
export interface FileTime {
  readonly ms: number;
  readonly importMs: number;
}

/** What one shard writes (`reporter.ts`): test file path relative to the root, its time. */
export interface TimesFile {
  readonly files: Readonly<Record<string, FileTime>>;
}

export type Times = Readonly<Record<string, FileTime>>;

/**
 * Slower by more than half. Together with the absolute floor: a 0.2 s file at 0.4 s is +100% and
 * means nothing, so the relative limit alone would warn on noise.
 */
export const RELATIVE_LIMIT = 0.5;

/**
 * And by more than 2 s. Small files take 0.1-1 s and jump by a second from one run to the next on
 * a shared runner; a file that imports the city tables (`content/lublin/*.generated.ts`) pays
 * about 5 s for the import when its worker has not loaded them yet (docs/plany/czas-testow.md).
 * A real slowdown worth a look (a new full city `generate`, a loop played longer) costs seconds.
 */
export const ABSOLUTE_LIMIT_MS = 2000;

export const SLOWEST_COUNT = 10;

export interface Slower {
  readonly file: string;
  readonly base: FileTime;
  readonly head: FileTime;
}

export interface Comparison {
  /** Files over both limits, the largest absolute slowdown first. */
  readonly slower: readonly Slower[];
  /** The slowest files of the pull request, with the main time when there is one. */
  readonly slowest: readonly { readonly file: string; readonly head: FileTime; readonly base: FileTime | undefined }[];
  readonly headTotalMs: number;
  /** Sum on main over every file of main; undefined without a reference run. */
  readonly baseTotalMs: number | undefined;
  /** Files with no time on main (new, renamed, or no reference at all): never a warning. */
  readonly newFiles: number;
}

/** Times of the shards in one set; a file in two shards (never, by Vitest's split) keeps the last. */
export const mergeTimes = (shards: readonly TimesFile[]): Times => Object.assign({}, ...shards.map((s) => s.files)) as Times;

const sum = (t: Times): number => Object.values(t).reduce((s, f) => s + f.ms, 0);

export const isSlower = (base: FileTime, head: FileTime): boolean =>
  head.ms - base.ms > ABSOLUTE_LIMIT_MS && head.ms > base.ms * (1 + RELATIVE_LIMIT);

/** Compare the pull request (`head`) with main (`base`, undefined when no reference run was found). */
export const compareTimes = (base: Times | undefined, head: Times): Comparison => {
  const files = Object.keys(head).sort();
  const slower = files
    .flatMap((file): Slower[] => {
      const b = base?.[file];
      return b && isSlower(b, head[file]!) ? [{ file, base: b, head: head[file]! }] : [];
    })
    .sort((x, y) => y.head.ms - y.base.ms - (x.head.ms - x.base.ms) || x.file.localeCompare(y.file));
  const slowest = [...files]
    .sort((x, y) => head[y]!.ms - head[x]!.ms || x.localeCompare(y))
    .slice(0, SLOWEST_COUNT)
    .map((file) => ({ file, head: head[file]!, base: base?.[file] }));
  return {
    slower,
    slowest,
    headTotalMs: sum(head),
    baseTotalMs: base ? sum(base) : undefined,
    newFiles: files.filter((f) => !base?.[f]).length,
  };
};

const s = (ms: number): string => (ms / 1000).toFixed(1);
const pct = (base: number, head: number): string => (base > 0 ? `${head >= base ? "+" : ""}${Math.round(((head - base) / base) * 100)}%` : "new");

/** One `::warning` line per slower file, for the GitHub log and the pull request annotations. */
export const warnings = (c: Comparison): string[] =>
  c.slower.map(
    (x) =>
      `::warning file=${x.file},title=Slower test file::${x.file}: ${s(x.base.ms)} s on main -> ${s(x.head.ms)} s (${pct(x.base.ms, x.head.ms)}; import ${s(x.base.importMs)} -> ${s(x.head.importMs)} s). Warning only, ADR-0046.`,
  );

/** Markdown for `$GITHUB_STEP_SUMMARY`. `reference` names the main run compared with. */
export const summary = (c: Comparison, reference: string | undefined): string => {
  const lines = ["## Unit test time", ""];
  const total = c.baseTotalMs === undefined ? `${s(c.headTotalMs)} s` : `${s(c.headTotalMs)} s (main ${s(c.baseTotalMs)} s, ${pct(c.baseTotalMs, c.headTotalMs)})`;
  lines.push(`Sum over test files: ${total}. Reference: ${reference ?? "none found, nothing compared"}.`);
  lines.push(`Limit: more than ${RELATIVE_LIMIT * 100}% and more than ${s(ABSOLUTE_LIMIT_MS)} s slower than main. New files: ${c.newFiles}.`, "");
  if (c.slower.length > 0) {
    lines.push(`### Slower than main (${c.slower.length})`, "", "| File | main [s] | now [s] | change | import main / now [s] |", "|---|---:|---:|---:|---:|");
    for (const x of c.slower) lines.push(`| ${x.file} | ${s(x.base.ms)} | ${s(x.head.ms)} | ${pct(x.base.ms, x.head.ms)} | ${s(x.base.importMs)} / ${s(x.head.importMs)} |`);
    lines.push("");
  } else if (reference) lines.push("No test file over the limit.", "");
  lines.push(`### Slowest ${c.slowest.length}`, "", "| File | now [s] | import [s] | main [s] |", "|---|---:|---:|---:|");
  for (const x of c.slowest) lines.push(`| ${x.file} | ${s(x.head.ms)} | ${s(x.head.importMs)} | ${x.base ? s(x.base.ms) : "-"} |`);
  return `${lines.join("\n")}\n`;
};
