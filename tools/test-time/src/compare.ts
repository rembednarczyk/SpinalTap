import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compareTimes, mergeTimes, summary, warnings, type Times, type TimesFile } from "./times.ts";

/**
 * CI step after the unit shards (ADR-0046):
 * `node tools/test-time/src/compare.ts <pull request times dir> [<main times dir>] [<reference label>]`.
 * Every `*.json` under a directory is one shard (`reporter.ts`). An empty or missing main directory
 * means no reference: the summary lists the times and nothing is compared. Always exits 0: the
 * gate warns, it does not fail the run.
 */

const jsonFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true, encoding: "utf8" })
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => join(dir, f))
    : [];

const load = (dir: string | undefined): Times | undefined => {
  const files = dir ? jsonFiles(dir) : [];
  if (files.length === 0) return undefined;
  return mergeTimes(files.map((f) => JSON.parse(readFileSync(f, "utf8")) as TimesFile));
};

const [headDir, baseDir, reference] = process.argv.slice(2);
const head = load(headDir);
if (!head) {
  console.log(`No unit test times under ${headDir ?? "(no directory given)"}; nothing to compare.`);
} else {
  const base = load(baseDir);
  const c = compareTimes(base, head);
  const text = summary(c, base ? (reference || baseDir) : undefined);
  console.log(text);
  for (const w of warnings(c)) console.log(w);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
}
