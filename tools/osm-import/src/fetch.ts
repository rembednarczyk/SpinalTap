/**
 * `pnpm osm:fetch`: downloads the raw data for the districts of `config.ts` (network, by hand,
 * never in the build):
 * - OpenStreetMap: `api.openstreetmap.org/api/0.6/map` in tiles under the 50 000-node limit, one
 *   request every few seconds; raw XML is cached in `data/osm/cache/` (not committed) and the
 *   filtered extract goes to `data/osm/<district>.json`.
 * - Terrain: GUGiK NMT 1 m (WCS GetCoverage, GeoTIFF float32) in 500 m tiles, mosaicked per
 *   district into `data/terrain/<district>.{json,bin}`; with `--eudem` the EU-DEM 25 m lattice
 *   (opentopodata, 100 points a second) goes to `data/terrain/<district>.eudem.json` as fallback.
 * - Street furniture and trees: the points of `furniture.ts` from the same raw tiles, before the
 *   extracts drop unnamed nodes, into `data/osm/points/furniture.json`, and the rows of bollards
 *   mapped as lines into `data/osm/points/bollard-lines.json` (G-818); both written only when every
 *   district's tiles were read, so `--only` keeps the files as they were.
 * Flags: `--refresh` refetches cached tiles, `--only=<slug>` limits to one district, `--keep-terrain` keeps a
 *   grown district's mosaic where it had cells (`keepTerrain`),
 * `--skip-osm`, `--skip-dtm`, `--eudem`, `--points-only` (the furniture file alone: no extract, no terrain).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS, type DistrictSpec, ELEVATION_MARGIN, ELEVATION_STEP, FETCH_MARGIN, MAX_TILE_DEG, USER_AGENT } from "./config.ts";
import { DTM_OFFSET, DTM_SCALE, type DtmHeader, dtmFromBytes, dtmToBytes, encodeHeight } from "./dtm.ts";
import { parseAsciiGrid } from "../../gugik/src/nmpt.ts";
import { BOLLARD_LINES_FILE, type BollardLineRow, type FurnitureRow, FURNITURE_FILE, bollardLineRows, furnitureRows, serializeBollardLines, serializeFurniture } from "./furniture.ts";
import { type OsmData, filterOsm, mergeOsm, parseOsmXml, serializeOsm } from "./osm.ts";
import { worldToGeo, worldToPuwg } from "./project.ts";
import { REPO } from "./paths.ts";

const args = new Set(process.argv.slice(2));
const only = [...args].find((a) => a.startsWith("--only="))?.slice(7);
const refresh = args.has("--refresh");
const pointsOnly = args.has("--points-only");
const OSM_DIR = join(REPO, "data/osm");
const CACHE = join(OSM_DIR, "cache");
const TERRAIN_DIR = join(REPO, "data/terrain");

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const get = async (url: string, attempts = 3): Promise<Uint8Array> => {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
    // Too many requests: the service asks to stop, not to be asked again.
    if (res.status === 429 || i >= attempts) throw new Error(`${res.status} ${res.statusText}: ${url}`);
    await pause(5000 * i);
  }
};

/** Geographic box of a world rectangle grown by `margin`. */
const geoBox = (d: DistrictSpec, margin: number) => {
  const sw = worldToGeo({ x: d.rect.minX - margin, z: d.rect.minZ - margin });
  const ne = worldToGeo({ x: d.rect.maxX + margin, z: d.rect.maxZ + margin });
  return { minLon: sw.lon, minLat: sw.lat, maxLon: ne.lon, maxLat: ne.lat };
};

/** The furniture of every tile read, by node id, and its rows of bollards mapped as lines, by way id (`furniture.ts`). */
const furniture = new Map<number, FurnitureRow>();
const bollardLines = new Map<number, BollardLineRow>();

const fetchOsm = async (d: DistrictSpec) => {
  const box = geoBox(d, FETCH_MARGIN);
  const nx = Math.ceil((box.maxLon - box.minLon) / MAX_TILE_DEG.lon);
  const nz = Math.ceil((box.maxLat - box.minLat) / MAX_TILE_DEG.lat);
  const parts = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const f = (v: number) => v.toFixed(5);
      const b = [
        box.minLon + ((box.maxLon - box.minLon) * i) / nx,
        box.minLat + ((box.maxLat - box.minLat) * j) / nz,
        box.minLon + ((box.maxLon - box.minLon) * (i + 1)) / nx,
        box.minLat + ((box.maxLat - box.minLat) * (j + 1)) / nz,
      ].map(f);
      const file = join(CACHE, `osm-${b.join("_")}.osm`);
      if (refresh || !existsSync(file)) {
        console.log(`osm ${d.slug} tile ${i},${j}: ${b.join(",")}`);
        writeFileSync(file, await get(`https://api.openstreetmap.org/api/0.6/map?bbox=${b.join(",")}`));
        await pause(3000);
      }
      const raw: OsmData = parseOsmXml(readFileSync(file, "utf8"));
      for (const r of furnitureRows(raw.nodes.values())) furniture.set(r[0], r);
      for (const r of bollardLineRows(raw)) bollardLines.set(r[0], r);
      if (!pointsOnly) parts.push(filterOsm(raw));
    }
  }
  if (pointsOnly) return;
  const merged = mergeOsm(parts);
  const header = { source: "api.openstreetmap.org/api/0.6/map", license: "ODbL 1.0, © OpenStreetMap contributors", district: d.slug, bbox: box, tiles: nx * nz };
  writeFileSync(join(OSM_DIR, `${d.slug}.json`), serializeOsm(merged, header));
  console.log(`osm ${d.slug}: ${merged.nodes.size} nodes, ${merged.ways.size} ways, ${merged.relations.size} relations`);
};

/** PUWG box (whole metres) around a district's rectangle grown by `margin`. */
const puwgBox = (d: DistrictSpec, margin: number) => {
  const corners = [
    { x: d.rect.minX - margin, z: d.rect.minZ - margin },
    { x: d.rect.maxX + margin, z: d.rect.minZ - margin },
    { x: d.rect.minX - margin, z: d.rect.maxZ + margin },
    { x: d.rect.maxX + margin, z: d.rect.maxZ + margin },
  ].map((p) => worldToPuwg(p));
  return {
    e0: Math.floor(Math.min(...corners.map((c) => c.e))),
    e1: Math.ceil(Math.max(...corners.map((c) => c.e))),
    n0: Math.floor(Math.min(...corners.map((c) => c.n))),
    n1: Math.ceil(Math.max(...corners.map((c) => c.n))),
  };
};

/**
 * The NMT's WCS in ESRI ASCII grid: the same model in PL-KRON86-NH as the GeoTIFF one
 * (`DigitalTerrainModelFormatTIFF`), which stopped answering GetCoverage on 23.11.2026 while its
 * capabilities still came; this one answers (the multipart reply `parseAsciiGrid` reads).
 */
const WCS =
  "https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WCS/DigitalTerrainModel?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=DTM_PL-KRON86-NH&FORMAT=image/x-aaigrid";

/** A WCS tile as the GeoTIFF reader gave it: its top-left corner, step and rows from the top. */
const readTile = (file: string): { width: number; height: number; e0: number; n0: number; step: number; values: Float32Array } => {
  const g = parseAsciiGrid(readFileSync(file, "latin1"));
  return { width: g.cols, height: g.rows, e0: g.xll, n0: g.yll + g.rows * g.cell, step: g.cell, values: g.values };
};
const DTM_TILE = 500;
/** Metres over which a grown district's new cells fade from the kept mosaic's level to the fetched one. */
const KEEP_BAND = 30;
/**
 * Metres of the kept mosaic's rim not kept: its edge rows lie in the old fetch's margin (`ELEVATION_MARGIN`
 * past the old rectangle) and are off by metres there, so the kept part ends 10 m past the old map's edge.
 */
const KEEP_TRIM = 40;

/**
 * `--keep-terrain`: a district grown past its mosaic keeps the cells it had (the curator's review of
 * 23.11: the WCS's newer edition lies 1–1.5 m under the NMPT's bare ground by VIVO, the kept one
 * within 0.1 m). New cells take the fetched height, shifted by the kept one's difference at the old
 * mosaic's nearest cell, fading out over `KEEP_BAND` m, so the seam has no step.
 */
const keepTerrain = (slug: string, box: { e0: number; n1: number }, cols: number, rows: number, cells: Uint16Array): void => {
  const head = join(TERRAIN_DIR, `${slug}.json`);
  if (!existsSync(head)) return;
  const old = JSON.parse(readFileSync(head, "utf8")) as DtmHeader;
  const kept = dtmFromBytes(new Uint8Array(readFileSync(join(TERRAIN_DIR, `${slug}.bin`))));
  // The kept box: the old mosaic less its rim.
  const k = { e0: old.e0 + KEEP_TRIM, e1: old.e0 + old.cols - 1 - KEEP_TRIM, n0: old.n0 - KEEP_TRIM, n1: old.n0 - old.rows + 1 + KEEP_TRIM };
  const oldAt = (e: number, n: number): number => {
    if (e < k.e0 || e > k.e1 || n > k.n0 || n < k.n1) return 0;
    return kept[(old.n0 - n) * old.cols + (e - old.e0)]!;
  };
  const fetched = cells.slice();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const e = box.e0 + c;
      const n = box.n1 - r;
      const here = oldAt(e, n);
      const i = r * cols + c;
      if (here !== 0) {
        cells[i] = here;
        continue;
      }
      // The old mosaic's nearest cell and the fetched one's there.
      const ce = Math.min(Math.max(e, k.e0), k.e1);
      const cn = Math.max(Math.min(n, k.n0), k.n1);
      const d = Math.hypot(e - ce, n - cn);
      const near = oldAt(ce, cn);
      const fetchedNear = fetched[(box.n1 - cn) * cols + (ce - box.e0)] ?? 0;
      if (near === 0 || fetchedNear === 0 || fetched[i] === 0 || d >= KEEP_BAND) continue;
      cells[i] = Math.max(1, Math.round(fetched[i]! + (near - fetchedNear) * (1 - d / KEEP_BAND)));
    }
  }
};

const fetchDtm = async (d: DistrictSpec) => {
  const box = puwgBox(d, ELEVATION_MARGIN);
  const cols = box.e1 - box.e0;
  const rows = box.n1 - box.n0;
  const cells = new Uint16Array(cols * rows);
  for (let n = box.n0; n < box.n1; n += DTM_TILE) {
    for (let e = box.e0; e < box.e1; e += DTM_TILE) {
      const e1 = Math.min(e + DTM_TILE, box.e1);
      const n1 = Math.min(n + DTM_TILE, box.n1);
      const file = join(CACHE, `nmt-${e}-${n}-${e1}-${n1}.asc`);
      if (refresh || !existsSync(file)) {
        console.log(`nmt ${d.slug}: E ${e}..${e1}, N ${n}..${n1}`);
        // The service takes x as easting and y as northing, whatever EPSG:2180's axis order says.
        writeFileSync(file, await get(`${WCS}&SUBSET=x(${e},${e1})&SUBSET=y(${n},${n1})`));
        await pause(2000);
      }
      const r = readTile(file);
      for (let row = 0; row < r.height; row++) {
        for (let col = 0; col < r.width; col++) {
          const gc = Math.round(r.e0 + (col + 0.5) * r.step - box.e0 - 0.5);
          const gr = Math.round(box.n1 - (r.n0 - (row + 0.5) * r.step) - 0.5);
          if (gc < 0 || gr < 0 || gc >= cols || gr >= rows) continue;
          const h = r.values[row * r.width + col]!;
          if (!Number.isNaN(h)) cells[gr * cols + gc] = encodeHeight(h);
        }
      }
    }
  }
  if (args.has("--keep-terrain")) keepTerrain(d.slug, box, cols, rows, cells);
  const missing = cells.reduce((s, v) => s + (v === 0 ? 1 : 0), 0);
  const header: DtmHeader = {
    source: "GUGiK NMT 1 m (geoportal.gov.pl, WCS DTM_PL-KRON86-NH)",
    crs: "EPSG:2180",
    vertical: "PL-KRON86-NH",
    e0: box.e0,
    n0: box.n1,
    cols,
    rows,
    step: 1,
    offset: DTM_OFFSET,
    scale: DTM_SCALE,
  };
  writeFileSync(join(TERRAIN_DIR, `${d.slug}.json`), `${JSON.stringify(header, null, 2)}\n`);
  writeFileSync(join(TERRAIN_DIR, `${d.slug}.bin`), dtmToBytes(cells));
  console.log(`nmt ${d.slug}: ${cols}×${rows} m, ${missing} cells without data`);
};

const fetchEudem = async (d: DistrictSpec) => {
  const s = ELEVATION_STEP;
  const originX = Math.floor((d.rect.minX - ELEVATION_MARGIN) / s) * s;
  const originZ = Math.floor((d.rect.minZ - ELEVATION_MARGIN) / s) * s;
  const cols = Math.ceil((d.rect.maxX + ELEVATION_MARGIN - originX) / s) + 1;
  const rows = Math.ceil((d.rect.maxZ + ELEVATION_MARGIN - originZ) / s) + 1;
  const pts = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pts.push(worldToGeo({ x: originX + c * s, z: originZ + r * s }));
  const heights: number[] = [];
  for (let k = 0; k < pts.length; k += 100) {
    const loc = pts
      .slice(k, k + 100)
      .map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`)
      .join("|");
    const res = JSON.parse(new TextDecoder().decode(await get(`https://api.opentopodata.org/v1/eudem25m?locations=${loc}`))) as {
      results: { elevation: number | null }[];
    };
    heights.push(...res.results.map((r) => Math.round((r.elevation ?? Number.NaN) * 100) / 100));
    await pause(1100);
  }
  const lattice = { source: "EU-DEM 25 m v1.1 (Copernicus) via api.opentopodata.org", originX, originZ, step: s, cols, rows, heights };
  writeFileSync(join(TERRAIN_DIR, `${d.slug}.eudem.json`), `${JSON.stringify(lattice)}\n`);
  console.log(`eu-dem ${d.slug}: ${cols}×${rows} points`);
};

const main = async () => {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(TERRAIN_DIR, { recursive: true });
  for (const d of DISTRICTS) {
    if (only && d.slug !== only) continue;
    if (!args.has("--skip-osm") || pointsOnly) await fetchOsm(d);
    if (pointsOnly) continue;
    if (!args.has("--skip-dtm")) await fetchDtm(d);
    if (args.has("--eudem")) await fetchEudem(d);
  }
  if (only || (args.has("--skip-osm") && !pointsOnly)) return;
  const rows = [...furniture.values()].sort((a, b) => a[0] - b[0]);
  mkdirSync(join(OSM_DIR, "points"), { recursive: true });
  writeFileSync(join(REPO, FURNITURE_FILE), serializeFurniture(rows, { source: "api.openstreetmap.org/api/0.6/map", license: "ODbL 1.0, © OpenStreetMap contributors" }));
  const per = new Map<string, number>();
  for (const r of rows) per.set(r[3], (per.get(r[3]) ?? 0) + 1);
  console.log(`furniture.json: ${rows.length} points (${[...per].map(([t, n]) => `${t} ${n}`).join(", ")})`);
  const lines = [...bollardLines.values()].sort((a, b) => a[0] - b[0]);
  writeFileSync(join(REPO, BOLLARD_LINES_FILE), serializeBollardLines(lines, { source: "api.openstreetmap.org/api/0.6/map", license: "ODbL 1.0, © OpenStreetMap contributors" }));
  console.log(`bollard-lines.json: ${lines.length} lines`);
};

await main();
