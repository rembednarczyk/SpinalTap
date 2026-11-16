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

/**
 * A new test (one main's reference runs do not have) fails over this share of its limit. A test main
 * has is held by its growth over main instead: on a shared runner the same test swings by 20-30%
 * from run to run, so tests near half their limit failed it by noise alone (15.11, #585: two crowd
 * tests at 10.4 and 11.2 s; the user's decision: calibrate). Without any reference run only
 * `HARD_SHARE` holds.
 */
export const LIMIT_SHARE = 0.5;

/** Any test fails over this share of its limit: close enough to the timeout that noise could cross it. */
export const HARD_SHARE = 0.75;

/** More than this much slower than the median of main fails... */
export const GROWTH = 0.3;

/**
 * ...when that is also more than 1 s: a 40 ms test at 60 ms is +50% of a shared runner's noise, and
 * a test that matters for the limit (seconds) grows by seconds when a rule makes it slower.
 */
export const GROWTH_FLOOR_MS = 1000;

/** How many green runs of main the median is taken over, at most (`ci.yml` downloads them). */
export const REFERENCE_RUNS = 5;

/**
 * The growth gate compares with a median of at least this many runs of main: one run is one
 * draw of a shared runner's noise (15.11, #588: an import change failed a sim and an app test at
 * +46% and +62% against a single run of main). With fewer runs only the limits hold (ADR-0083).
 */
export const MIN_GROWTH_RUNS = 3;

/**
 * The whole run's pace against main: the median of head/main over the tests of at least this long
 * on main. A night of slow shared runners made every test 30-150% slower (16.11, #593, #600, #606:
 * changes outside sim failed sim and scan tests by growth); the growth gate compares each test
 * with main scaled by the run's pace, never below 1, so one test slower than the rest still fails
 * (decision of the user, 16.11). The pace is each shard's own: shards run on separate runners, and
 * one slow runner next to a normal one left the median of the merged run at 1 (16.11, #608).
 */
export const PACE_MIN_MS = 1000;

/** The run's pace (≥ 1) from the tests that main ran too, of `PACE_MIN_MS` or more there; 1 with fewer than 10 of them. */
export const runPace = (head: TestTimes, medians: ReadonlyMap<string, { readonly ms: number; readonly runs: number }>): number => {
  const ratios = Object.entries(head).flatMap(([id, t]) => {
    const m = medians.get(id);
    return m && m.runs >= MIN_GROWTH_RUNS && m.ms >= PACE_MIN_MS ? [t.ms / m.ms] : [];
  });
  return ratios.length >= 10 ? Math.max(1, median(ratios)) : 1;
};

export interface Exception {
  /** A test's id (`testId`), or a test file for each of its tests. */
  readonly test: string;
  readonly reason: string;
  /** Only this gate is excused (a test known to be slow keeps its growth gate); absent: both. */
  readonly only?: Breach["kind"];
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
  /** The run's pace against main (`runPace`) the growth gate scaled main by: the highest of its shards'. */
  readonly pace: number;
  /** Each shard's own pace, in the order of the shards given; one entry without shards. */
  readonly paces: readonly number[];
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

export const exceptionFor = (exceptions: readonly Exception[], test: string, kind?: Breach["kind"]): Exception | undefined =>
  exceptions.find((e) => (e.test === test || test.startsWith(`${e.test} > `)) && (!e.only || !kind || e.only === kind));

/**
 * The tests of the pull request (`head`) against their limits and the runs of main (`base`, newest
 * first; none: the limits alone). With the head's `shards`, each test's growth is scaled by the pace
 * of the shard that ran it; without them, by the pace of the whole head.
 */
export const gateTests = (head: TestTimes, base: readonly TestTimes[], exceptions: readonly Exception[], shards: readonly TestTimes[] = []): Gate => {
  const medians = medianTimes(base);
  const paces = shards.length > 0 ? shards.map((sh) => runPace(sh, medians)) : [runPace(head, medians)];
  const paceOf = new Map<string, number>();
  shards.forEach((sh, i) => {
    for (const id of Object.keys(sh)) if (!paceOf.has(id)) paceOf.set(id, paces[i]!);
  });
  const found: Breach[] = [];
  for (const id of Object.keys(head).sort()) {
    const t = head[id]!;
    const m = medians.get(id);
    const pace = paceOf.get(id) ?? (shards.length > 0 ? 1 : paces[0]!);
    const share = m === undefined && base.length > 0 ? LIMIT_SHARE : HARD_SHARE;
    if (t.ms > t.limitMs * share) found.push({ test: id, kind: "limit", head: t });
    if (m && m.runs >= MIN_GROWTH_RUNS && t.ms > m.ms * pace * (1 + GROWTH) && t.ms - m.ms * pace > GROWTH_FLOOR_MS) found.push({ test: id, kind: "growth", head: t, medianMs: m.ms, runs: m.runs });
  }
  const breaches: Breach[] = [];
  const excused: (Breach & { reason: string })[] = [];
  for (const b of found) {
    const e = exceptionFor(exceptions, b.test, b.kind);
    if (e) excused.push({ ...b, reason: e.reason });
    else breaches.push(b);
  }
  return { breaches, excused, compared: Object.keys(head).filter((id) => medians.has(id)).length, runs: base.length, pace: Math.max(...paces), paces };
};

const s = (ms: number): string => (ms / 1000).toFixed(1);

const what = (b: Breach): string =>
  b.kind === "limit"
    ? `${s(b.head.ms)} s, over ${Math.round(Math.min(b.head.ms / b.head.limitMs, 1) * 100)}% of its ${s(b.head.limitMs)} s limit`
    : `${s(b.head.ms)} s against ${s(b.medianMs!)} s on main (median of ${b.runs} run${b.runs === 1 ? "" : "s"}, +${Math.round((b.head.ms / b.medianMs! - 1) * 100)}%)`;

/**
 * Which breaches fail the run: the limits only. A growth over main is reported, not blocking: on
 * shared runners the same test swings by 30-150% from run to run, and for a day the growth gate
 * held a dozen innocent pull requests while it caught no real slowdown (16.11, #593 to #618;
 * decision of the user, 16.11: report only). It comes back when main's times come from a quiet
 * runner (ADR-0046, debt).
 */
export const blocking = (g: Gate): readonly Breach[] => g.breaches.filter((b) => b.kind === "limit");

/** One `::error` line per blocking breach and one `::warning` per reported growth, for the log and the pull request's annotations. */
export const errors = (g: Gate): string[] =>
  g.breaches.map((b) => {
    const file = b.test.split(" > ")[0]!;
    return b.kind === "limit"
      ? `::error file=${file},title=Test too slow::${b.test}: ${what(b)}. Find what made it slower (ADR-0083: a profile, not a higher limit) or add it with a reason to tools/test-time/src/exceptions.ts.`
      : `::warning file=${file},title=Test slower than main::${b.test}: ${what(b)}. Report only (ADR-0083, 16.11): look for what made it slower if it repeats.`;
  });

/** Markdown for `$GITHUB_STEP_SUMMARY`. */
export const gateSummary = (g: Gate): string => {
  const lines = ["## Single tests (ADR-0083)", ""];
  lines.push(
    `A new test fails over ${LIMIT_SHARE * 100}% of its limit, any test over ${HARD_SHARE * 100}%; a test over ${GROWTH * 100}% and ${s(GROWTH_FLOOR_MS)} s slower than the median of main scaled by the pace of the shard that ran it is reported, not failed (paces ${g.paces.map((p) => p.toFixed(2)).join(", ")}; ${g.runs} green run${g.runs === 1 ? "" : "s"} of main with test times, ${g.compared} tests compared).`,
    "",
  );
  const row = (b: Breach, reason = "") => `| ${b.test} | ${b.kind} | ${what(b)} |${reason ? ` ${reason} |` : ""}`;
  if (g.breaches.length > 0) lines.push(`### Over the limits (${g.breaches.length})`, "", `Failing the run: ${blocking(g).length} (limits); growths are warnings.`, "", "| Test | Gate | Time |", "|---|---|---|", ...g.breaches.map((b) => row(b)), "");
  else lines.push("No test over the limits.", "");
  if (g.excused.length > 0) lines.push(`### Exceptions (${g.excused.length})`, "", "| Test | Gate | Time | Reason |", "|---|---|---|---|", ...g.excused.map((b) => row(b, b.reason)), "");
  return `${lines.join("\n")}\n`;
};
