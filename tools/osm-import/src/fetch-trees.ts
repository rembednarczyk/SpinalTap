/**
 * `pnpm osm:trees`: the species tags of the plan's trees (G-423, T-196) from OpenStreetMap into
 * `data/osm/points/trees.json` (network, by hand, never in the build). The plan
 * (`docs/world/lublin-props.todo.json`) keeps the trees' node ids and the district extracts no
 * unnamed nodes (`filterOsm`), so the tags come by id from `api.openstreetmap.org/api/0.6/nodes`,
 * 100 a request, three seconds apart, without retries. Only the trees with a `genus`, `species` or
 * `taxon` are written (`tree-species.ts` reads them). Run `pnpm osm:props` after it.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseOsmXml } from "./osm.ts";
import { REPO } from "./paths.ts";

/** Who asks the OSM API (ADR-0042: no user data). */
const USER_AGENT = "SekiSenshi-topo/1.0";
const OSM_DIR = join(REPO, "data/osm");
const PLAN = join(REPO, "docs/world/lublin-props.todo.json");
const BATCH = 100;

/** The tags written, in the order of a row after the id; a row needs one of the first three. */
const TREE_TAGS = ["genus", "species", "taxon", "leaf_type"] as const;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const plan = JSON.parse(readFileSync(PLAN, "utf8")) as { items: { kind: string; osm?: unknown }[] };
const ids = new Set<number>();
for (const item of plan.items) {
  if (item.kind !== "tree" || !Array.isArray(item.osm)) continue;
  for (const o of item.osm as string[]) if (o[0] === "n") ids.add(Number(o.slice(1)));
}

const rows: string[][] = [];
const all = [...ids].sort((a, b) => a - b);
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
const header = { source: "api.openstreetmap.org/api/0.6/nodes", license: "ODbL 1.0, © OpenStreetMap contributors", of: "the plan's trees with a genus, species or taxon", row: ["id", ...TREE_TAGS] };
mkdirSync(join(OSM_DIR, "points"), { recursive: true });
writeFileSync(join(OSM_DIR, "points", "trees.json"), `{"header":${JSON.stringify(header)},\n"trees":[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]}\n`);
console.log(`trees.json: ${rows.length} of ${ids.size} trees`);
