/** Reads the committed raw data (`data/osm`, `data/terrain`, `data/gugik`): offline, no network. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Lod1Building, loadLod1, tilesOf } from "../../gugik/src/extracts.ts";
import { ALL_CHUNKS, DISTRICTS } from "./config.ts";
import { type Dtm, type DtmHeader, type HeightSource, type Lattice, dtmFromBytes, heightSource } from "./dtm.ts";
import { type OsmData, mergeOsm, parseExtract } from "./osm.ts";
import { REPO } from "./paths.ts";

export interface Inputs {
  readonly osm: OsmData;
  readonly dtms: readonly Dtm[];
  readonly src: HeightSource;
  /** Which terrain model answered: the GUGiK NMT for every district, or the EU-DEM fallback somewhere. */
  readonly terrain: "nmt" | "eu-dem";
  /** GUGiK LoD1 2024 buildings of the tiles under the chunks (ADR-0077 step 3). */
  readonly lod1: readonly Lod1Building[];
}

/** The LoD1 tiles meeting any chunk of the import, 50 m round it (a tile holds a building by its centroid). */
const lod1Tiles = (): string[] => [...new Set(ALL_CHUNKS.flatMap(({ rect: r }) => tilesOf({ minX: r.minX - 50, minZ: r.minZ - 50, maxX: r.maxX + 50, maxZ: r.maxZ + 50 })))].sort();

export const loadInputs = (root = REPO): Inputs => {
  const osm = mergeOsm(DISTRICTS.map((d) => parseExtract(readFileSync(join(root, "data/osm", `${d.slug}.json`), "utf8"))));
  const dtms: Dtm[] = [];
  let fallback: Lattice | null = null;
  let terrain: Inputs["terrain"] = "nmt";
  for (const d of DISTRICTS) {
    const head = join(root, "data/terrain", `${d.slug}.json`);
    if (existsSync(head)) {
      dtms.push({ header: JSON.parse(readFileSync(head, "utf8")) as DtmHeader, cells: dtmFromBytes(new Uint8Array(readFileSync(join(root, "data/terrain", `${d.slug}.bin`)))) });
      continue;
    }
    const eu = join(root, "data/terrain", `${d.slug}.eudem.json`);
    if (!existsSync(eu)) throw new Error(`no terrain for ${d.slug}: run pnpm osm:fetch`);
    // The fallback lattices of several districts never overlap; the first one answers.
    fallback ??= JSON.parse(readFileSync(eu, "utf8")) as Lattice;
    terrain = "eu-dem";
  }
  return { osm, dtms, src: heightSource(dtms, fallback), terrain, lod1: loadLod1(lod1Tiles(), join(root, "data/gugik")) };
};
