/**
 * `pnpm osm:trees`: the species tags of the plan's trees (G-423, T-196) from OpenStreetMap into
 * `data/osm/points/trees.json` (network, by hand, never in the build). The trees placed, the plan's
 * (`docs/world/lublin-props.todo.json`) and the extract's it lacks (`data/osm/points/furniture.json`,
 * PR #550: run after `pnpm osm:fetch`), keep their node ids, and the district extracts keep no
 * unnamed nodes (`filterOsm`), so the tags come by id from `api.openstreetmap.org/api/0.6/nodes`,
 * 100 a request, three seconds apart, without retries. Only the trees with a `genus`, `species` or
 * `taxon` are written (`tree-species.ts` reads them). Run `pnpm osm:props` after it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseOsmXml } from "./osm.ts";
import { REPO } from "./paths.ts";
import { loadPropsPlan } from "./props-osm.ts";
import { treeNodeIds } from "./tree-species.ts";

/** Who asks the OSM API (ADR-0042: no user data). */
const USER_AGENT = "SekiSenshi-topo/1.0";
const OSM_DIR = join(REPO, "data/osm");
const BATCH = 100;

/** The tags written, in the order of a row after the id; a row needs one of the first three. */
const TREE_TAGS = ["genus", "species", "taxon", "leaf_type"] as const;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const all = treeNodeIds(loadPropsPlan());
const rows: string[][] = [];
for (let i = 0; i < all.length; i += BATCH) {
  const part = all.slice(i, i + BATCH);
  const res = await fetch(`https://api.openstreetmap.org/api/0.6/nodes?nodes=${part.join(",")}`, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: nodes ${i}`);
  for (const n of parseOsmXml(await res.text()).nodes.values()) {
    const t = n.tags ?? {};
    if (TREE_TAGS.slice(0, 3).some((k) => t[k] !== undefined)) rows.push([`n${n.id}`, ...TREE_TAGS.map((k) => t[k] ?? "")]);
  }
  await pause(3000);
}
rows.sort((a, b) => (a[0]! < b[0]! ? -1 : 1));
const header = { source: "api.openstreetmap.org/api/0.6/nodes", license: "ODbL 1.0, © OpenStreetMap contributors", of: "the placed trees (the plan's and the extract's furniture) with a genus, species or taxon", row: ["id", ...TREE_TAGS] };
mkdirSync(join(OSM_DIR, "points"), { recursive: true });
writeFileSync(join(OSM_DIR, "points", "trees.json"), `{"header":${JSON.stringify(header)},\n"trees":[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]}\n`);
console.log(`trees.json: ${rows.length} of ${all.length} trees`);
