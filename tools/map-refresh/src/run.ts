import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";

/** A service said HTTP 429: the refresh stops there and asks again only on a later run. */
export class RateLimited extends Error {}

export interface RunResult {
  readonly code: number;
  /** The output named HTTP 429 (a 429 status in an error line). */
  readonly rateLimited: boolean;
}

/**
 * A 429 as the fetch scripts report it when they stop: `Error: 429 Too Many Requests: …` (the
 * status text is empty over HTTP/2: `Error: 429 : …`) or `HTTP 429 (no retry): …`.
 */
export const RATE_LIMIT = /HTTP 429\b|Error: 429\b|429 Too Many Requests/;

/**
 * Runs `cmd` in `cwd`, its output both to the console (unless `quiet`) and to `log`. Resolves with
 * its exit code; never throws for a non-zero exit.
 */
export const runCommand = (cmd: readonly string[], cwd: string, env: Readonly<Record<string, string>>, log: string, quiet = false): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    const out = createWriteStream(log);
    let rateLimited = false;
    let tail = "";
    const child = spawn(cmd[0]!, cmd.slice(1), { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    const take = (chunk: Buffer, to: NodeJS.WriteStream) => {
      out.write(chunk);
      if (!quiet) to.write(chunk);
      // A line may be split between chunks: the test runs on the output's last 4000 characters.
      tail = (tail + chunk.toString("utf8")).slice(-4000);
      if (RATE_LIMIT.test(tail)) rateLimited = true;
    };
    child.stdout.on("data", (c: Buffer) => take(c, process.stdout));
    child.stderr.on("data", (c: Buffer) => take(c, process.stderr));
    child.on("error", reject);
    child.on("close", (code) => out.end(() => resolve({ code: code ?? 1, rateLimited })));
  });
