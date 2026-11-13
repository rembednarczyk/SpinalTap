/**
 * The counting part of `rerun.ts`: failures of a Vitest JSON report (`--reporter=json`) sorted
 * into timeouts ("Test timed out in …ms", "Hook timed out in …ms": the 5-20 s limit hit on a
 * loaded machine) and real failures (assertions, errors, a file that did not load). A file whose
 * every failure is a timeout is a candidate to run again alone; any other failure is a real one.
 */

interface Assertion {
  readonly fullName: string;
  readonly status: string;
  readonly failureMessages?: readonly string[] | null;
}

interface FileResult {
  readonly name: string;
  readonly status: string;
  readonly message?: string | null;
  readonly assertionResults?: readonly Assertion[];
}

export interface VitestReport {
  readonly success?: boolean;
  readonly numTotalTests?: number;
  readonly testResults?: readonly FileResult[];
}

const TIMEOUT = /\b(Test|Hook) timed out in \d+ms/;

export const isTimeout = (message: string): boolean => TIMEOUT.test(message);

export interface Failure {
  readonly test: string;
  /** First line of the message. */
  readonly message: string;
}

export interface FileFailures {
  readonly file: string;
  readonly timeouts: readonly Failure[];
  /** Assertions, errors and a file-level failure that is not a timeout. */
  readonly real: readonly Failure[];
}

export interface Classified {
  readonly files: number;
  readonly tests: number;
  readonly failed: readonly FileFailures[];
  /** The run failed with no failed file in the report: an unhandled error, a failed coverage threshold, … */
  readonly outsideFiles: boolean;
}

const firstLine = (s: string): string => s.trim().split("\n")[0]!.slice(0, 300);

const fileFailures = (f: FileResult, rel: (path: string) => string): FileFailures | null => {
  const timeouts: Failure[] = [];
  const real: Failure[] = [];
  for (const t of f.assertionResults ?? []) {
    if (t.status !== "failed") continue;
    const message = (t.failureMessages ?? []).join("\n") || "failed without a message";
    (isTimeout(message) ? timeouts : real).push({ test: t.fullName, message: firstLine(message) });
  }
  // A file that failed beside its tests: it did not load, or a hook outside every test threw.
  if (f.status === "failed" && f.message) (isTimeout(f.message) ? timeouts : real).push({ test: "(file)", message: firstLine(f.message) });
  if (f.status === "failed" && timeouts.length === 0 && real.length === 0) real.push({ test: "(file)", message: "failed without a failed test" });
  return timeouts.length + real.length === 0 ? null : { file: rel(f.name), timeouts, real };
};

export const classify = (report: VitestReport, rel: (path: string) => string = (p) => p): Classified => {
  const results = report.testResults ?? [];
  const failed = results.map((f) => fileFailures(f, rel)).filter((f): f is FileFailures => f !== null);
  return { files: results.length, tests: report.numTotalTests ?? 0, failed, outsideFiles: report.success === false && failed.length === 0 };
};

/** Files to run again alone: failed only on timeouts. */
export const rerunCandidates = (c: Classified): string[] => c.failed.filter((f) => f.real.length === 0).map((f) => f.file);

export interface Rerun {
  readonly file: string;
  /** Failures of the run alone; null: it passed. */
  readonly after: FileFailures | null;
  /** The run alone failed outside the file (it did not produce a report, or an unhandled error). */
  readonly broken?: string;
}

/** The short summary, real failures listed apart from timeouts; `ok` when nothing failed after the reruns. */
export const summary = (first: Classified, reruns: readonly Rerun[]): { readonly ok: boolean; readonly lines: string[] } => {
  const real = first.failed.filter((f) => f.real.length > 0);
  const lines = [`first run: ${first.files} files, ${first.tests} tests, ${first.failed.length} files failed: ${real.length} with assertions or errors, ${first.failed.length - real.length} with timeouts only`];
  if (first.outsideFiles) lines.push("first run: failed outside the test files (unhandled error, coverage threshold, config): see the log");
  for (const f of real) for (const x of f.real) lines.push(`ASSERTION ${f.file} > ${x.test}: ${x.message}`);
  for (const f of real) if (f.timeouts.length > 0) lines.push(`timeouts beside the assertions in ${f.file}: ${f.timeouts.length} (not run again)`);
  for (const r of reruns) {
    if (r.broken) lines.push(`rerun ${r.file} (--maxWorkers=1): ${r.broken}`);
    else if (!r.after) lines.push(`rerun ${r.file} (--maxWorkers=1): passed`);
    else {
      lines.push(`rerun ${r.file} (--maxWorkers=1): ${r.after.timeouts.length} timeouts, ${r.after.real.length} assertions or errors`);
      for (const x of [...r.after.real, ...r.after.timeouts]) lines.push(`  ${r.after.real.includes(x) ? "ASSERTION" : "TIMEOUT"} ${x.test}: ${x.message}`);
    }
  }
  const stillFailing = reruns.filter((r) => r.broken || r.after).length;
  const ok = real.length === 0 && !first.outsideFiles && stillFailing === 0;
  lines.push(ok ? `result: OK${reruns.length ? ` (${reruns.length} files passed alone after timeouts)` : ""}` : `result: FAIL (${real.length} files with assertions or errors, ${stillFailing} still failing alone${first.outsideFiles ? ", a failure outside the files" : ""})`);
  return { ok, lines };
};
