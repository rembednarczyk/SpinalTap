/**
 * `pnpm hashes:check [--write [--bare]] [--out FILE]`: after merging main into a branch, the
 * expected values of the golden tests worked out again (the ground cut's `CUT_BEFORE`,
 * `map-ground-golden`, `determinism`). Each test file runs once as a copy beside it with every
 * `expect` soft (`values.ts`), so one run shows every assertion that fails; the tests themselves
 * are not changed. For each failure: the numbers in it (cuts, meshes, vertices) the same or not,
 * and the new hash. `--write` puts the new hashes in the test files only where the numbers are the
 * same (`--bare` also where the assertion has no numbers, e.g. the determinism hashes), refuses
 * the rest with the difference, and runs the tests again. Exit 0 when nothing fails (after the
 * writing), 1 otherwise.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { repoRoot, withCleanup } from "../../shots/src/checkout.ts";
import type { Failure, RunReport } from "./reporter.ts";
import { type Comparison, compare, rewriteHash, softCopy } from "./values.ts";

export const GOLDEN = ["packages/engine/test/ground-cut.test.ts", "packages/engine/test/map-ground-golden.test.ts", "packages/sim/test/determinism.test.ts"] as const;
const COPY = ".hashes-check.test.ts";

const { values: opt } = parseArgs({ options: { write: { type: "boolean" }, bare: { type: "boolean" }, out: { type: "string" } } });
const root = repoRoot();
const copyOf = (file: string) => file.replace(/\.test\.ts$/, COPY);

/** Runs `files` (repo paths) with the reporter; its report. */
const runTests = (files: readonly string[]): RunReport => {
  const report = join(tmpdir(), `hashes-check-${process.pid}.json`);
  rmSync(report, { force: true });
  const r = spawnSync("pnpm", ["exec", "vitest", "run", ...files, "--reporter=./tools/hashes/src/reporter.ts"], { cwd: root, env: { ...process.env, HASHES_REPORT: report }, stdio: ["ignore", "inherit", "inherit"] });
  if (!existsSync(report)) throw new Error(`vitest exited ${r.status} without a report`);
  const out = JSON.parse(readFileSync(report, "utf8")) as RunReport;
  rmSync(report, { force: true });
  return out;
};

interface Row {
  readonly file: string;
  readonly test: string;
  readonly line: number | null;
  readonly message: string;
  readonly comparison: Comparison | null;
  written?: boolean;
  refused?: string;
}

const rowOf = (f: Failure): Row => ({
  file: relative(root, f.file).replace(COPY, ".test.ts"),
  test: f.test,
  line: f.line,
  message: f.message.split("\n")[0]!,
  comparison: f.expected !== null && f.actual !== null ? compare(f.expected, f.actual) : null,
});

const VERDICT_PL = { "same-numbers": "liczby bez zmian", bare: "bez liczb w teście", "numbers-changed": "LICZBY ZMIENIONE", "not-a-hash": "nie skrót" } as const;

const rowText = (r: Row): string => {
  const c = r.comparison;
  const where = `${r.file}:${r.line ?? "?"}`;
  if (!c) return `${where} ${r.test}: ${r.message}`;
  const all = Object.entries(c.numbers);
  const shown = all.length > 3 ? all.filter(([, v]) => v.expected !== v.actual) : all;
  const nums = shown.map(([k, v]) => `${k || "liczba"} ${v.expected}${v.expected === v.actual ? "" : ` -> ${v.actual}`}`);
  if (shown.length < all.length) nums.push(`${all.length - shown.length} liczb bez zmian`);
  const hashes = c.hashes.map((h) => `${h.path || "skrót"} ${h.old} -> ${h.new}`);
  const done = r.written ? " [zapisano]" : r.refused ? ` [odmowa: ${r.refused}]` : "";
  return `${where} ${VERDICT_PL[c.verdict]}: ${[...nums, ...hashes].join(", ") || r.message}${c.otherChanged.length ? `; inne: ${c.otherChanged.join(", ")}` : ""}${done}`;
};

/** Writes the rows' new hashes where allowed; the reason a row is refused, on it. */
const write = (rows: readonly Row[]): void => {
  const blocked = new Set(rows.filter((r) => !r.comparison || r.comparison.verdict === "not-a-hash").map((r) => r.file));
  for (const r of rows) {
    const c = r.comparison;
    if (!c || c.verdict === "not-a-hash") continue;
    if (c.verdict === "numbers-changed") r.refused = `liczby: ${c.numbersChanged.join(", ") || "klucze"}`;
    else if (c.verdict === "bare" && !opt.bare) r.refused = "bez liczb, potrzebne --bare";
    else if (blocked.has(r.file)) r.refused = "w pliku pada asercja, która nie jest skrótem";
    if (r.refused) continue;
    let src = readFileSync(join(root, r.file), "utf8");
    for (const h of c.hashes) {
      const next = rewriteHash(src, r.line, h);
      if (next === null) {
        r.refused = `${h.old} niejednoznaczny w pliku`;
        break;
      }
      src = next;
    }
    if (r.refused) continue;
    writeFileSync(join(root, r.file), src);
    r.written = true;
  }
};

const main = async (): Promise<number> => {
  const copies = GOLDEN.map(copyOf);
  const rows = await withCleanup(
    () => copies.forEach((c) => rmSync(join(root, c), { force: true })),
    () => {
      GOLDEN.forEach((f, i) => writeFileSync(join(root, copies[i]!), softCopy(readFileSync(join(root, f), "utf8"))));
      const report = runTests(copies);
      for (const e of report.errors) console.error(`błąd: ${e}`);
      const missing = copies.filter((c) => !report.files.some((f) => relative(root, f.file) === c));
      if (missing.length || report.errors.length) throw new Error(`no result for ${missing.join(", ") || "the run"}; see the errors above`);
      return report.failures.map(rowOf);
    },
  );
  if (opt.write) write(rows);
  const lines = rows.map(rowText);
  console.log([`hashes:check: ${rows.length ? `${rows.length} asercji pada` : "wszystkie skróty zgodne"} (${GOLDEN.join(", ")})`, ...lines].join("\n"));
  let after: RunReport | null = null;
  if (rows.some((r) => r.written)) {
    after = runTests([...new Set(rows.filter((r) => r.written).map((r) => r.file))]);
    console.log(`po zapisie, w zapisanych plikach: ${after.failures.length ? `${after.failures.length} asercji nadal pada` : "testy przechodzą"}`);
  }
  if (opt.out) writeFileSync(opt.out, `${JSON.stringify({ rows, after: after?.failures.map(rowOf) ?? null }, null, 2)}\n`);
  return rows.length === 0 || (after !== null && after.failures.length === 0 && rows.every((r) => r.written)) ? 0 : 1;
};

process.exitCode = await main();
