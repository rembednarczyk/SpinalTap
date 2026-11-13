/**
 * Shots before and after a change, side by side, with numbers (ADR-0054, agent rules: a change of
 * look needs shots you look at):
 *
 *   pnpm shots:compare <ref-before> <ref-after> <spots.json> [--hour 13 | --night] [--out <dir>] [--work <dir>] [--port <n>]
 *
 * e.g. `pnpm shots:compare origin/main HEAD spots.json --out /dev/shm/g999`. The spots file is the
 * `GLITCH_SPOTS` list, [[name, x, z, yaw, pitch, y?]]. `HEAD` is the current checkout as it is
 * (uncommitted changes included); any other ref goes into a detached worktree under `--work`
 * (default `$SHOTS_WORK`, else the system temp dir), with `pnpm install --frozen-lockfile
 * --prefer-offline`. For each ref, one after the other: `pnpm build`, `pnpm e2e
 * e2e/glitch-shots.spec.ts` with `SHOTS`, `SHOT_HOUR` (13, `--night` 22), its own `E2E_PORT` and
 * `--output=/dev/shm/...`, then the worktree and `dist` go (also on an error or Ctrl-C).
 *
 * Into `--out` (default `<work>/shots-compare`): `before/` and `after/` (the spec's PNG and JSON),
 * `pair/<name>.png` (before | after, each 800 px wide), `grid.png` (all pairs under each other),
 * `report.json` (refs, SHAs, load, numbers of `metrics.ts` for every spot) and the logs. Prints
 * one line a spot. Exits 1 when a ref failed to build or shoot, or a spot has no pair.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { decodeRgb } from "../../orto/src/png.ts";
import { closeCheckout, loadNow, must, openCheckout, repoRoot, run, withCleanup, type Checkout } from "./checkout.ts";
import { pairLine, pairStats, type PairStats } from "./metrics.ts";
import { parseSpots, type Spot } from "./spots.ts";

const SPEC = "e2e/glitch-shots.spec.ts";
const WIDTH = 800;
const NIGHT = 22;

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: { hour: { type: "string" }, night: { type: "boolean" }, out: { type: "string" }, work: { type: "string" }, port: { type: "string" } },
});
if (positionals.length !== 3) {
  console.error("usage: pnpm shots:compare <ref-before> <ref-after> <spots.json> [--hour 13 | --night] [--out <dir>] [--work <dir>] [--port <n>]");
  process.exit(2);
}
const [refBefore, refAfter, spotsPath] = positionals as [string, string, string];
const hour = opt.night ? NIGHT : Number(opt.hour ?? 13);
if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error(`--hour ${opt.hour}: a full hour, 0-23`);
const spots: Spot[] = parseSpots(readFileSync(spotsPath, "utf8"));
const root = repoRoot();
const work = resolve(opt.work ?? process.env.SHOTS_WORK ?? join(tmpdir(), "shots-compare-work"));
const out = resolve(opt.out ?? join(work, "shots-compare"));
const port = Number(opt.port ?? 4800 + (process.pid % 90) * 2);

type Side = "before" | "after";
interface Shot {
  readonly ref: string;
  readonly sha: string;
  readonly dirty: boolean;
  /** Exit code of `pnpm e2e` (null: the build or the checkout failed, see `error`). */
  readonly e2e: number | null;
  readonly specCopied: boolean;
  readonly error?: string;
  readonly log: string;
}

const open: Checkout[] = [];
const scratch: string[] = [];
const cleanup = () => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const c of open.splice(0)) closeCheckout(root, c, join(out, "cleanup.log"));
};

/** One ref: checkout, build, the spec, and everything but the shots removed again. */
const shoot = (side: Side, ref: string, spotsFile: string, e2ePort: number): Shot => {
  const log = join(out, `${side}.log`);
  let c: Checkout;
  try {
    c = openCheckout(root, ref, work, `shots-${side}`, log);
  } catch (e) {
    return { ref, sha: "", dirty: false, e2e: null, specCopied: false, error: String(e), log };
  }
  open.push(c);
  const dist = join(c.dir, "packages/app/dist");
  const pw = `/dev/shm/shots-compare-${process.pid}-${side}`;
  scratch.push(dist, pw);
  const spec = join(c.dir, SPEC);
  // An old ref without the spec gets today's (its helpers may lack what the spec needs: see the log).
  const specCopied = !existsSync(spec);
  if (specCopied) copyFileSync(join(root, SPEC), spec);
  const base = { ref, sha: c.sha, dirty: c.dirty, specCopied, log };
  try {
    rmSync(dist, { recursive: true, force: true });
    must("pnpm", ["build"], { cwd: c.dir, log });
    const shots = join(out, side);
    rmSync(shots, { recursive: true, force: true });
    mkdirSync(shots, { recursive: true });
    const env = { ...process.env, SHOTS: shots, GLITCH_SPOTS: spotsFile, SHOT_HOUR: String(hour), E2E_PORT: String(e2ePort) };
    return { ...base, e2e: run("pnpm", ["e2e", SPEC, `--output=${pw}`], { cwd: c.dir, log, env }) };
  } catch (e) {
    return { ...base, e2e: null, error: String(e) };
  } finally {
    if (specCopied && !c.own) rmSync(spec, { force: true });
    cleanup();
  }
};

const ffmpeg = (args: string[]): boolean => run("ffmpeg", ["-v", "error", "-y", ...args], { cwd: out, log: join(out, "ffmpeg.log") }) === 0;

const pairOf = (name: string): { pair: string | null; stats: PairStats | null } => {
  const [a, b] = [join(out, "before", `${name}.png`), join(out, "after", `${name}.png`)];
  if (!existsSync(a) || !existsSync(b)) return { pair: null, stats: null };
  const stats = pairStats(decodeRgb(readFileSync(a)), decodeRgb(readFileSync(b)));
  const pair = join(out, "pair", `${name}.png`);
  const scaled = `[0:v]scale=${WIDTH}:-2[a];[1:v]scale=${WIDTH}:-2[b];[a][b]hstack=inputs=2`;
  return { pair: ffmpeg(["-i", a, "-i", b, "-filter_complex", scaled, pair]) ? pair : null, stats };
};

const gridOf = (pairs: string[]): string | null => {
  if (pairs.length === 0) return null;
  const grid = join(out, "grid.png");
  if (pairs.length === 1) {
    copyFileSync(pairs[0]!, grid);
    return grid;
  }
  return ffmpeg([...pairs.flatMap((p) => ["-i", p]), "-filter_complex", `vstack=inputs=${pairs.length}`, grid]) ? grid : null;
};

const main = async (): Promise<number> => {
  mkdirSync(join(out, "pair"), { recursive: true });
  const spotsFile = join(out, "spots.json");
  writeFileSync(spotsFile, `${JSON.stringify(spots)}\n`);
  const loadStart = loadNow();
  const before = shoot("before", refBefore, spotsFile, port);
  const after = shoot("after", refAfter, spotsFile, port + 1);
  const rows = spots.map((spot) => ({ name: spot[0], spot, ...pairOf(spot[0]) }));
  const grid = gridOf(rows.flatMap((r) => (r.pair ? [r.pair] : [])));
  const report = { tool: "shots compare", hour, before, after, load: { start: loadStart, end: loadNow() }, grid, spots: rows };
  writeFileSync(join(out, "report.json"), `${JSON.stringify(report, null, 1)}\n`);
  for (const [side, s] of [["before", before], ["after", after]] as const)
    console.log(`${side}: ${s.ref} ${s.sha.slice(0, 10)}${s.dirty ? " (dirty)" : ""}, e2e ${s.e2e ?? "not run"}${s.error ? `: ${s.error.split("\n")[0]}` : ""}`);
  for (const r of rows) console.log(r.stats ? pairLine(r.name, r.stats) : `${r.name}: no pair (see the logs in ${out})`);
  console.log(`report ${join(out, "report.json")}, grid ${grid ?? "none"}, load ${report.load.start}-${report.load.end}`);
  return before.e2e === 0 && after.e2e === 0 && rows.every((r) => r.pair) ? 0 : 1;
};

process.exitCode = await withCleanup(cleanup, main);
