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
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deserialize, serialize } from "node:v8";
import { threadId } from "node:worker_threads";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import { type Generated, generate } from "../src/generate.ts";
import { loadInputs } from "../src/load.ts";
import { REPO } from "../src/paths.ts";
import { type PropsOut, type PropsPlan, generateProps } from "../src/props-gen.ts";

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

/** The serialised result of `make` under `name`: from this process, from the disk, or computed and stored. */
const cached = <T>(name: string, make: () => T): T => {
  let bytes = memory.get(name);
  if (!bytes) {
    const file = join(DIR, `${name}-${inputKey()}.bin`);
    try {
      bytes = readFileSync(file);
    } catch {
      bytes = serialize(make());
      mkdirSync(DIR, { recursive: true });
      // Parallel workers may compute the same key: each writes its own file and renames it over.
      const tmp = `${file}.${process.pid}-${threadId}.tmp`;
      writeFileSync(tmp, bytes);
      renameSync(tmp, file);
      // One file a name: those of an older key go, with their leftover temporaries.
      for (const old of readdirSync(DIR)) if (old.startsWith(`${name}-`) && !old.startsWith(`${name}-${inputKey()}.`)) rmSync(join(DIR, old), { force: true });
    }
    memory.set(name, bytes);
  }
  return deserialize(bytes) as T;
};

/** The committed tables of every district, as `pnpm osm:props` reads them. */
export const CITY_CHUNKS = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];

/** The plan of the city's furniture. */
export const cityPlan = (): PropsPlan => JSON.parse(readFileSync(join(REPO, "docs/world/lublin-props.todo.json"), "utf8")) as PropsPlan;

/** `generate` of the committed raw data over every chunk, as `pnpm osm:build` runs it. */
export const generatedCity = (): Generated =>
  cached("generate", () => {
    const inputs = loadInputs();
    return generate(inputs.osm, inputs.src, undefined, undefined, undefined, undefined, inputs.covers);
  });

/** `generateProps` of the plan over the committed tables, with no node tags, boards or market. */
export const cityProps = (): PropsOut => cached("props", () => generateProps(cityPlan(), CITY_CHUNKS));
