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
 * A missing result is computed in a node process of its own (`city-make.ts`), not in the test's:
 * under `--coverage` V8 counts every block the generators run, and their cell loops ran 2-3 times
 * slower for it (the whole city 10.5 s against 5 s), past the test's limit in CI, whose cache is
 * always cold. The tools are not measured for coverage, and the code of core and sim they run is
 * covered by its own tests.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deserialize } from "node:v8";
import { threadId } from "node:worker_threads";
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

/** What the generators read: the raw data, the plan, and the sources they import (theirs, core, sim, engine). */
const INPUTS = ["data/osm", "data/terrain", "data/orto", "tools/orto/src","docs/world/lublin-props.todo.json", "tools/osm-import/src", "packages/core/src", "packages/sim/src", "packages/engine/src"];
const DIR = join(REPO, "node_modules/.cache/seki-city");

const filesOf = (path: string): string[] =>
  statSync(join(REPO, path)).isDirectory()
    ? readdirSync(join(REPO, path), { recursive: true, encoding: "utf8" })
        .map((f) => join(path, f))
        .filter((f) => statSync(join(REPO, f)).isFile())
    : [path];

let key: string | undefined;
/** sha256 of every input file's path and bytes, in a fixed order. */
const inputKey = (): string => {
  if (key !== undefined) return key;
  const h = createHash("sha256");
  for (const f of INPUTS.flatMap(filesOf).sort()) h.update(f).update("\0").update(readFileSync(join(REPO, f))).update("\0");
  return (key = h.digest("hex").slice(0, 32));
};

const memory = new Map<string, Buffer>();

/** The cache file of `MAKE[name](arg)` under the current key, and the id its bytes keep in this process. */
const fileOf = (name: keyof typeof MAKE, arg: string): { id: string; file: string } => {
  const id = arg === "" ? name : `${name}.${createHash("sha256").update(arg).digest("hex").slice(0, 16)}`;
  return { id, file: join(DIR, `${name}-${inputKey()}${id.slice(name.length)}.bin`) };
};

/** Computes `MAKE[name](arg)` in `city-make.ts` into its cache file and returns its bytes. */
const make = (name: keyof typeof MAKE, arg: string, file: string): Buffer => {
  mkdirSync(DIR, { recursive: true });
  // Parallel workers may compute the same key: each writes its own file and renames it over.
  const tmp = `${file}.${process.pid}-${threadId}.tmp`;
  const env = { ...process.env };
  delete env.NODE_V8_COVERAGE;
  execFileSync(process.execPath, [fileURLToPath(new URL("./city-make.ts", import.meta.url)), name, tmp, arg], { env, stdio: ["ignore", "ignore", "pipe"] });
  const bytes = readFileSync(tmp);
  renameSync(tmp, file);
  // The files of a name under an older key go, with their leftover temporaries.
  for (const old of readdirSync(DIR)) if (old.startsWith(`${name}-`) && !old.startsWith(`${name}-${inputKey()}.`)) rmSync(join(DIR, old), { force: true });
  return bytes;
};

/**
 * The serialised result of `MAKE[name](arg)`: from this process, from the disk, or computed by
 * `city-make.ts` and stored. Every `arg` of the current key keeps a file of its own.
 */
const cached = <T>(name: keyof typeof MAKE, arg = ""): T => {
  const { id, file } = fileOf(name, arg);
  let bytes = memory.get(id);
  if (!bytes) {
    try {
      bytes = readFileSync(file);
    } catch {
      bytes = make(name, arg, file);
    }
    memory.set(id, bytes);
  }
  return deserialize(bytes) as T;
};

/**
 * The whole city's cache file made before the tests (`tools/city-cache/src/warm-city.ts`, Vitest's
 * `globalSetup`; the user's decision of 26.11): cold, the first test of a shard that asked for the
 * city paid its 9-19 s to the time gate (#1062, #1071), not its own work.
 */
export const warmCity = (): void => {
  const { file } = fileOf("generate", "");
  if (!existsSync(file)) make("generate", "", file);
};

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
