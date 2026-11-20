/**
 * The scan's kinds computed in a node process of their own (`scan-cache.ts`), out of the reach of
 * the test's coverage, by the name of their cache file. Each takes the argument of the cache: ""
 * for the whole city, as the scan runs it, or a part of it for the test that holds the process's
 * results to the test process's (`scan-cache.test.ts`).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { type OsmData, mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { REPO } from "../../osm-import/src/paths.ts";
import { inChunks, walkBlocked } from "./walk-blocked";
import { cityWalkWorld } from "./walk-world";

type Finding = { readonly at: string; readonly what: string };

/** The map data the city is generated from (ADR-0042), read by the scan and its makers alike. */
export const OSM_DIR = join(REPO, "data/osm");
export const readSourceOsm = (): OsmData =>
  mergeOsm(
    readdirSync(OSM_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => parseExtract(readFileSync(join(OSM_DIR, f), "utf8"))),
  );

export const SCAN_MAKERS = {
  /** `walk-blocked` over the whole city, or with `ids` (comma-separated) over those chunks alone. */
  "walk-blocked": (ids: string): Finding[] =>
    walkBlocked(MAP_CHUNKS, cityWalkWorld(extractFeatures(readSourceOsm()).lines), inChunks(MAP_CHUNKS), ids === "" ? undefined : new Set(ids.split(","))),
} satisfies Record<string, (arg: string) => Finding[]>;

export type MadeKind = keyof typeof SCAN_MAKERS;
export const isMadeKind = (name: string): name is MadeKind => Object.hasOwn(SCAN_MAKERS, name);
