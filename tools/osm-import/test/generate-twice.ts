/**
 * `node generate-twice.ts <chunk ids>`: `generate` of the committed raw data over the
 * comma-separated chunks, twice in this one process on the very same inputs, as `pnpm osm:build`
 * runs it; writes the two emitted tables to stdout as a JSON pair. `generate.test.ts` runs it in a
 * process of its own, out of the reach of its coverage, which ran the generator 2-3 times slower
 * (`city.ts`).
 */
import { ALL_CHUNKS } from "../src/config.ts";
import { emitDistrict } from "../src/emit.ts";
import { generate } from "../src/generate.ts";
import { loadInputs } from "../src/load.ts";

const want = new Set((process.argv[2] ?? "").split(","));
const specs = ALL_CHUNKS.filter((c) => want.has(c.id));
if (specs.length !== want.size) throw new Error(`generate-twice: no chunk among ${[...want].join(", ")}`);
const inputs = loadInputs();
const run = () => {
  const d = specs[0]!.district;
  return emitDistrict(d.slug, d.name, generate(inputs.osm, inputs.src, specs, undefined, inputs.lod1, inputs.lod2, inputs.covers).chunks);
};
const first = run();
process.stdout.write(JSON.stringify([first, run()]));
