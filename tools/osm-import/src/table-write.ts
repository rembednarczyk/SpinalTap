/**
 * Writes a map table, or with `--check` (`pnpm tables:check`, ADR-0083) compares what the generator
 * would write with the committed table, byte for byte, and writes nothing.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { REPO } from "./paths.ts";

export const CHECK = process.argv.includes("--check");

/** Tables whose committed text differs from the generator's, with `--check`. */
export const staleTables: string[] = [];

/** Writes `text` to `file`; with `--check` records the file when its text is another. */
export const writeTable = (file: string, text: string): void => {
  if (!CHECK) {
    writeFileSync(file, text);
    return;
  }
  if (!existsSync(file) || readFileSync(file, "utf8") !== text) staleTables.push(relative(REPO, file));
};

/** With `--check`: the stale tables on stderr and exit 1, if any. */
export const endCheck = (command: string): void => {
  if (!CHECK || staleTables.length === 0) return;
  console.error(
    `${staleTables.join(", ")}: not what \`${command}\` writes from the inputs as they are; run it and commit the tables (ADR-0083; \`pnpm osm:build\` comes before \`pnpm osm:props\`, whose inputs are the districts' tables).`,
  );
  process.exitCode = 1;
};
