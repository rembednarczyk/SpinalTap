/** Reads the committed raw data (`data/osm`, `data/terrain`): offline, no network. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS } from "./config.ts";
import { type Dtm, type DtmHeader, type HeightSource, type Lattice, dtmFromBytes, heightSource } from "./dtm.ts";
import { type OsmData, mergeOsm, parseExtract } from "./osm.ts";
import { REPO } from "./paths.ts";

export interface Inputs {
  readonly osm: OsmData;
  readonly dtms: readonly Dtm[];
  readonly src: HeightSource;
  /** Which terrain model answered: the GUGiK NMT for every district, or the EU-DEM fallback somewhere. */
  readonly terrain: "nmt" | "eu-dem";
}

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
  return { osm, dtms, src: heightSource(dtms, fallback), terrain };
};
