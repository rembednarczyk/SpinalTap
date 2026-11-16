/**
 * `pnpm tables:check` (ADR-0083): generates the map tables again in memory (`pnpm osm:build --check`,
 * `pnpm osm:props --check`) and compares them byte for byte with the committed ones; the tables carry
 * no fingerprint of their inputs (decision of 16.11), so only generating them tells.
 *
 * `--trace build=<file> --trace props=<file>`, given the lists `read-trace.ts` wrote while CI's
 * "Map tables" job generated them: instead whether every file they read is an input in
 * `table-inputs.ts`, and whether a change of each runs that job (`tools/ci-scope`). Exit 1 with what
 * is wrong and what to run.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { REPO } from "./paths.ts";
import { TABLES, type TableName, missingInputs, unwatchedInputs } from "./table-inputs.ts";

const { values } = parseArgs({ options: { trace: { type: "string", multiple: true } } });
const problems: string[] = [];
const traces = values.trace ?? [];
for (const arg of traces) {
  const [name, file] = arg.split("=") as [TableName, string];
  if (!(name in TABLES) || !file) throw new Error(`tables:check: --trace <${Object.keys(TABLES).join("|")}>=<file>, not ${arg}`);
  const traced = readFileSync(file, "utf8").split("\n");
  const missing = missingInputs(TABLES[name], traced);
  if (missing.length > 0)
    problems.push(`\`${TABLES[name].command}\` read files its inputs leave out; add them to TABLES.${name} in tools/osm-import/src/table-inputs.ts:\n${missing.map((f) => `  ${f}`).join("\n")}`);
  const unwatched = unwatchedInputs(traced);
  if (unwatched.length > 0)
    problems.push(`\`${TABLES[name].command}\` read files a pull request changes without the "Map tables" job running; cover them in tools/ci-scope/src/scope.ts:\n${unwatched.map((f) => `  ${f}`).join("\n")}`);
}
if (traces.length === 0) {
  for (const script of ["build.ts", "props.ts"]) {
    const run = spawnSync(process.execPath, [join(REPO, "tools/osm-import/src", script), "--check"], { cwd: REPO, encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] });
    if (run.status !== 0) problems.push(run.stderr.trim() || `tables:check: ${script} --check failed (${run.status ?? run.signal})`);
  }
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  traces.length > 0
    ? `tables:check: the generators read only their inputs, and a change of any runs the "Map tables" job`
    : `tables:check: ${Object.values(TABLES).flatMap((t) => t.outputs).length} tables are what the generators write from the inputs as they are`,
);
