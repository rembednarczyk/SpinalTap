import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { coverageSummary, formatSummary } from "./coverage-summary.ts";
import type { CoverageRegister, HitsPerCell } from "./map-coverage.ts";

/**
 * The coverage report (`docs/mapa-pokrycie.md`): run the glitch scan first, which writes the hits
 * per cell to `reports/map-coverage-hits.json`, then
 * `node tools/glitch-scan/src/coverage-report.ts` from the root. Prints the shares and the queue
 * and writes them with the hits to `reports/map-coverage.json`, for the board.
 */

const REGISTER = "docs/mapa-pokrycie.json";
const HITS = "reports/map-coverage-hits.json";

if (!existsSync(HITS)) {
  console.error(`${HITS} missing: run pnpm exec vitest run tools/glitch-scan/test/glitch-scan.test.ts first`);
  process.exit(1);
}
const register = JSON.parse(readFileSync(REGISTER, "utf8")) as CoverageRegister;
const hits = JSON.parse(readFileSync(HITS, "utf8")) as HitsPerCell;
const summary = coverageSummary(register, hits);
mkdirSync("reports", { recursive: true });
writeFileSync("reports/map-coverage.json", JSON.stringify({ summary, hits, register }, null, 2));
console.log(formatSummary(summary));
