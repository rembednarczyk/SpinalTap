/**
 * `pnpm tables:check [--trace build=<file>] [--trace props=<file>]` (ADR-0083 step 1): whether every
 * map table was written from its inputs as they are (the fingerprint in its header, `fingerprint.ts`),
 * and, given the lists `read-trace.ts` wrote while `pnpm osm:build` and `pnpm osm:props` ran, whether
 * every file they read is an input of their fingerprint. Exit 1 with what is wrong and what to run.
 * `pnpm merge:main` asks it whether to generate the tables again; CI's `tables` job checks the traces.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { TABLES, type TableName, missingInputs, staleTable, tableFingerprint } from "./fingerprint.ts";
import { REPO } from "./paths.ts";

const { values } = parseArgs({ options: { trace: { type: "string", multiple: true } } });
const problems: string[] = [];
for (const name of Object.keys(TABLES) as TableName[]) {
  const fingerprint = tableFingerprint(name);
  for (const path of TABLES[name].outputs) {
    const stale = staleTable(path, readFileSync(join(REPO, path), "utf8"), fingerprint, TABLES[name].command);
    if (stale) problems.push(stale);
  }
}
for (const arg of values.trace ?? []) {
  const [name, file] = arg.split("=") as [TableName, string];
  if (!(name in TABLES) || !file) throw new Error(`tables:check: --trace <${Object.keys(TABLES).join("|")}>=<file>, not ${arg}`);
  const missing = missingInputs(TABLES[name], readFileSync(file, "utf8").split("\n"));
  if (missing.length > 0)
    problems.push(`\`${TABLES[name].command}\` read files its fingerprint leaves out; add them to TABLES.${name} in tools/osm-import/src/fingerprint.ts:\n${missing.map((f) => `  ${f}`).join("\n")}`);
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`tables:check: ${Object.values(TABLES).flatMap((t) => t.outputs).length} tables written from their inputs as they are`);
