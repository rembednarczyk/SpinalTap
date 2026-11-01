/**
 * `pnpm osm:entrances`: the entrances and doors of OpenStreetMap (nodes with `entrance=*` or
 * `door=*`) over the districts of `config.ts` into `data/osm/points/entrances.json` (network, by
 * hand, never in the build). The district extracts keep a way's nodes without their tags (only
 * zebras and signals keep theirs, `filterOsm`), so the entrances, nodes of the building outlines,
 * have a file of their own beside the hydrants (ADR-0058 stage 9). Same tiles, API and cache as
 * `pnpm osm:fetch` (`data/osm/cache/`, not committed); `--refresh` refetches the tiles.
 *
 * The doors on the facades then follow from it (`props-doors.ts`, `pnpm osm:props`): an entrance on
 * a drawn wall gets a door there.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS, FETCH_MARGIN, MAX_TILE_DEG } from "./config.ts";
import { parseOsmXml } from "./osm.ts";
import { REPO } from "./paths.ts";
import { worldToGeo } from "./project.ts";

/** Who asks the OSM API (ADR-0042: no user data). */
const USER_AGENT = "SekiSenshi-topo/1.0";
const OSM_DIR = join(REPO, "data/osm");
const CACHE = join(OSM_DIR, "cache");
const refresh = process.argv.includes("--refresh");

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One entrance: OSM node id, position, `entrance`, `door` and `level` ("" when untagged). */
export type EntranceRow = [id: number, lat: number, lon: number, entrance: string, door: string, level: string];

const rows = new Map<number, EntranceRow>();
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
        const t = n.tags;
        if (t?.entrance === undefined && t?.door === undefined) continue;
        rows.set(n.id, [n.id, n.lat, n.lon, t.entrance ?? "", t.door ?? "", t.level ?? ""]);
      }
    }
}
const sorted = [...rows.values()].sort((a, b) => a[0] - b[0]);
const header = { source: "api.openstreetmap.org/api/0.6/map", license: "ODbL 1.0, © OpenStreetMap contributors", filter: "entrance=* or door=*" };
mkdirSync(join(OSM_DIR, "points"), { recursive: true });
writeFileSync(join(OSM_DIR, "points", "entrances.json"), `{"header":${JSON.stringify(header)},\n"entrances":[\n${sorted.map((r) => JSON.stringify(r)).join(",\n")}\n]}\n`);
const kinds = new Map<string, number>();
for (const r of sorted) kinds.set(r[3] || `door=${r[4]}`, (kinds.get(r[3] || `door=${r[4]}`) ?? 0) + 1);
console.log(`entrances.json: ${sorted.length} entrances (${[...kinds].map(([k, n]) => `${k} ${n}`).join(", ")})`);
