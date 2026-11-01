/**
 * `pnpm osm:hydrants`: the fire hydrants of OpenStreetMap (`emergency=fire_hydrant`) over the
 * districts of `config.ts` into `data/osm/points/hydrants.json` (network, by hand, never in the build).
 * The district extracts keep only named points of interest (`filterOsm`), so the hydrants, which
 * have no name, have a file of their own (ADR-0058 stage 2), in a folder apart from the district
 * extracts, which the glitch scan reads one and all. Same tiles, API and cache as
 * `pnpm osm:fetch` (`data/osm/cache/`, not committed); `--refresh` refetches the tiles.
 *
 * The pillar hydrants (`fire_hydrant:type=pillar`) then become the group `osm.hydrants` of
 * `docs/world/lublin-props.todo.json`, points with their node ids; the underground ones are left
 * out (a cover in the pavement, no model yet). Run `pnpm osm:props` after it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS, FETCH_MARGIN, MAX_TILE_DEG } from "./config.ts";
import { parseOsmXml } from "./osm.ts";
import { REPO } from "./paths.ts";
import { geoToWorld, worldToGeo } from "./project.ts";

/** Who asks the OSM API (ADR-0042: no user data). */
const USER_AGENT = "SekiSenshi-topo/1.0";
const OSM_DIR = join(REPO, "data/osm");
const CACHE = join(OSM_DIR, "cache");
const refresh = process.argv.includes("--refresh");

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One hydrant: OSM node id, position, `fire_hydrant:type` and `fire_hydrant:position` ("" when untagged). */
export type HydrantRow = [id: number, lat: number, lon: number, type: string, position: string];

const rows = new Map<number, HydrantRow>();
mkdirSync(CACHE, { recursive: true });
for (const d of DISTRICTS) {
  const sw = worldToGeo({ x: d.rect.minX - FETCH_MARGIN, z: d.rect.minZ - FETCH_MARGIN });
  const ne = worldToGeo({ x: d.rect.maxX + FETCH_MARGIN, z: d.rect.maxZ + FETCH_MARGIN });
  const nx = Math.ceil((ne.lon - sw.lon) / MAX_TILE_DEG.lon);
  const nz = Math.ceil((ne.lat - sw.lat) / MAX_TILE_DEG.lat);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const b = [sw.lon + ((ne.lon - sw.lon) * i) / nx, sw.lat + ((ne.lat - sw.lat) * j) / nz, sw.lon + ((ne.lon - sw.lon) * (i + 1)) / nx, sw.lat + ((ne.lat - sw.lat) * (j + 1)) / nz].map((v) =>
        v.toFixed(5),
      );
      const file = join(CACHE, `osm-${b.join("_")}.osm`);
      if (refresh || !existsSync(file)) {
        console.log(`osm ${d.slug} tile ${i},${j}: ${b.join(",")}`);
        const res = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${b.join(",")}`, { headers: { "User-Agent": USER_AGENT } });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${b.join(",")}`);
        writeFileSync(file, new Uint8Array(await res.arrayBuffer()));
        await pause(3000);
      }
      for (const n of parseOsmXml(readFileSync(file, "utf8")).nodes.values()) {
        if (n.tags?.emergency !== "fire_hydrant") continue;
        rows.set(n.id, [n.id, n.lat, n.lon, n.tags["fire_hydrant:type"] ?? "", n.tags["fire_hydrant:position"] ?? ""]);
      }
    }
}
const sorted = [...rows.values()].sort((a, b) => a[0] - b[0]);
const header = { source: "api.openstreetmap.org/api/0.6/map", license: "ODbL 1.0, © OpenStreetMap contributors", filter: "emergency=fire_hydrant" };
mkdirSync(join(OSM_DIR, "points"), { recursive: true });
writeFileSync(join(OSM_DIR, "points", "hydrants.json"), `{"header":${JSON.stringify(header)},\n"hydrants":[\n${sorted.map((r) => JSON.stringify(r)).join(",\n")}\n]}\n`);
console.log(`hydrants.json: ${sorted.length} hydrants, ${sorted.filter((r) => r[3] === "pillar").length} pillar`);

// The plan's group, one item per line like the rest of the plan.
const PLAN = join(REPO, "docs/world/lublin-props.todo.json");
const pillars = sorted.filter((r) => r[3] === "pillar");
const r1 = (v: number): number => Math.round(v * 10) / 10;
const item = {
  id: "osm.hydrants",
  kind: "hydrant",
  area: { district: "mixed", place: "Hydranty nadziemne z OSM" },
  points: pillars.map((r) => {
    const p = geoToWorld(r[1], r[2]);
    return [r1(p.x), r1(p.z)];
  }),
  count: pillars.length,
  priority: "P3",
  osm: pillars.map((r) => `n${r[0]}`),
  inOsm: true,
  look: "Hydrant nadziemny (fire_hydrant:type=pillar).",
  cyberpunk: "Hydrant z czujnikiem ciśnienia i diodą stanu, okopcony, oklejony wlepkami.",
  note: "Z data/osm/points/hydrants.json (pnpm osm:hydrants), tylko nadziemne; podziemne pominięte (pokrywa w chodniku, bez modelu). Stoi najwyżej 3 m od węzła.",
};
// The plan's spacing: ", " between items and ": " after keys.
const json = `  ${JSON.stringify(item)
  .replace(/":/g, '": ')
  .replace(/,(?=["[{\d-])/g, ", ")}`;
const lines = readFileSync(PLAN, "utf8").split("\n");
const at = lines.findIndex((l) => l.startsWith('  {"id": "osm.hydrants"'));
if (at >= 0) lines[at] = json + (lines[at]!.trimEnd().endsWith(",") ? "," : "");
else {
  const end = lines.lastIndexOf(" ]");
  lines[end - 1] = `${lines[end - 1]},`;
  lines.splice(end, 0, json);
}
writeFileSync(PLAN, lines.join("\n"));
console.log(`plan: osm.hydrants with ${pillars.length} pillar hydrants`);
