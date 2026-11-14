/**
 * `pnpm osm:build`: generates `packages/sim/src/content/lublin/*.generated.ts` from the raw
 * data in `data/` (offline) and prints the control numbers; `--stats=<file>` also writes the
 * carriageway widths' sources (m of street side) and the barriers as JSON (`pnpm map:refresh`),
 * and `--no-write` leaves the tables as they are (the numbers of the data before a refresh).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS } from "./config.ts";
import { emitDistrict } from "./emit.ts";
import { generate } from "./generate.ts";
import { loadInputs } from "./load.ts";
import { REPO } from "./paths.ts";
import { reportLine } from "./street-section.ts";

const OUT = join(REPO, "packages/sim/src/content/lublin");

const inputs = loadInputs();
const { chunks, stats, venues, widths } = generate(inputs.osm, inputs.src, undefined, undefined, inputs.lod1, inputs.lod2, inputs.covers);
mkdirSync(OUT, { recursive: true });
let total = 0;
for (const d of DISTRICTS) {
  const file = join(OUT, `${d.slug}.generated.ts`);
  const text = emitDistrict(d.slug, d.name, chunks.filter((c) => c.district === d.id));
  if (!process.argv.includes("--no-write")) writeFileSync(file, text);
  const size = Buffer.byteLength(text);
  total += size;
  console.log(`${d.slug}.generated.ts: ${(size / 1024).toFixed(0)} KiB`);
}
console.log(`total ${(total / 1024).toFixed(0)} KiB, terrain from ${inputs.terrain}`);
console.log("chunk | buildings | height tag | levels tag | lod1 | lod2 | skipped | with holes | ground | cell | max err | p99 err | min y | max y");
for (const s of stats) {
  console.log(
    [s.id, s.buildings, s.fromHeight, s.fromLevels, s.fromLod1, s.fromLod2, s.skipped, s.withHoles, s.ground, s.cell, s.terrainError.max.toFixed(2), s.terrainError.p99.toFixed(2), s.minY, s.maxY].join(" | "),
  );
}
console.log(
  `venues ${venues.total}: ${venues.signed} signed, ${venues.named} named from the table, ${venues.total - venues.named} generic; colour from osm ${venues.colourOsm}, table ${venues.colourTable}, kind ${venues.colourKind}`,
);
console.log(`carriageway widths (ADR-0080), street sides: streets ${reportLine(widths.streets)}; with service ways ${reportLine(widths.all)}`);
const walls = new Map<string, { n: number; m: number }>();
for (const b of chunks.flatMap((c) => c.barriers ?? [])) {
  const e = walls.get(b.kind) ?? { n: 0, m: 0 };
  for (let i = 0; i + 3 < b.line.length; i += 2) e.m += Math.hypot(b.line[i + 2]! - b.line[i]!, b.line[i + 3]! - b.line[i + 1]!);
  walls.set(b.kind, { n: e.n + 1, m: e.m });
}
console.log(`barriers (ADR-0077): ${[...walls].sort().map(([k, e]) => `${k} ${e.n} pieces ${e.m.toFixed(0)} m`).join(", ")}`);
const statsFile = process.argv.find((a) => a.startsWith("--stats="))?.slice("--stats=".length);
if (statsFile) {
  const m = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v)]));
  const barriers = Object.fromEntries([...walls].sort().map(([k, e]) => [k, { pieces: e.n, m: Math.round(e.m) }]));
  writeFileSync(statsFile, `${JSON.stringify({ widths: { streets: m(widths.streets), all: m(widths.all) }, barriers }, null, 2)}\n`);
}
if (process.argv.includes("--landmarks")) {
  for (const c of chunks) {
    for (const b of c.buildings) {
      if (!b.name || b.use === "commercial") continue;
      console.log(`${c.id} ${b.id} (${b.x}, ${b.z}) y ${b.y} h ${b.height} plinth ${b.plinth} roof ${b.roof ?? 0} levels ${b.levels} ${b.use} ${b.source} parts ${b.parts.length}: ${b.name}`);
    }
  }
}
