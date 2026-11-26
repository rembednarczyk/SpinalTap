/**
 * `pnpm gugik:roads` (ADR-0104 pkt 4): the BDOT10k carriageways (`OT_SKJZ_L`) over the map, each
 * with its surface width (`SZEROKOSCNAWIERZCHNI`) and road class, into `data/gugik/jezdnie.json`.
 * Offline, from the cached GeoPackage (`pnpm gugik:fetch`), read-only. Only the carriageways
 * within `MARGIN` of the map's chunks are kept: the set covers the whole of Lublin.
 *
 * BDOT10k's carriageways were drawn by GUGiK's operators off the orthophoto (98.5% of Lublin's, its
 * `ZRODLODANYCHGEOMETRYCZNYCH`), the widths to 0.5-1 m: an official reading of the street,
 * independent of the import's own cover classes (`docs/plany/zrodla-przekroju-ulic.md`).
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_CHUNKS } from "../../osm-import/src/config.ts";
import { ringBounds } from "../../osm-import/src/geometry.ts";
import { type CarriagewayRow, DATA_DIR, encode, writeRows } from "./extracts.ts";
import { puwgToWorld } from "./frame.ts";
import { readGpkgColumns } from "./gpkg.ts";
import { CACHE_DIR, LICENSE } from "./sources.ts";

/** How far past the map's chunks a carriageway is kept (m): a street's way runs on past the chunk it is laid in. */
const MARGIN = 200;

const map = ALL_CHUNKS.map((c) => c.rect).reduce((a, r) => ({ minX: Math.min(a.minX, r.minX), minZ: Math.min(a.minZ, r.minZ), maxX: Math.max(a.maxX, r.maxX), maxZ: Math.max(a.maxZ, r.maxZ) }));
const near = (b: ReturnType<typeof ringBounds>) => b.minX < map.maxX + MARGIN && map.minX - MARGIN < b.maxX && b.minZ < map.maxZ + MARGIN && map.minZ - MARGIN < b.maxZ;

const dir = join(CACHE_DIR, "bdot");
const file = readdirSync(dir).find((f) => f.endsWith("__OT_SKJZ_L.gpkg"));
if (!file) throw new Error(`no OT_SKJZ_L in ${dir}: run pnpm gugik:fetch`);
const rows: CarriagewayRow[] = [];
for (const f of readGpkgColumns(join(dir, file), ["SZEROKOSCNAWIERZCHNI", "KLASADROGI"])) {
  f.lines.forEach((l, i) => {
    const line = l.map(([e, n]) => puwgToWorld(e, n));
    const width = f.values.SZEROKOSCNAWIERZCHNI;
    if (line.length >= 2 && near(ringBounds(line))) rows.push([f.lines.length > 1 ? `${f.id}/${i}` : f.id, typeof width === "number" ? width : null, String(f.values.KLASADROGI ?? ""), encode(line)]);
  });
}
rows.sort((a, b) => a[0].localeCompare(b[0]));
const head = { license: LICENSE, source: "BDOT10k OT_SKJZ_L (powiat 0663), pnpm gugik:roads", row: "[LOKALNYID, SZEROKOSCNAWIERZCHNI | null, KLASADROGI, line]", line: "decimetres, delta-coded [x0, z0, dx1, dz1, ...]" };
writeFileSync(join(DATA_DIR, "jezdnie.json"), writeRows(head, "carriageways", rows));
console.log(`gugik roads: ${rows.length} carriageways (${rows.filter((r) => r[1] !== null).length} with a width) → ${join(DATA_DIR, "jezdnie.json")}`);
