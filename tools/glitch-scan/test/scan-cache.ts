/**
 * The scan's costly kinds computed once a key in a node process of their own (`scan-make.ts`,
 * `process-cache.ts`) and kept in `node_modules/.cache/seki-scan`, as the whole city is
 * (`tools/osm-import/test/city.ts`): `walk-blocked` laid its raster of 0.25 m over the city (5.8
 * million heights) in 2.6 s, and in 7.4-8 s under the test's coverage, past the limit of 20 s on a
 * loaded CI runner (PR #806). The tools are not measured for coverage, and the code of core and sim
 * the kind runs is covered by its own tests; `scan-cache.test.ts` holds the process's findings to
 * those of the test's own on a part of the city.
 *
 * The key is every input of the makers: the modules `scan-make.ts` loads, followed through their
 * imports (`moduleClosure`, as the map tables' inputs are), and the data they read (`MAKER_DATA`).
 * The scan starts a cold kind's process before its first test (`startMade`) and awaits it there.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { REPO } from "../../osm-import/src/paths.ts";
import { moduleClosure } from "../../osm-import/src/table-inputs.ts";
import { filesKey, processCache } from "../../osm-import/test/process-cache.ts";
import type { MadeKind } from "./scan-makers.ts";

type Finding = { readonly at: string; readonly what: string };

const here = (f: string) => fileURLToPath(new URL(f, import.meta.url));
const MAKE = here("./scan-make.ts");
const RESOLVE = here("./node-resolve.ts");
const rel = (f: string) => f.slice(REPO.length);

const filesUnder = (path: string): string[] =>
  statSync(join(REPO, path)).isDirectory()
    ? readdirSync(join(REPO, path), { recursive: true, encoding: "utf8" })
        .map((f) => join(path, f))
        .filter((f) => statSync(join(REPO, f)).isFile())
    : [path];

/** Every input of the makers: their modules and their data, relative to the repository. */
export const makerInputs = (): string[] => [...new Set([...moduleClosure([rel(MAKE), rel(RESOLVE)]), ...MAKER_DATA.flatMap(filesUnder)])].sort();

/**
 * The data the makers read besides their modules (`readSourceOsm`). Here, not beside the makers:
 * this module loads no module of the city, so a test may start a process before it loads them.
 */
const MAKER_DATA = ["data/osm"];

let key: string | undefined;
const CACHE = processCache({
  dir: join(REPO, "node_modules/.cache/seki-scan"),
  key: () => (key ??= filesKey(REPO, makerInputs())),
  argv: (name, file, arg) => ["--experimental-transform-types", "--disable-warning=ExperimentalWarning", "--import", RESOLVE, MAKE, name, file, arg],
});

/** The kind's findings over the city (`arg` ""), or over a part of it, from its own process. */
export const madeFindings = (kind: MadeKind, arg = ""): Promise<Finding[]> => CACHE.load<Finding[]>(kind, arg);

/** Starts the kind's process, if its findings are not kept yet, for a test to await later: a failure comes there. */
export const startMade = (kind: MadeKind, arg = ""): void => void madeFindings(kind, arg).catch(() => undefined);
