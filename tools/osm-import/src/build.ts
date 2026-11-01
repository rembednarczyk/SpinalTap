/**
 * `pnpm osm:build`: generates `packages/sim/src/content/lublin/*.generated.ts` from the raw
 * data in `data/` (offline) and prints the control numbers.
 */
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS } from "./config.ts";
import { emitDistrict } from "./emit.ts";
import { generate } from "./generate.ts";
import { loadInputs } from "./load.ts";
import { REPO } from "./paths.ts";

const OUT = join(REPO, "packages/sim/src/content/lublin");

const inputs = loadInputs();
const { chunks, stats, venues } = generate(inputs.osm, inputs.src);
mkdirSync(OUT, { recursive: true });
let total = 0;
for (const d of DISTRICTS) {
  const file = join(OUT, `${d.slug}.generated.ts`);
  writeFileSync(file, emitDistrict(d.slug, d.name, chunks.filter((c) => c.district === d.id)));
  const size = statSync(file).size;
  total += size;
  console.log(`${d.slug}.generated.ts: ${(size / 1024).toFixed(0)} KiB`);
}
console.log(`total ${(total / 1024).toFixed(0)} KiB, terrain from ${inputs.terrain}`);
console.log("chunk | buildings | height tag | levels tag | skipped | with holes | ground | cell | max err | p99 err | min y | max y");
for (const s of stats) {
  console.log(
    [s.id, s.buildings, s.fromHeight, s.fromLevels, s.skipped, s.withHoles, s.ground, s.cell, s.terrainError.max.toFixed(2), s.terrainError.p99.toFixed(2), s.minY, s.maxY].join(" | "),
  );
}
console.log(
  `venues ${venues.total}: ${venues.signed} signed, ${venues.named} named from the table, ${venues.total - venues.named} generic; colour from osm ${venues.colourOsm}, table ${venues.colourTable}, kind ${venues.colourKind}`,
);
if (process.argv.includes("--landmarks")) {
  for (const c of chunks) {
    for (const b of c.buildings) {
      if (!b.name || b.use === "commercial") continue;
      console.log(`${c.id} ${b.id} (${b.x}, ${b.z}) y ${b.y} h ${b.height} plinth ${b.plinth} roof ${b.roof ?? 0} levels ${b.levels} ${b.use} ${b.source} parts ${b.parts.length}: ${b.name}`);
    }
  }
}
