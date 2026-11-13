/**
 * A/B timing of two refs, for "is the branch slower than main" (ADR-0046: a time on a shared
 * machine is a report, so pairs, not single runs):
 *
 *   pnpm bench:ab <ref-A> <ref-B> --vitest <test file> --name "<part of the test name>" [options]
 *   pnpm bench:ab <ref-A> <ref-B> [options] -- <command> [args...]
 *
 * e.g. `pnpm bench:ab origin/main HEAD --vitest tools/osm-import/test/venues.test.ts --name "sign
 * nearly" --before-each "rm -rf node_modules/.cache/seki-city"`. With `--vitest` the time is the
 * test's own duration from the Vitest JSON report; with a command, the wall time of the command.
 * `HEAD` is the current checkout as it is; any other ref goes into a detached worktree under
 * `--work` (default `$BENCH_WORK`, else the system temp dir), removed at the end, also on an error.
 *
 * Options: `--pairs 12`, `--max-load 4` (a pair starts only under this 1-minute load), `--max-wait
 * 1800` (s a pair waits for the load; then it runs anyway and is counted as over the limit),
 * `--before-each "<shell>"` (untimed, in the checkout, before every run), `--out <file.json>`.
 * Pairs alternate the order (A B, B A, ...). The result is the median of the per-pair change
 * B / A - 1, printed as one line (`stats.ts` `oneLine`) and written with every pair to `--out`
 * (default `<work>/bench-ab.json`). A failed run stops the measurement (exit 1).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { closeCheckout, loadNow, must, openCheckout, repoRoot, withCleanup, type Checkout } from "../../shots/src/checkout.ts";
import { oneLine, pairOrder, summarize, testDuration, waitForLoad, type Pair, type Side } from "./stats.ts";

const USAGE = 'usage: pnpm bench:ab <ref-A> <ref-B> (--vitest <file> --name "<test>" | -- <command...>) [--pairs 12] [--max-load 4] [--max-wait 1800] [--before-each "<shell>"] [--work <dir>] [--out <file.json>]';

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    vitest: { type: "string" },
    name: { type: "string" },
    pairs: { type: "string", default: "12" },
    "max-load": { type: "string", default: "4" },
    "max-wait": { type: "string", default: "1800" },
    "before-each": { type: "string" },
    work: { type: "string" },
    out: { type: "string" },
  },
});
const [refA, refB, ...command] = positionals;
if (!refA || !refB || (opt.vitest ? command.length > 0 || !opt.name : command.length === 0)) {
  console.error(USAGE);
  process.exit(2);
}
const pairs = Number(opt.pairs);
const maxLoad = Number(opt["max-load"]);
const maxWaitMs = Number(opt["max-wait"]) * 1000;
const root = repoRoot();
const work = resolve(opt.work ?? process.env.BENCH_WORK ?? join(tmpdir(), "bench-ab-work"));
const out = resolve(opt.out ?? join(work, "bench-ab.json"));
const log = join(dirname(out), "bench-ab.log");
const report = join(work, `bench-ab-${process.pid}-vitest.json`);

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One timed run in a checkout, ms. */
const measure = (dir: string): number => {
  if (opt["before-each"]) must("bash", ["-c", opt["before-each"]], { cwd: dir, log });
  if (opt.vitest) {
    rmSync(report, { force: true });
    must("pnpm", ["exec", "vitest", "run", opt.vitest, "-t", escape(opt.name!), "--reporter=json", `--outputFile=${report}`], { cwd: dir, log });
    return testDuration(JSON.parse(readFileSync(report, "utf8")), opt.name!);
  }
  const t0 = process.hrtime.bigint();
  must(command[0]!, command.slice(1), { cwd: dir, log });
  return Number(process.hrtime.bigint() - t0) / 1e6;
};

const open: Checkout[] = [];
const cleanup = () => {
  rmSync(report, { force: true });
  for (const c of open.splice(0)) closeCheckout(root, c, log);
};

const main = async (): Promise<number> => {
  mkdirSync(dirname(out), { recursive: true });
  const a = openCheckout(root, refA, work, "bench-a", log);
  open.push(a);
  const b = openCheckout(root, refB, work, "bench-b", log);
  open.push(b);
  const dirs: Record<Side, string> = { A: a.dir, B: b.dir };
  const done: Pair[] = [];
  for (let i = 0; i < pairs; i++) {
    const gate = await waitForLoad(loadNow, (ms) => new Promise((r) => setTimeout(r, ms)), maxLoad, maxWaitMs);
    const order = pairOrder(i);
    const ms: Partial<Record<Side, number>> = {};
    for (const side of order) ms[side] = measure(dirs[side]);
    const pair: Pair = { a: ms.A!, b: ms.B!, first: order[0], loadStart: gate.load, loadEnd: loadNow(), waitedOut: gate.waitedOut };
    done.push(pair);
    console.log(`pair ${i + 1}/${pairs} (${order.join(" ")}): A ${pair.a.toFixed(1)} ms, B ${pair.b.toFixed(1)} ms, load ${pair.loadStart}-${pair.loadEnd}${gate.waitedOut ? " (over the limit)" : ""}`);
  }
  const summary = summarize(done);
  const line = oneLine(summary);
  const what = opt.vitest ? { vitest: opt.vitest, name: opt.name } : { command };
  const side = (c: Checkout) => ({ ref: c.ref, sha: c.sha, dirty: c.dirty });
  writeFileSync(out, `${JSON.stringify({ tool: "bench-ab", ...what, A: side(a), B: side(b), maxLoad, summary, line, pairs: done }, null, 1)}\n`);
  console.log(`B vs A: ${line}`);
  console.log(`report ${out}`);
  return 0;
};

process.exitCode = await withCleanup(cleanup, main);
