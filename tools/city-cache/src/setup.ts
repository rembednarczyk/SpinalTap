/**
 * The tests' shared memory of the city (ADR-0083 step 3), a Vitest setup file: once a worker it
 * installs the steering's store of rasters and fields (`nav-share.ts`), which every simulation of
 * the worker then shares. A speed-up only: the same results without it (`SEKI_CITY_CACHE=off`).
 * `SEKI_CITY_CACHE=stats` prints the store's hits and size after each file.
 *
 * The store lives in this module, beside the simulation's modules, and with them: a worker not
 * isolated (`vitest.config.ts`) keeps them from file to file, an isolated file has its own. Never
 * on `globalThis`: the keys know the content by the identity of its objects (`groundKey`), which a
 * file with modules of its own makes anew.
 */
import { afterAll, expect } from "vitest";
import { shareNav } from "../../../packages/sim/src/systems/ai/nav-share.ts";
import { navStores } from "./nav-stores.ts";

const mode = process.env.SEKI_CITY_CACHE;
if (mode !== "off") {
  const stores = navStores();
  shareNav(stores);
  if (mode === "stats") {
    afterAll(() => {
      const file = expect.getState().testPath ?? "";
      const s = (x: typeof stores.rasters.stats) => `${x.hits}/${x.hits + x.misses} hits, ${x.entries} kept, ${(x.bytes / 2 ** 20).toFixed(0)} MB`;
      const heap = (process.memoryUsage().heapUsed / 2 ** 20).toFixed(0);
      process.stderr.write(`city cache after ${file.replace(/.*\/(packages|tools)\//, "$1/")} (pid ${process.pid}): rasters ${s(stores.rasters.stats)}; fields ${s(stores.fields.stats)}; heap ${heap} MB\n`);
    });
  }
}
