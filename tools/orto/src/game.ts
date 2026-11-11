/**
 * The game's map data the overlay reads: the generated chunks and furniture (plain modules), and
 * the glitch scan's `landuse-bare` check, which reads the shaped city and so goes through Vite's
 * module runner, as `osm-import/src/props.ts` loads the renderer's modules.
 */
import { join } from "node:path";
import { runnerImport } from "vite";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { LUBLIN_PROP_TABLE } from "../../../packages/sim/src/content/lublin/props.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import type * as LanduseBare from "../../glitch-scan/test/landuse-bare.ts";
import { type OsmData } from "../../osm-import/src/osm.ts";
import { REPO } from "./config.ts";

export const CHUNKS: readonly LublinChunkData[] = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];
export const PROP_TABLE = LUBLIN_PROP_TABLE;

/** The scan's `landuse-bare` over the city: whether a 0.5 m sample at (x, z) is counted. */
export const loadLanduseBareAt = async (osm: OsmData): Promise<(x: number, z: number) => boolean> => {
  const { module } = await runnerImport<typeof LanduseBare>(join(REPO, "tools/glitch-scan/test/landuse-bare.ts"), { root: REPO, configFile: false, logLevel: "warn" });
  return module.landuseBareAt(module.cityLanduseWorld(osm));
};
