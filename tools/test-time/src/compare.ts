import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { EXCEPTIONS } from "./exceptions.ts";
import { blocking, errors, gateSummary, gateTests } from "./gate.ts";
import { compareTimes, mergeTests, mergeTimes, summary, warnings, type TimesFile } from "./times.ts";

/**
 * CI step after the unit shards (ADR-0046, ADR-0083):
 * `node tools/test-time/src/compare.ts <pull request times dir> [<main runs dir>] [<reference label>]`.
 * Every `*.json` under the pull request's directory is one shard (`reporter.ts`). The main directory
 * holds one directory a green run of main, newest first by name (`1`, `2`, ...), or the shards of a
 * single run; empty or missing, there is no reference. The files slower than the newest run get a
 * warning; a test over half its limit or slower than the median of the runs fails the step (`gate.ts`).
 */

const jsonFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true, encoding: "utf8" })
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => join(dir, f))
    : [];

const shards = (dir: string): TimesFile[] => jsonFiles(dir).map((f) => JSON.parse(readFileSync(f, "utf8")) as TimesFile);

/** The runs of main, newest first: one a subdirectory, or the directory itself as one run. */
const runs = (dir: string | undefined): TimesFile[][] => {
  if (!dir || !existsSync(dir)) return [];
  const subs = readdirSync(dir)
    .filter((d) => statSync(join(dir, d)).isDirectory())
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const out = subs.length > 0 ? subs.map((d) => shards(join(dir, d))) : [shards(dir)];
  return out.filter((r) => r.length > 0);
};

const [headDir, baseDir, reference] = process.argv.slice(2);
const head = headDir ? shards(headDir) : [];
if (head.length === 0) {
  console.log(`No unit test times under ${headDir ?? "(no directory given)"}; nothing to compare.`);
} else {
  const main = runs(baseDir);
  const base = main[0] ? mergeTimes(main[0]) : undefined;
  const c = compareTimes(base, mergeTimes(head));
  // Runs of main from before ADR-0083 have no tests' times: the limits alone, until they do.
  const gate = gateTests(
    mergeTests(head),
    main.map(mergeTests).filter((t) => Object.keys(t).length > 0),
    EXCEPTIONS,
    head.map((f) => mergeTests([f])),
  );
  const text = `${summary(c, base ? (reference || baseDir) : undefined)}\n${gateSummary(gate)}`;
  console.log(text);
  for (const w of warnings(c)) console.log(w);
  for (const e of errors(gate)) console.log(e);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  if (blocking(gate).length > 0) process.exitCode = 1;
}
