import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { BASE_DIR, baseKinds, readKind } from "./scan-base.ts";
import { type FoundKey, SAMPLED_KINDS, diffKind, formatDiff, parseKind } from "./scan-keys.ts";

/**
 * `pnpm scan:diff <A> <B> [--fail-on-new]`: the glitch scan's keys that came and went from A to B,
 * kind by kind, for the agents' reports and the curator's review (README.md). A side is
 * - a git ref (`origin/main`, a branch, a sha): the base committed there;
 * - `.`: the base in the working tree;
 * - `report` or `report:<file>`: the keys of the last scan run (`reports/glitch-scan.json`), so
 *   `pnpm scan:diff origin/main report` shows what a change does before its base is updated.
 * A ref from before the keys (`glitch-baseline.json`, counts by kind) gives counts only.
 */

/** A side's keys by kind; a report holds only the kinds its run ran (`-t`), `ran`. */
type Side = { readonly keys: Map<string, Map<string, number>>; readonly ran?: ReadonlySet<string> } | { readonly counts: Record<string, number> };

const git = (args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });

const fromRef = (ref: string): Side => {
  const files = git(["ls-tree", "--name-only", ref, `${BASE_DIR}/`]).split("\n").filter((f) => f.endsWith(".txt"));
  if (files.length === 0) {
    const old = "tools/glitch-scan/test/glitch-baseline.json";
    if (git(["ls-tree", "--name-only", ref, old]).trim() === "") throw new Error(`${ref}: no base of the scan`);
    return { counts: JSON.parse(git(["show", `${ref}:${old}`])) as Record<string, number> };
  }
  const keys = new Map<string, Map<string, number>>();
  for (const f of files) {
    const kind = f.slice(f.lastIndexOf("/") + 1, -".txt".length);
    keys.set(kind, parseKind(kind, git(["show", `${ref}:${f}`])));
  }
  return { keys };
};

const fromReport = (file: string): Side => {
  if (!existsSync(file)) throw new Error(`${file} missing: run pnpm exec vitest run tools/glitch-scan/test/glitch-scan.test.ts first`);
  const r = JSON.parse(readFileSync(file, "utf8")) as { keys?: Record<string, Record<string, number>>; counts: Record<string, number> };
  if (!r.keys) return { counts: r.counts };
  return { keys: new Map(Object.entries(r.keys).map(([k, m]) => [k, new Map(Object.entries(m))])), ran: new Set(Object.keys(r.keys)) };
};

const sideOf = (spec: string): Side => {
  if (spec === ".") return { keys: new Map(baseKinds(BASE_DIR).map((k) => [k, readKind(BASE_DIR, k)])) };
  if (spec === "report" || spec.startsWith("report:")) return fromReport(spec === "report" ? "reports/glitch-scan.json" : spec.slice("report:".length));
  return fromRef(spec);
};

const sums = (s: Side): Record<string, number> =>
  "counts" in s ? s.counts : Object.fromEntries([...s.keys].map(([k, m]) => [k, [...m.values()].reduce((a, b) => a + b, 0)]));

const asFound = (m: ReadonlyMap<string, number>): Map<string, FoundKey> => new Map([...m].map(([k, n]) => [k, { n, samples: n, what: "" }]));

const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith("--"));
if (!a || !b) {
  console.error("usage: pnpm scan:diff <ref|.|report[:file]> <ref|.|report[:file]> [--fail-on-new]");
  process.exit(2);
}
const [A, B] = [sideOf(a), sideOf(b)];
let added = 0;
if ("keys" in A && "keys" in B) {
  const ran = (k: string) => [A, B].every((s) => !("ran" in s) || !s.ran || s.ran.has(k));
  const kinds = [...new Set([...A.keys.keys(), ...B.keys.keys()])].filter(ran).sort();
  const lines: string[] = [];
  let [before, after, gone] = [0, 0, 0];
  for (const k of kinds) {
    const d = diffKind(k, A.keys.get(k) ?? new Map(), asFound(B.keys.get(k) ?? new Map()));
    lines.push(...formatDiff(d, Infinity));
    [before, after, gone, added] = [before + d.before, after + d.after, gone + d.removed.length, added + d.added.length + d.grown.length];
  }
  console.log(lines.length ? lines.join("\n") : "no key came or went");
  console.log(`${a} -> ${b}: sum ${before} -> ${after}, ${added} new or grown key(s), ${gone} gone or fewer`);
} else {
  // A side with counts only: the sums by kind.
  const [sa, sb] = [sums(A), sums(B)];
  console.log(`counts only (${"counts" in A ? a : b} has no keys): the sums by kind; a sampled kind's keys are its 10 m squares, not its samples (*)`);
  for (const k of [...new Set([...Object.keys(sa), ...Object.keys(sb)])].sort()) {
    if ((sa[k] ?? 0) === (sb[k] ?? 0)) continue;
    console.log(`${k}${SAMPLED_KINDS.has(k) ? " (*)" : ""}: ${sa[k] ?? 0} -> ${sb[k] ?? 0}`);
    if ((sb[k] ?? 0) > (sa[k] ?? 0)) added++;
  }
}
if (process.argv.includes("--fail-on-new") && added > 0) process.exit(1);
