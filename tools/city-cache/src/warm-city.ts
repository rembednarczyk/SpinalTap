/**
 * Vitest's `globalSetup` of the shared project (the user's decision of 26.11): the whole generated
 * city's cache file (`tools/osm-import/test/city.ts`, `generatedCity`) made once before the tests,
 * in a process of its own, so no test pays the cold build to the time gate (#1062, #1071: 9-19 s to
 * the first test of a shard that asked). Pattern: a session-scoped fixture warming a cache (pytest's
 * session fixtures). With a warm cache (the key of every input unchanged) it only checks the file.
 * `SEKI_CITY_CACHE=off` leaves it out, as the workers' shared memory.
 */
import { warmCity } from "../../osm-import/test/city.ts";

export default function setup(): void {
  if (process.env.SEKI_CITY_CACHE !== "off") warmCity();
}
