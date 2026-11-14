/**
 * `pnpm map:refresh [--offline] [--sources=osm,gugik,orto] [--from-cache] [--skip=<step|group>,…] [--twice]`:
 * the city refreshed from its data by one deterministic command, without an agent (README.md):
 * fetch (network, unless `--offline`), extract the caches into `data/`, build the tables, run the
 * glitch scan and the golden hashes, and write the report of the differences with its verdict to
 * `reports/map-refresh.{md,json}`. Exit 0 when every step that ran succeeded, 1 when one failed,
 * 3 at an HTTP 429 (stopped, never asked again in the same run).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { WORK_DIR } from "./config.ts";
import { refresh } from "./pipeline.ts";
import { RateLimited } from "./run.ts";
import { SOURCES, type Source } from "./steps.ts";

const { values: opt } = parseArgs({
  options: {
    offline: { type: "boolean", default: false },
    sources: { type: "string", default: SOURCES.join(",") },
    "from-cache": { type: "boolean", default: false },
    skip: { type: "string", default: "" },
    twice: { type: "boolean", default: false },
    root: { type: "string", default: process.cwd() },
  },
});

const sources = opt.sources.split(",").filter(Boolean);
const unknown = sources.filter((s) => !(SOURCES as readonly string[]).includes(s));
if (unknown.length) {
  console.error(`--sources: unknown ${unknown.join(", ")} (known: ${SOURCES.join(", ")})`);
  process.exit(2);
}

try {
  const t0 = process.hrtime.bigint();
  const { report, seconds, code } = await refresh({
    root: opt.root,
    offline: opt.offline,
    sources: sources as Source[],
    fromCache: opt["from-cache"],
    skip: new Set(opt.skip.split(",").filter(Boolean)),
    twice: opt.twice,
  });
  const total = Number(process.hrtime.bigint() - t0) / 1e9;
  writeFileSync(join(opt.root, WORK_DIR, "times.json"), `${JSON.stringify({ total, steps: seconds }, null, 2)}\n`);
  const v = report.verdict;
  console.log(`\nmap:refresh: ${report.files.length} changed file(s), verdict: ${v.review ? "przegląd kuratora" : "bez przeglądu"}${v.reasons.length ? `\n  ${v.reasons.join("\n  ")}` : ""}`);
  console.log(`time: ${total.toFixed(0)} s (${Object.entries(seconds).map(([k, s]) => `${k} ${s.toFixed(0)} s`).join(", ")}); report: reports/map-refresh.md`);
  process.exitCode = code;
} catch (e) {
  if (e instanceof RateLimited) {
    console.error(`\nmap:refresh: ${e.message}`);
    process.exitCode = 3;
  } else throw e;
}
