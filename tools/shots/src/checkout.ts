/**
 * Checkouts of a git ref for the measuring tools (`compare.ts`, `tools/bench-ab`): a detached
 * worktree with its own `node_modules`, removed again at the end, also on an error or Ctrl-C
 * (the disk is small; agent rules: copies go right after the measurement). The ref `HEAD` is the
 * current checkout itself, uncommitted changes included, and is never removed.
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export interface Checkout {
  readonly ref: string;
  readonly sha: string;
  /** Uncommitted changes in it (only the current checkout can have them). */
  readonly dirty: boolean;
  readonly dir: string;
  /** A worktree made by `openCheckout`, to remove in `closeCheckout`. */
  readonly own: boolean;
}

/** Runs a command with its output appended to `log`; the exit code (1 when it could not start). */
export const run = (cmd: string, args: readonly string[], opts: { cwd: string; log: string; env?: NodeJS.ProcessEnv }): number => {
  const fd = openSync(opts.log, "a");
  try {
    const r = spawnSync(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ["ignore", fd, fd] });
    return r.status ?? 1;
  } finally {
    closeSync(fd);
  }
};

/** The last lines of a log, for an error message. */
export const tail = (log: string, lines = 15): string => (existsSync(log) ? readFileSync(log, "utf8").trimEnd().split("\n").slice(-lines).join("\n") : "");

/** As `run`, but an exit code other than 0 throws with the end of the log. */
export const must = (cmd: string, args: readonly string[], opts: { cwd: string; log: string; env?: NodeJS.ProcessEnv }): void => {
  const code = run(cmd, args, opts);
  if (code !== 0) throw new Error(`${cmd} ${args.join(" ")} (in ${opts.cwd}) exited ${code}; log ${opts.log}:\n${tail(opts.log)}`);
};

const git = (cwd: string, ...args: string[]): string => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout.trim();
};

/** The 1-minute load average (0 where /proc is missing). */
export const loadNow = (): number => {
  try {
    return Number(readFileSync("/proc/loadavg", "utf8").split(" ")[0]);
  } catch {
    return 0;
  }
};

export const repoRoot =(cwd = process.cwd()): string => git(cwd, "rev-parse", "--show-toplevel");

/**
 * The ref checked out: the current checkout for `HEAD`, else a new detached worktree
 * `<work>/<tag>-<sha8>` with `pnpm install --frozen-lockfile --prefer-offline`.
 */
export const openCheckout = (root: string, ref: string, work: string, tag: string, log: string): Checkout => {
  if (ref === "HEAD") {
    const dirty = git(root, "status", "--porcelain", "--untracked-files=no") !== "";
    return { ref, sha: git(root, "rev-parse", "HEAD"), dirty, dir: root, own: false };
  }
  const sha = git(root, "rev-parse", "--verify", `${ref}^{commit}`);
  mkdirSync(work, { recursive: true });
  const dir = join(work, `${tag}-${sha.slice(0, 8)}`);
  if (existsSync(dir)) throw new Error(`${dir} already exists: a run that did not clean up? Remove it with git worktree remove --force ${dir}`);
  must("git", ["worktree", "add", "--detach", dir, sha], { cwd: root, log });
  const checkout = { ref, sha, dirty: false, dir, own: true };
  try {
    must("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: dir, log });
  } catch (e) {
    closeCheckout(root, checkout, log);
    throw e;
  }
  return checkout;
};

/** Removes a worktree made by `openCheckout`; the current checkout stays. Never throws. */
export const closeCheckout = (root: string, c: Checkout, log: string): void => {
  if (!c.own) return;
  run("git", ["worktree", "remove", "--force", c.dir], { cwd: root, log });
  // `git worktree remove` failed (a half-made worktree): the directory by hand, then its entry.
  if (existsSync(c.dir)) {
    rmSync(c.dir, { recursive: true, force: true });
    run("git", ["worktree", "prune"], { cwd: root, log });
  }
};

/**
 * Runs `cleanup` once: at the end of `body`, on an error in it, and on SIGINT or SIGTERM
 * (then the process exits 130 or 143). A signal that comes during a child process is handled
 * when the child ends.
 */
export const withCleanup = async <T>(cleanup: () => void, body: () => Promise<T> | T): Promise<T> => {
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    cleanup();
  };
  const onSignal = (code: number) => () => {
    once();
    process.exit(code);
  };
  const int = onSignal(130);
  const term = onSignal(143);
  process.on("SIGINT", int);
  process.on("SIGTERM", term);
  try {
    return await body();
  } finally {
    once();
    process.off("SIGINT", int);
    process.off("SIGTERM", term);
  }
};
