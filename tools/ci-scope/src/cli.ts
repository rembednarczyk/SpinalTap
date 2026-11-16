import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { GLITCH_SCAN, importClosure } from "./imports.ts";
import { fullScope, isFull, pushScope, scope, type Scope } from "./scope.ts";

/**
 * Job "What changed" of `ci.yml` (ADR-0046):
 * `git diff --name-only ... | node tools/ci-scope/src/cli.ts` for a pull request, or
 * `git diff --name-only <before> HEAD | node tools/ci-scope/src/cli.ts --push` for a push to main
 * (everything, or nothing for docs alone), `node tools/ci-scope/src/cli.ts --full "<reason>"` for
 * the nightly run and a run by hand. Writes `code`, `tables`, `e2e`, `unit`, `unit_files` (a JSON
 * array), `scan` and `scan_chunks` (the glitch scan's part of the city, `scan-scope.ts`; the
 * districts by commas) and `full` (every unit test, every e2e group, the whole scan) to `$GITHUB_OUTPUT`
 * and the reasons to the log and `$GITHUB_STEP_SUMMARY`.
 */

const TEST = /\.test\.tsx?$/;

/** The test files Vitest's projects include (`vitest.config.ts`): `packages/*\/test` and `tools/*\/test`. */
const testFiles = (root: string): string[] =>
  ["packages", "tools"].flatMap((top) =>
    readdirSync(join(root, top), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(root, top, d.name, "test")))
      .flatMap((d) =>
        readdirSync(join(root, top, d.name, "test"), { recursive: true, encoding: "utf8" })
          .filter((f) => TEST.test(f) && !f.includes("node_modules"))
          .map((f) => `${top}/${d.name}/test/${f.split("\\").join("/")}`),
      ),
  );

const write = (s: Scope): void => {
  const lines = [`code=${s.code}`, `tables=${s.tables}`, `e2e=${s.e2e}`, `unit=${s.unit}`, `scan=${s.scan}`, `scan_chunks=${s.scanChunks.join(",")}`, `unit_files=${JSON.stringify(s.unitFiles)}`, `full=${isFull(s)}`];
  console.log(lines.slice(0, 6).join(" "));
  for (const r of s.reasons) console.log(`- ${r}`);
  if (s.unit === "related") console.log(`vitest related:\n  ${s.unitFiles.join("\n  ")}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = ["## What runs (ADR-0046)", "", `Unit tests: **${s.unit}**, e2e: **${s.e2e}**, map tables: **${s.tables}**, glitch scan: **${s.scan}**${s.scanChunks.length ? ` (${s.scanChunks.join(", ")})` : ""}.`, "", ...s.reasons.map((r) => `- ${r}`), ""];
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md.join("\n")}\n`);
  }
};

const args = process.argv.slice(2);
const changed = (): string[] => readFileSync(0, "utf8").split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
if (args[0] === "--full") write(fullScope(args[1] ?? "full run"));
else if (args[0] === "--push") write(pushScope(changed()));
else {
  const scanReads = importClosure(process.cwd(), [GLITCH_SCAN]);
  write(scope(changed(), testFiles(process.cwd()), (f) => scanReads.has(f)));
}
