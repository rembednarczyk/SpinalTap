import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHECKS, type Check } from "./checklist.ts";
import { type Declaration, type Item, type Report, splitNewPlaces, statusOf, summary, unsettled } from "./evaluate.ts";

/**
 * `pnpm grid:verify <name> [--full] [--start | --stop]`: the checklist of a new grid of map chunks run end to end
 * (`.claude/skills/nowa-siatka/SKILL.md`). Reads the grid's declaration (`docs/siatki/<name>.json`), runs the points a
 * command settles (`--full` the slow gates too), takes the rest from the declaration's decisions and writes
 * `reports/grid-<name>.json` and its summary `reports/grid-<name>.md`. `--start` arms the Stop hook for the grid
 * (`.claude/grid-active`); `--stop` disarms it once every point is settled. Pattern: a definition-of-done checklist
 * enforced by a gate (the release checklist of continuous delivery), here per grid rather than per release.
 */

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const ACTIVE = join(ROOT, ".claude/grid-active");

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const flag = (f: string) => args.includes(f);
if (!name) {
  console.error("użycie: pnpm grid:verify <nazwa> [--full] [--start | --stop]");
  process.exit(2);
}

const declFile = join(ROOT, "docs/siatki", `${name}.json`);
if (!existsSync(declFile)) {
  console.error(`brak deklaracji siatki: docs/siatki/${name}.json (wzór: docs/siatki/README.md)`);
  process.exit(2);
}
const decl = JSON.parse(readFileSync(declFile, "utf8")) as Declaration;
const reportFile = join(ROOT, "reports", `grid-${name}.json`);

const head = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
const dirty = () => execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim() !== "";

if (flag("--stop")) {
  const r = existsSync(reportFile) ? (JSON.parse(readFileSync(reportFile, "utf8")) as Report) : null;
  const left = r ? unsettled(r) : null;
  if (!r || r.head !== head() || r.brudne !== dirty() || (left && left.length > 0)) {
    console.error(`siatka ${name}: raport nieaktualny albo z punktami do rozstrzygnięcia; uruchom pnpm grid:verify ${name} --full`);
    process.exit(1);
  }
  rmSync(ACTIVE, { force: true });
  console.log(`siatka ${name}: hook wyłączony, wszystkie punkty rozstrzygnięte`);
  process.exit(0);
}

/** A command's exit, its output's tail kept for the summary. */
const run = (cmd: readonly string[], env: Record<string, string> = {}): { ok: boolean; tail: string } => {
  console.log(`\n$ ${cmd.join(" ")}`);
  const r = spawnSync(cmd[0]!, cmd.slice(1), { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 1 << 28 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const lines = out.trim().split("\n");
  const telling = lines.filter((l) => /Test Files|Tests |FAIL|×|error/i.test(l)).map((l) => l.trim());
  return { ok: r.status === 0, tail: (telling.length ? telling.slice(0, 4) : lines.slice(-3)).join(" | ") };
};

/** The chunks of the declaration in the coverage register, with a status. */
const declared = (): { ok: boolean; tail: string } => {
  const cells = (JSON.parse(readFileSync(join(ROOT, "docs/mapa-pokrycie.json"), "utf8")) as { komorki: { id: string; status?: string }[] }).komorki;
  const missing = decl.chunki.filter((c) => !cells.some((k) => k.id === c && k.status));
  return { ok: decl.chunki.length > 0 && missing.length === 0, tail: missing.length ? `brak w rejestrze: ${missing.join(", ")}` : `${decl.chunki.length} chunków` };
};

/** The scan run, then its new places against the base, split into the grid's and the rest's. */
const scan = (): { inside: string[]; outside: string[] } => {
  run(["pnpm", "exec", "vitest", "run", "tools/glitch-scan/test/glitch-scan.test.ts"]);
  const diff = spawnSync("pnpm", ["--silent", "scan:diff", decl.baza ?? "origin/main", "report"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 });
  return splitNewPlaces(diff.stdout ?? "", decl.chunki);
};

const results = new Map<string, { ok: boolean | null; tail?: string }>();
const places = scan();
results.set("skan-siatka", { ok: places.inside.length === 0, tail: places.inside.length ? `${places.inside.length} nowych: ${places.inside.slice(0, 3).join("; ")}` : "bez nowych" });
results.set("skan-poza", { ok: places.outside.length === 0, tail: places.outside.length ? `${places.outside.length} nowych: ${places.outside.slice(0, 3).join("; ")}` : "bez nowych" });
results.set("deklaracja", declared());
results.set("sondy", run(["pnpm", "exec", "vitest", "run", "tools/grid-verify/test/grid-probe.test.ts"], { GRID_NAME: name }));
for (const c of CHECKS) {
  if (!c.komenda || results.has(c.id)) continue;
  results.set(c.id, c.pelne && !flag("--full") ? { ok: null, tail: "tylko z --full" } : run(c.komenda));
}

const item = (c: Check): Item => {
  const r = results.get(c.id) ?? { ok: null };
  const decided = decl.decyzje?.[c.id];
  const szczegoly = [r.tail, decided ? `${decided.status}: ${decided.odnosnik}` : undefined].filter(Boolean).join("; ");
  return { id: c.id, faza: c.faza, opis: c.opis, status: statusOf(c, r.ok, decl), ...(szczegoly ? { szczegoly } : {}) };
};
const report: Report = { nazwa: name, head: head(), brudne: dirty(), kiedy: new Date().toISOString(), punkty: CHECKS.map(item) };
mkdirSync(join(ROOT, "reports"), { recursive: true });
writeFileSync(reportFile, JSON.stringify(report, null, 2));
writeFileSync(reportFile.replace(/\.json$/, ".md"), `${summary(report)}\n`);
if (flag("--start")) writeFileSync(ACTIVE, `${name}\n`);
console.log(`\n${summary(report)}`);
process.exit(unsettled(report).length === 0 ? 0 : 1);
