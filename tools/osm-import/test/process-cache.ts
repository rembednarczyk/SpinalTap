/**
 * Results the tests read, computed in a node process of their own and kept on the disk under a key
 * of every input (`city.ts`, the glitch scan's `scan-cache.ts`): under `--coverage` V8 counts every
 * block a test's process runs, and the cell loops of the city's generators and of the scan ran
 * 2-3 times slower for it, past the test's limit in CI, whose cache is always cold. The tools are
 * not measured for coverage, and the code of core and sim they run is covered by its own tests.
 *
 * A result is read from this process's memory, then from the disk (`<dir>/<name>-<key>[.<arg>].bin`),
 * else computed: `get` waits for the process, `load` does not (a test may start it early, before
 * the tests that read it, and await it there). The maker of a result writes it serialised
 * (`node:v8`) to a temporary file and renames it over the result's own (`writeResult`): parallel
 * workers computing the same key each write a whole file, and a maker left running by a test
 * process that ended still leaves its result. A new key drops the files of the name under the old.
 * Every read returns a fresh copy, so a test may change what it gets.
 */
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deserialize, serialize } from "node:v8";
import { threadId } from "node:worker_threads";

export interface ProcessCacheSpec {
  /** The cache's directory. */
  readonly dir: string;
  /** The key of every input of every result, worked out at most once a process. */
  readonly key: () => string;
  /** The arguments of `node` that write the result of `name` for `arg` to `file` (`writeResult`). */
  readonly argv: (name: string, file: string, arg: string) => readonly string[];
}

export interface ProcessCache {
  /** The result, computed in a process waited for when it is not kept yet. */
  readonly get: <T>(name: string, arg?: string) => T;
  /** The result, computed in a process not waited for when it is not kept yet: each (name, arg) once. */
  readonly load: <T>(name: string, arg?: string) => Promise<T>;
}

/** sha256 of every file's path and bytes, in a fixed order (relative to `root`). */
export const filesKey = (root: string, files: readonly string[]): string => {
  const h = createHash("sha256");
  for (const f of [...files].sort()) h.update(f).update("\0").update(readFileSync(join(root, f))).update("\0");
  return h.digest("hex").slice(0, 32);
};

/** Writes a maker's result to `file`: whole, through a temporary file renamed over it. */
export const writeResult = (file: string, value: unknown): void => {
  const tmp = `${file}.${process.pid}-${threadId}.tmp`;
  writeFileSync(tmp, serialize(value));
  renameSync(tmp, file);
};

/** The maker's environment: no coverage of the test's process. */
const makerEnv = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  delete env.NODE_V8_COVERAGE;
  return env;
};

export const processCache = (spec: ProcessCacheSpec): ProcessCache => {
  const memory = new Map<string, Buffer>();
  const pending = new Map<string, Promise<Buffer>>();
  const idOf = (name: string, arg: string) => (arg === "" ? name : `${name}.${createHash("sha256").update(arg).digest("hex").slice(0, 16)}`);
  const fileOf = (name: string, id: string) => join(spec.dir, `${name}-${spec.key()}${id.slice(name.length)}.bin`);
  const kept = (file: string): Buffer | undefined => {
    try {
      return readFileSync(file);
    } catch {
      return undefined;
    }
  };
  /** The files of a name under an older key go, with their leftover temporaries. */
  const prune = (name: string): void => {
    for (const old of readdirSync(spec.dir)) if (old.startsWith(`${name}-`) && !old.startsWith(`${name}-${spec.key()}.`)) rmSync(join(spec.dir, old), { force: true });
  };
  const made = (name: string, id: string, file: string): Buffer => {
    const bytes = readFileSync(file);
    prune(name);
    memory.set(id, bytes);
    return bytes;
  };
  const get = <T>(name: string, arg = ""): T => {
    const id = idOf(name, arg);
    let bytes = memory.get(id);
    if (!bytes) {
      const file = fileOf(name, id);
      bytes = kept(file);
      if (bytes) memory.set(id, bytes);
      else {
        mkdirSync(spec.dir, { recursive: true });
        execFileSync(process.execPath, spec.argv(name, file, arg), { env: makerEnv(), stdio: ["ignore", "ignore", "pipe"] });
        bytes = made(name, id, file);
      }
    }
    return deserialize(bytes) as T;
  };
  const load = async <T>(name: string, arg = ""): Promise<T> => {
    const id = idOf(name, arg);
    let job = pending.get(id);
    if (!job) {
      const file = fileOf(name, id);
      const now = memory.get(id) ?? kept(file);
      job = now
        ? Promise.resolve(now)
        : new Promise<Buffer>((resolve, reject) => {
            mkdirSync(spec.dir, { recursive: true });
            execFile(process.execPath, spec.argv(name, file, arg), { env: makerEnv(), maxBuffer: 64 * 2 ** 20 }, (error, _out, err) =>
              error ? reject(new Error(`${name} ${arg}: the maker failed\n${err}`, { cause: error })) : resolve(made(name, id, file)),
            );
          });
      pending.set(id, job);
    }
    const bytes = await job;
    memory.set(id, bytes);
    return deserialize(bytes) as T;
  };
  return { get, load };
};
