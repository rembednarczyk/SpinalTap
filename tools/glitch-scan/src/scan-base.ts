import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type KindBase, formatKind, parseKind } from "./scan-keys.ts";

/**
 * The scan's base on disk: one file a kind, `<kind>.txt` in `tools/glitch-scan/test/baseline/`,
 * so a fix's diff touches only its kinds' files. A kind with no key has no file.
 */

export const BASE_DIR = "tools/glitch-scan/test/baseline";
const EXT = ".txt";

/** The kinds with a file in the base. */
export const baseKinds = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(EXT)).map((f) => f.slice(0, -EXT.length)) : []);

/** A kind's base: no file is no key. */
export const readKind = (dir: string, kind: string): Map<string, number> => {
  const file = join(dir, `${kind}${EXT}`);
  return existsSync(file) ? parseKind(kind, readFileSync(file, "utf8")) : new Map();
};

/** Writes a kind's base, or removes its file when it holds no key. */
export const writeKind = (dir: string, kind: string, base: KindBase): void => {
  const file = join(dir, `${kind}${EXT}`);
  if (base.size === 0) {
    rmSync(file, { force: true });
    return;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, formatKind(kind, base));
};

/** Removes the file of a kind the scan no longer has. */
export const dropKind = (dir: string, kind: string): void => rmSync(join(dir, `${kind}${EXT}`), { force: true });
