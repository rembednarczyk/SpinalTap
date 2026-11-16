/**
 * Unit tests on a loaded machine (agent rules: timeouts under load are not failures, assertions
 * are):
 *
 *   pnpm test:rerun <package | path | filter>... [-- <vitest options>]
 *
 * e.g. `pnpm test:rerun sim app`, `pnpm test:rerun packages/sim/test/determinism.test.ts`. A bare
 * name of `packages/<name>` or `tools/<name>` means that directory. One `vitest run` of all of
 * them with the JSON reporter; then every file that failed only on timeouts runs again alone with
 * `--maxWorkers=1`. Exits 0 only when nothing fails after that: an assertion, an error, a timeout
 * that stays alone, or a failure outside the files (unhandled error, coverage) is exit 1. Prints a
 * short summary (`classify.ts`), assertions apart; the Vitest output goes to `--log-dir` (default
 * `reports/test-rerun`).
 *
 * The first run keeps the worker limit of the environment: `VITEST_MAX_WORKERS=<n>` caps the
 * Vitest workers of an agent (Vitest reads it itself and it wins over `--maxWorkers`; unset in
 * CI, so CI runs as before). The reruns set it to 1.
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { repoRoot, run } from "../../shots/src/checkout.ts";
import { classify, rerunCandidates, summary, type Classified, type Rerun } from "./classify.ts";

const argv = process.argv.slice(2);
const dash = argv.indexOf("--");
const targets = dash < 0 ? argv : argv.slice(0, dash);
const vitestOptions = dash < 0 ? [] : argv.slice(dash + 1);
let logDir = "reports/test-rerun";
const at = targets.indexOf("--log-dir");
if (at >= 0) [, logDir] = targets.splice(at, 2) as [string, string];
if (targets.length === 0 || targets.some((t) => t.startsWith("-"))) {
  console.error("usage: pnpm test:rerun <package | path | filter>... [--log-dir <dir>] [-- <vitest options>]");
  process.exit(2);
}

const root = repoRoot();
const logs = resolve(root, logDir);
mkdirSync(logs, { recursive: true });
const log = join(logs, "vitest.log");
rmSync(log, { force: true });

/** `sim` is `packages/sim/`, `orto` is `tools/orto/`; anything else goes to Vitest as given. */
const filterOf = (t: string): string => {
  for (const dir of ["packages", "tools"]) if (/^[a-z0-9-]+$/.test(t) && existsSync(join(root, dir, t))) return `${dir}/${t}/`;
  return t;
};

const rel = (p: string): string => relative(root, p);

/** One `vitest run`, classified; null when it wrote no report (it did not start). */
const vitest = (filters: readonly string[], extra: readonly string[], env: NodeJS.ProcessEnv, tag: string): { c: Classified | null; code: number } => {
  const out = join(logs, `${tag}.json`);
  rmSync(out, { force: true });
  const code = run("pnpm", ["exec", "vitest", "run", ...filters, ...extra, ...vitestOptions, "--reporter=default", "--reporter=json", `--outputFile.json=${out}`], { cwd: root, log, env });
  if (!existsSync(out)) return { c: null, code };
  const c = classify(JSON.parse(readFileSync(out, "utf8")), rel);
  // A red exit with no failed file (a coverage threshold, an unhandled error the report missed).
  return { c: code !== 0 && c.failed.length === 0 ? { ...c, outsideFiles: true } : c, code };
};

const first = vitest(targets.map(filterOf), [], process.env, "first");
if (!first.c) {
  console.error(`vitest exited ${first.code} without a JSON report; see ${log}`);
  process.exit(1);
}
const reruns: Rerun[] = [];
for (const file of rerunCandidates(first.c)) {
  const alone = vitest([file], ["--maxWorkers=1"], { ...process.env, VITEST_MAX_WORKERS: "1" }, `rerun-${reruns.length + 1}`);
  const after = alone.c?.failed.find((f) => f.file === file) ?? null;
  const broken = !alone.c ? `exited ${alone.code} without a report` : alone.c.files === 0 ? "no test file matched" : alone.c.outsideFiles ? "failed outside the file" : undefined;
  reruns.push({ file, after, ...(broken ? { broken } : {}) });
}
const s = summary(first.c, reruns);
for (const line of s.lines) console.log(line);
console.log(`vitest output: ${log}`);
process.exitCode = s.ok ? 0 : 1;
