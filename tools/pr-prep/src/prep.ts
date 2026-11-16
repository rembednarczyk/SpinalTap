/**
 * `pnpm pr:prep <branch> [--no-fetch] [--prefix <p>] [--out FILE]`: a branch checked before its
 * PR is merged, with git alone (no GitHub API). After `git fetch --prune origin`: the full SHA of
 * its head on origin, whether it merges cleanly with origin/main (`git merge-tree --write-tree`)
 * and which files conflict, the files it shares with the other open branches of the same prefix
 * (`git branch -r`; a branch already in main, by ancestry or by a merge that adds nothing, is not
 * open), and the generated files, golden hashes and baselines it changes, with the branches after
 * whose merge its CI has to run again (`analyze.ts`). One line on stdout; the details as JSON to
 * `--out` (default `reports/pr-prep-<branch>.json`).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { against, guardedIn, summaryLine, type Summary } from "./analyze.ts";

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { "no-fetch": { type: "boolean" }, prefix: { type: "string" }, out: { type: "string" } } });
if (positionals.length !== 1) {
  console.error("usage: pnpm pr:prep <branch> [--no-fetch] [--prefix <p>] [--out FILE]");
  process.exit(2);
}

const git = (args: readonly string[], ok: readonly number[] = [0]): { readonly out: string; readonly code: number } => {
  const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });
  if (!ok.includes(r.status ?? -1)) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
  return { out: r.stdout.trim(), code: r.status ?? -1 };
};
const lines = (s: string) => s.split("\n").filter(Boolean);

const MAIN = "origin/main";
const branch = positionals[0]!.replace(/^origin\//, "");
const remote = `origin/${branch}`;
// The session's branches: `ccr-<id>-<id>-`, the prefix of the branch itself.
const prefix = opt.prefix ?? /^(ccr-[^-]+-[^-]+-)/.exec(branch)?.[1] ?? "";

/** The merge of `ref` into main: clean or not, the conflicting files and the tree. */
const mergeTree = (ref: string): { readonly clean: boolean; readonly conflicts: readonly string[]; readonly tree: string } => {
  const r = git(["merge-tree", "--write-tree", "--name-only", "--no-messages", MAIN, ref], [0, 1]);
  const [tree, ...rest] = lines(r.out);
  return { clean: r.code === 0, conflicts: rest, tree: tree ?? "" };
};

/** Files a branch changes against its merge base with main. */
const changedFiles = (ref: string): string[] => lines(git(["diff", "--name-only", `${MAIN}...${ref}`]).out);

/** Not in main yet: not an ancestor, and merging it would change main's tree. */
const isOpen = (ref: string, mainTree: string): boolean =>
  git(["merge-base", "--is-ancestor", ref, MAIN], [0, 1]).code === 1 && mergeTree(ref).tree !== mainTree;

const main = () => {
  if (!opt["no-fetch"]) git(["fetch", "--prune", "--quiet", "origin"]);
  const sha = git(["rev-parse", "--verify", `${remote}^{commit}`]).out;
  const mainTree = git(["rev-parse", `${MAIN}^{tree}`]).out;
  const merge = mergeTree(remote);
  const [behind, ahead] = git(["rev-list", "--left-right", "--count", `${MAIN}...${remote}`]).out.split(/\s+/).map(Number) as [number, number];
  const mine = changedFiles(remote);
  const candidates = prefix ? lines(git(["branch", "-r", "--list", `origin/${prefix}*`, "--format=%(refname:short)"]).out).filter((r) => r !== remote) : [];
  const open = candidates.filter((r) => isOpen(r, mainTree));
  const others = open.map((r) => against(mine, r.replace(/^origin\//, ""), changedFiles(r)));
  const summary: Summary = { branch, sha, clean: merge.clean, conflicts: merge.conflicts, ahead, behind, guarded: guardedIn(mine), others };
  console.log(summaryLine(summary));
  const out = resolve(opt.out ?? join("reports", `pr-prep-${branch}.json`));
  mkdirSync(dirname(out), { recursive: true });
  const closed = candidates.filter((r) => !open.includes(r));
  writeFileSync(out, `${JSON.stringify({ ...summary, mainSha: git(["rev-parse", MAIN]).out, prefix, files: mine, notOpen: closed }, null, 2)}\n`);
};

main();
