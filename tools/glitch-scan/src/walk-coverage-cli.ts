import { existsSync, readFileSync } from "node:fs";
import { BASE_DIR, readKind } from "./scan-base.ts";
import { REPLACED, coverageLines } from "./walk-coverage.ts";

/**
 * `pnpm scan:walk-coverage [report]`: the cover of the six older checks of steps by `walk-blocked`
 * (`walk-coverage.ts`), from the base, or with `report` from the last scan run (`reports/glitch-scan.json`).
 */

const fromReport = (file: string): Map<string, Map<string, number>> => {
  if (!existsSync(file)) throw new Error(`${file} missing: run the scan first`);
  const r = JSON.parse(readFileSync(file, "utf8")) as { keys?: Record<string, Record<string, number>> };
  return new Map(Object.entries(r.keys ?? {}).map(([k, m]) => [k, new Map(Object.entries(m))]));
};

const report = process.argv[2] === "report";
const keys = report ? fromReport("reports/glitch-scan.json") : new Map([...REPLACED, "walk-blocked"].map((k) => [k, readKind(BASE_DIR, k)]));
console.log(coverageLines(keys, keys.get("walk-blocked")?.keys() ?? []).join("\n"));
