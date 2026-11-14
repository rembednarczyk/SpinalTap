import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OUT_DIR, SCAN_REPORT, TABLE_DIR, WORK_DIR } from "./config.ts";
import { fileTable, readManifests, restoreDateOnly } from "./files.ts";
import { type HashRow, type MapState, type OrtoSummary, type Report, type StepLine, type WidthStats, buildReport, fileChanges } from "./report.ts";
import { renderReport } from "./render.ts";
import { RateLimited, runCommand } from "./run.ts";
import { readScanDiff } from "./scan.ts";
import { type PlanOptions, type Planned, type Step, STEPS, osmFetchUnsafe, plan } from "./steps.ts";
import type { TableStats } from "./table-stats.ts";

export interface RefreshOptions extends PlanOptions {
  readonly root: string;
  /** The steps (default `STEPS`); a test gives its own. */
  readonly steps?: readonly Step[];
  /** The build steps run a second time: their files must come out the same, byte for byte. */
  readonly twice: boolean;
  /** The steps' output only to their logs. */
  readonly quiet?: boolean;
}

export interface RefreshResult {
  readonly report: Report;
  /** Seconds a step took (the console's, never in the report). */
  readonly seconds: Record<string, number>;
  /** 0 when every step that ran succeeded, 1 otherwise. */
  readonly code: number;
}

const HERE = new URL(".", import.meta.url).pathname;

/** The tables' counts of `root`, in a process of its own (no module cache between before and after). */
const statsOf = (root: string): TableStats => {
  const out = join(root, WORK_DIR, "table-stats.json");
  const r = spawnSync("node", [join(HERE, "table-stats.ts"), root, out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`table-stats: ${r.stderr}`);
  return JSON.parse(readFileSync(out, "utf8")) as TableStats;
};

const readJson = <T>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null);
const widthsOf = (root: string, name: string) => readJson<{ widths: WidthStats }>(join(root, WORK_DIR, name))?.widths ?? null;
const stateOf = (root: string, widths: WidthStats | null): MapState => ({ files: fileTable(root), stats: statsOf(root), widths });

const baseOf = (root: string): string => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "-";
  }
};

const hashRows = (root: string): HashRow[] => {
  type Raw = { file: string; test: string; comparison: { verdict: string; hashes: { path: string; old: string; new: string }[]; numbersChanged: string[] } | null; message: string };
  const raw = readJson<{ rows: Raw[] }>(join(root, WORK_DIR, "hashes.json"))?.rows ?? [];
  return raw.map((r) => ({
    file: r.file,
    test: r.test,
    verdict: r.comparison?.verdict ?? "not-a-hash",
    hashes: r.comparison?.hashes.map((h) => `${h.path || "skrót"} ${h.old} -> ${h.new}`) ?? [r.message],
    numbersChanged: r.comparison?.numbersChanged ?? [],
  }));
};

/** orto:diff of the base commit against the working tree, when the tables changed (ADR-0077). */
const ortoDiff = async (root: string, base: string, quiet: boolean): Promise<OrtoSummary | null> => {
  const out = join(root, WORK_DIR, "orto-diff.json");
  const work = join(tmpdir(), `map-refresh-orto-${process.pid}`);
  const r = await runCommand(["node", "tools/orto/src/diff.ts", base, "HEAD", "--out", out, "--work", work], root, {}, join(root, WORK_DIR, "orto-diff.log"), quiet);
  rmSync(work, { recursive: true, force: true });
  if (r.code !== 0) return null;
  type Raw = { surfaces: { changedM2: number; byCell: Record<string, Record<string, { added: Record<string, number> }>> }; terrain: { total: { maxAbs: number } }; decks: { changed: unknown[]; added: unknown[]; removed: unknown[] } };
  const d = JSON.parse(readFileSync(out, "utf8")) as Raw;
  const added = (per: Record<string, { added: Record<string, number> }>) => Math.round(Object.values(per).reduce((s, c) => s + Object.values(c.added).reduce((a, b) => a + b, 0), 0) * 10) / 10;
  return {
    changedM2: d.surfaces.changedM2,
    addedM2ByCell: Object.fromEntries(Object.entries(d.surfaces.byCell).sort(([a], [b]) => (a < b ? -1 : 1)).map(([c, per]) => [c, added(per)])),
    terrainMaxAbs: d.terrain.total.maxAbs ?? 0,
    decksChanged: d.decks.changed.length + d.decks.added.length + d.decks.removed.length,
  };
};

/** The widths of the data before the refresh: osm:build counting without writing. */
const widthsBefore = async (root: string, planned: readonly Planned[], quiet: boolean): Promise<WidthStats | null> => {
  const build = planned.find((p) => p.step.id === "osm-build" && !p.skip);
  if (!build) return null;
  const cmd = [...build.step.cmd.map((a) => (a.startsWith("--stats=") ? `--stats=${WORK_DIR}/osm-build-before.json` : a)), "--no-write"];
  const r = await runCommand(cmd, root, build.step.env ?? {}, join(root, WORK_DIR, "osm-build-before.log"), quiet);
  return r.code === 0 ? widthsOf(root, "osm-build-before.json") : null;
};

interface Ran {
  readonly lines: StepLine[];
  readonly seconds: Record<string, number>;
  readonly ran: Set<string>;
}

/** Runs the plan in order; stops after a failed step; throws `RateLimited` at an HTTP 429. */
const runPlan = async (root: string, planned: readonly Planned[], quiet: boolean): Promise<Ran> => {
  const lines: StepLine[] = [];
  const seconds: Record<string, number> = {};
  const ran = new Set<string>();
  let stopped: string | null = null;
  for (const { step, skip } of planned) {
    if (skip || stopped) {
      lines.push({ id: step.id, status: "skipped", note: skip ?? `po nieudanym kroku ${stopped}` });
      continue;
    }
    if (!quiet) console.log(`\n== map:refresh: ${step.id} (${step.cmd.join(" ")})`);
    const t0 = process.hrtime.bigint();
    const r = await runCommand(step.cmd, root, step.env ?? {}, join(root, WORK_DIR, `${step.id}.log`), quiet);
    seconds[step.id] = Number(process.hrtime.bigint() - t0) / 1e9;
    if (r.code !== 0 && step.group === "fetch" && r.rateLimited)
      throw new RateLimited(`${step.id}: HTTP 429 (Too Many Requests). Usługa prosi o przerwę: bez ponowienia, odświeżenie przerwane. Uruchom je później albo z --offline (log: ${WORK_DIR}/${step.id}.log).`);
    if (r.code !== 0 && !step.mayFail) {
      lines.push({ id: step.id, status: "failed", note: `kod ${r.code}, log ${WORK_DIR}/${step.id}.log` });
      stopped = step.id;
      continue;
    }
    ran.add(step.id);
    lines.push({ id: step.id, status: "ran", note: r.code !== 0 ? `kod ${r.code}: wynik w raporcie` : "" });
  }
  return { lines, seconds, ran };
};

/** The build steps again: the watched files must not change (`--twice`). */
const runTwice = async (root: string, planned: readonly Planned[], ran: ReadonlySet<string>, quiet: boolean): Promise<StepLine> => {
  const first = fileTable(root);
  for (const { step } of planned.filter((p) => p.step.group === "build" && ran.has(p.step.id))) {
    const r = await runCommand(step.cmd, root, step.env ?? {}, join(root, WORK_DIR, `${step.id}.twice.log`), quiet);
    if (r.code !== 0) return { id: "twice", status: "failed", note: `${step.id} kod ${r.code} w drugim przebiegu` };
  }
  const diff = fileChanges(first, fileTable(root));
  return diff.length ? { id: "twice", status: "failed", note: `drugi przebieg zmienił: ${diff.map((f) => f.path).join(", ")}` } : { id: "twice", status: "ran", note: "drugi przebieg budowy: pliki bajt w bajt te same" };
};

/** `pnpm map:refresh`: the plan run, the two states compared, the report written to `reports/`. */
export const refresh = async (o: RefreshOptions): Promise<RefreshResult> => {
  const { root } = o;
  const quiet = o.quiet ?? false;
  const steps = o.steps ?? STEPS;
  const planned = plan(root, o, steps);
  const online = !o.offline && steps === STEPS && o.sources.includes("osm") && !o.skip.has("osm-fetch") && !o.skip.has("fetch");
  const unsafe = online ? osmFetchUnsafe(root) : null;
  if (unsafe) throw new Error(`${unsafe}: odświeżenie online odrzucone (zasady sieci agentów). Scal main (PR #550) albo uruchom z --offline.`);
  mkdirSync(join(root, WORK_DIR), { recursive: true });
  for (const f of [SCAN_REPORT, `${WORK_DIR}/hashes.json`, `${WORK_DIR}/osm-build.json`, `${WORK_DIR}/osm-build-before.json`, `${WORK_DIR}/orto-diff.json`]) rmSync(join(root, f), { force: true });
  const base = baseOf(root);
  const [files, stats] = [fileTable(root), statsOf(root)];
  const before: MapState = { files, stats, widths: await widthsBefore(root, planned, quiet) };
  const manifests = readManifests(root);
  const run = await runPlan(root, planned, quiet);
  const restored = restoreDateOnly(root, manifests);
  if (o.twice) run.lines.push(await runTwice(root, planned, run.ran, quiet));
  const after = stateOf(root, widthsOf(root, "osm-build.json"));
  const tablesChanged = fileChanges(before.files, after.files).some((f) => f.path.startsWith(`${TABLE_DIR}/`));
  const canOrto = tablesChanged && !o.skip.has("orto-diff") && base !== "-" && existsSync(join(root, "tools/orto/src/diff.ts"));
  const report = buildReport({
    base,
    mode: { offline: o.offline, sources: o.sources },
    steps: run.lines,
    before,
    after,
    restored,
    scan: run.ran.has("scan") ? readScanDiff(root) : { ran: false, kinds: [] },
    hashes: { ran: run.ran.has("hashes"), rows: run.ran.has("hashes") ? hashRows(root) : [] },
    orto: canOrto ? await ortoDiff(root, base, quiet) : null,
  });
  mkdirSync(join(root, OUT_DIR), { recursive: true });
  writeFileSync(join(root, OUT_DIR, "map-refresh.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(root, OUT_DIR, "map-refresh.md"), renderReport(report));
  return { report, seconds: run.seconds, code: run.lines.some((l) => l.status === "failed") ? 1 : 0 };
};
