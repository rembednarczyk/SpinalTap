/**
 * The scan's kinds computed in a node process of their own (`scan-cache.ts`), out of the reach of
 * the test's coverage, by the name of their cache file: `kinds`, every such kind over the whole
 * city at once, as the scan runs them (one process loads the city's modules once for all), and
 * `walk-blocked` over a part of it, for the test that holds the process's findings to the test
 * process's (`scan-cache.test.ts`).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { planDroneLanes } from "../../../packages/engine/src/renderer/drones/drone-lanes";
import { droneWorldOf, streetAxes } from "../../../packages/engine/src/renderer/drones/drone-world";
import type { PatrolLane } from "../../../packages/engine/src/renderer/drones/patrol-flight";
import { planPatrolLanes } from "../../../packages/engine/src/renderer/drones/patrol-lanes";
import { PATROL_STREETS, patrolWorldOf, quietAt } from "../../../packages/engine/src/renderer/drones/patrol-world";
import { LUBLIN_CHUNKS } from "../../../packages/sim/src/content/lublin";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { groundY, surfaceY } from "../../../packages/sim/src/content/lublin/terrain";
import { WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { type OsmData, mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { REPO } from "../../osm-import/src/paths.ts";
import { patrolChecks } from "./patrol-pieces";
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

/** The low patrols' lanes (ADR-0058 stage 7b) as the renderer plans them from the whole scenery, under the canyon drones' lanes. */
export const cityPatrolLanes = (): readonly PatrolLane[] =>
  planPatrolLanes(patrolWorldOf(WORLD_SCENERY, streetAxes(LUBLIN_CHUNKS, PATROL_STREETS), groundY, quietAt, surfaceY), planDroneLanes(droneWorldOf(WORLD_SCENERY, streetAxes(LUBLIN_CHUNKS), groundY)));

/** `walk-blocked` over the whole city, or with `ids` (comma-separated) over those chunks alone. */
const walkBlockedIn = (ids: string): Finding[] =>
  walkBlocked(MAP_CHUNKS, cityWalkWorld(extractFeatures(readSourceOsm()).lines), inChunks(MAP_CHUNKS), ids === "" ? undefined : new Set(ids.split(",")));

const noMesh = (): never => {
  throw new Error("drone-low-pool reads no mesh");
};

/** The kinds of the scan computed in a process of their own, over the whole city (the scan's `CHECKS` of these names). */
export const MADE_KINDS = {
  "walk-blocked": () => walkBlockedIn(""),
  /** The pools against the paving, needing no mesh of the scenery. */
  "drone-low-pool": () => patrolChecks(cityPatrolLanes, noMesh, surfaceY)["drone-low-pool"]!(),
} satisfies Record<string, () => Finding[]>;

export type MadeKind = keyof typeof MADE_KINDS;

export const SCAN_MAKERS = {
  kinds: (): Record<MadeKind, Finding[]> => Object.fromEntries(Object.entries(MADE_KINDS).map(([k, make]) => [k, make()])) as Record<MadeKind, Finding[]>,
  "walk-blocked": walkBlockedIn,
} satisfies Record<string, (arg: string) => unknown>;

export const isMaker = (name: string): name is keyof typeof SCAN_MAKERS => Object.hasOwn(SCAN_MAKERS, name);
