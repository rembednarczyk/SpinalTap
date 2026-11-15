/**
 * The time gate of single tests (ADR-0083 step 2): a pull request fails when one of its tests takes
 * more than half of its time limit, or more than 30% longer than the median of the last green runs
 * of main. The slowdown fails in the pull request that brings it, with room left, before any test
 * runs into its limit in the next, innocent one (`props.test` on 15.11). Exceptions only by the
 * explicit list (`exceptions.ts`), each with its reason. Pure functions, no clock: the times come in.
 */

/** Time of one test (ms) and its limit (`timeout`, ms), as the shard ran it. */
export interface TestTime {
  readonly ms: number;
  readonly limitMs: number;
}

/** Tests by id: `<file> > <describe> > <test>`. */
export type TestTimes = Readonly<Record<string, TestTime>>;

/** A test of a file: an exception for the file holds for each of its tests. */
export const testId = (file: string, fullName: string): string => `${file} > ${fullName}`;

/** More than this share of its limit fails. */
export const LIMIT_SHARE = 0.5;

/** More than this much slower than the median of main fails... */
export const GROWTH = 0.3;

/**
 * ...when that is also more than 1 s: a 40 ms test at 60 ms is +50% of a shared runner's noise, and
 * a test that matters for the limit (seconds) grows by seconds when a rule makes it slower.
 */
export const GROWTH_FLOOR_MS = 1000;

/** How many green runs of main the median is taken over, at most (`ci.yml` downloads them). */
export const REFERENCE_RUNS = 5;

export interface Exception {
  /** A test's id (`testId`), or a test file for each of its tests. */
  readonly test: string;
  readonly reason: string;
}

export interface Breach {
  readonly test: string;
  readonly kind: "limit" | "growth";
  readonly head: TestTime;
  /** The median of main and over how many runs it is, for a growth. */
  readonly medianMs?: number;
  readonly runs?: number;
}

export interface Gate {
  /** Over a limit and in no exception: the run fails. */
  readonly breaches: readonly Breach[];
  /** Over a limit, but in the list of exceptions. */
  readonly excused: readonly (Breach & { readonly reason: string })[];
  /** Tests with a time on main to compare with. */
  readonly compared: number;
  /** Runs of main the medians come from. */
  readonly runs: number;
}

export const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** The median time of every test over the runs of main it ran in, with their number. */
export const medianTimes = (runs: readonly TestTimes[]): Map<string, { readonly ms: number; readonly runs: number }> => {
  const by = new Map<string, number[]>();
  for (const run of runs) for (const [id, t] of Object.entries(run)) by.set(id, [...(by.get(id) ?? []), t.ms]);
  return new Map([...by].map(([id, ms]) => [id, { ms: median(ms), runs: ms.length }]));
};

export const exceptionFor = (exceptions: readonly Exception[], test: string): Exception | undefined =>
  exceptions.find((e) => e.test === test || test.startsWith(`${e.test} > `));

/** The tests of the pull request (`head`) against their limits and the runs of main (`base`, newest first; none: the limits alone). */
export const gateTests = (head: TestTimes, base: readonly TestTimes[], exceptions: readonly Exception[]): Gate => {
  const medians = medianTimes(base);
  const found: Breach[] = [];
  for (const id of Object.keys(head).sort()) {
    const t = head[id]!;
    if (t.ms > t.limitMs * LIMIT_SHARE) found.push({ test: id, kind: "limit", head: t });
    const m = medians.get(id);
    if (m && t.ms > m.ms * (1 + GROWTH) && t.ms - m.ms > GROWTH_FLOOR_MS) found.push({ test: id, kind: "growth", head: t, medianMs: m.ms, runs: m.runs });
  }
  const breaches: Breach[] = [];
  const excused: (Breach & { reason: string })[] = [];
  for (const b of found) {
    const e = exceptionFor(exceptions, b.test);
    if (e) excused.push({ ...b, reason: e.reason });
    else breaches.push(b);
  }
  return { breaches, excused, compared: Object.keys(head).filter((id) => medians.has(id)).length, runs: base.length };
};

const s = (ms: number): string => (ms / 1000).toFixed(1);

const what = (b: Breach): string =>
  b.kind === "limit"
    ? `${s(b.head.ms)} s, over half of its ${s(b.head.limitMs)} s limit`
    : `${s(b.head.ms)} s against ${s(b.medianMs!)} s on main (median of ${b.runs} run${b.runs === 1 ? "" : "s"}, +${Math.round((b.head.ms / b.medianMs! - 1) * 100)}%)`;

/** One `::error` line per breach, for the log and the pull request's annotations. */
export const errors = (g: Gate): string[] =>
  g.breaches.map((b) => {
    const file = b.test.split(" > ")[0]!;
    return `::error file=${file},title=Test too slow::${b.test}: ${what(b)}. Find what made it slower (ADR-0083: a profile, not a higher limit) or add it with a reason to tools/test-time/src/exceptions.ts.`;
  });

/** Markdown for `$GITHUB_STEP_SUMMARY`. */
export const gateSummary = (g: Gate): string => {
  const lines = ["## Single tests (ADR-0083)", ""];
  lines.push(
    `A test fails over ${LIMIT_SHARE * 100}% of its limit, or over ${GROWTH * 100}% and ${s(GROWTH_FLOOR_MS)} s slower than the median of main (${g.runs} green run${g.runs === 1 ? "" : "s"} of main with test times, ${g.compared} tests compared).`,
    "",
  );
  const row = (b: Breach, reason = "") => `| ${b.test} | ${b.kind} | ${what(b)} |${reason ? ` ${reason} |` : ""}`;
  if (g.breaches.length > 0) lines.push(`### Over the limits (${g.breaches.length})`, "", "| Test | Gate | Time |", "|---|---|---|", ...g.breaches.map((b) => row(b)), "");
  else lines.push("No test over the limits.", "");
  if (g.excused.length > 0) lines.push(`### Exceptions (${g.excused.length})`, "", "| Test | Gate | Time | Reason |", "|---|---|---|---|", ...g.excused.map((b) => row(b, b.reason)), "");
  return `${lines.join("\n")}\n`;
};
