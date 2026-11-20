/**
 * The whole city, generated once for the tests that only read it: the full `generate` of the
 * committed data takes about 8 s under coverage and the plan's furniture over the committed
 * tables about 2.5 s, and several files ask for the same (docs/plany/czas-testow.md).
 *
 * A process computes each result once; the next process reads it from
 * `node_modules/.cache/seki-city`, under a key of every input: the raw data, the plan and the
 * sources the generators import. A change of any of them is a new key, and the file of the old
 * key goes. Every call returns a fresh copy, so a test may change what it gets. A test of the
 * generator itself (two runs, the same result) calls the generator, not this.
 *
 * A missing result is computed in a node process of its own (`city-make.ts`, `process-cache.ts`),
 * not in the test's: under `--coverage` V8 counts every block the generators run, and their cell
 * loops ran 2-3 times slower for it (the whole city 10.5 s against 5 s), past the test's limit in
 * CI, whose cache is always cold. The tools are not measured for coverage, and the code of core
 * and sim they run is covered by its own tests.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { ALL_CHUNKS } from "../src/config.ts";
import { type Generated, generate } from "../src/generate.ts";
import { loadInputs } from "../src/load.ts";
import { REPO } from "../src/paths.ts";
import { type PropsOut, type PropsPlan, generateProps } from "../src/props-gen.ts";
import { loadPropsPlan } from "../src/props-osm.ts";
import { filesKey, processCache } from "./process-cache.ts";

/** What the generators read: the raw data, the plan, and the sources they import (theirs, core, sim, engine). */
const INPUTS = ["data/osm", "data/terrain", "data/orto", "tools/orto/src","docs/world/lublin-props.todo.json", "tools/osm-import/src", "packages/core/src", "packages/sim/src", "packages/engine/src"];

const filesOf = (path: string): string[] =>
  statSync(join(REPO, path)).isDirectory()
    ? readdirSync(join(REPO, path), { recursive: true, encoding: "utf8" })
        .map((f) => join(path, f))
        .filter((f) => statSync(join(REPO, f)).isFile())
    : [path];

let key: string | undefined;
/**
 * The serialised result of `MAKE[name](arg)`, under the key of every input file's path and bytes
 * (`process-cache.ts`): computed by `city-make.ts`. Every `arg` of the current key keeps a file of its own.
 */
const CACHE = processCache({
  dir: join(REPO, "node_modules/.cache/seki-city"),
  key: () => (key ??= filesKey(REPO, INPUTS.flatMap(filesOf))),
  argv: (name, file, arg) => [fileURLToPath(new URL("./city-make.ts", import.meta.url)), name, file, arg],
});
const cached = <T>(name: keyof typeof MAKE, arg = ""): T => CACHE.get<T>(name, arg);

/** The committed tables of every district, as `pnpm osm:props` reads them. */
export const CITY_CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];

/** The plan of the city's furniture. */
export const cityPlan = (): PropsPlan => loadPropsPlan();

/** What `city-make.ts` computes, by the name of its cache file. */
export const MAKE = {
  /** `generate` of the committed raw data over every chunk, as `pnpm osm:build` runs it. */
  generate: (): Generated => {
    const inputs = loadInputs();
    return generate(inputs.osm, inputs.src, undefined, undefined, undefined, undefined, inputs.covers);
  },
  /** `generateProps` of the plan over the committed tables, with no node tags, boards or market. */
  props: (): PropsOut => generateProps(cityPlan(), CITY_CHUNKS),
  /** `generate` as above, over only the chunks of the comma-separated ids. */
  around: (ids: string): Generated => {
    const inputs = loadInputs();
    const want = new Set(ids.split(","));
    return generate(inputs.osm, inputs.src, ALL_CHUNKS.filter((c) => want.has(c.id)), undefined, undefined, undefined, inputs.covers);
  },
};

/** `generate` of the committed raw data over every chunk, as `pnpm osm:build` runs it. */
export const generatedCity = (): Generated => cached("generate");

/** `generateProps` of the plan over the committed tables, with no node tags, boards or market. */
export const cityProps = (): PropsOut => cached("props");

/**
 * `generate` as `generatedCity` runs it, over only the city's chunks within `margin` of `points`,
 * for a test that reads a few places of the city (ADR-0083: about 1 s a place against 5-7 s for
 * the whole city, cold as in CI). Away from a chunk's edge its ground comes out as in the whole
 * city; at an edge a piece may differ where the next chunk is not built.
 */
export const generatedAround = (points: readonly { readonly x: number; readonly z: number }[], margin = 15): Generated => {
  const near = (r: (typeof ALL_CHUNKS)[number]["rect"]) => points.some((p) => p.x > r.minX - margin && p.x < r.maxX + margin && p.z > r.minZ - margin && p.z < r.maxZ + margin);
  return cached("around", ALL_CHUNKS.filter((c) => near(c.rect)).map((c) => c.id).join(","));
};
