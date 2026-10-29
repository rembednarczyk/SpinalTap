/**
 * `pnpm osm:fetch`: downloads the raw data for the districts of `config.ts` (network, by hand,
 * never in the build):
 * - OpenStreetMap: `api.openstreetmap.org/api/0.6/map` in tiles under the 50 000-node limit, one
 *   request every few seconds; raw XML is cached in `data/osm/cache/` (not committed) and the
 *   filtered extract goes to `data/osm/<district>.json`.
 * - Terrain: GUGiK NMT 1 m (WCS GetCoverage, GeoTIFF float32) in 500 m tiles, mosaicked per
 *   district into `data/terrain/<district>.{json,bin}`; with `--eudem` the EU-DEM 25 m lattice
 *   (opentopodata, 100 points a second) goes to `data/terrain/<district>.eudem.json` as fallback.
 * Flags: `--refresh` refetches cached tiles, `--only=<slug>` limits to one district,
 * `--skip-osm`, `--skip-dtm`, `--eudem`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS, type DistrictSpec, ELEVATION_MARGIN, ELEVATION_STEP, FETCH_MARGIN, MAX_TILE_DEG, USER_AGENT } from "./config.ts";
import { DTM_OFFSET, DTM_SCALE, type DtmHeader, dtmToBytes, encodeHeight } from "./dtm.ts";
import { readGeoTiff } from "./geotiff.ts";
import { filterOsm, mergeOsm, parseOsmXml, serializeOsm } from "./osm.ts";
import { worldToGeo, worldToPuwg } from "./project.ts";
import { REPO } from "./paths.ts";

const args = new Set(process.argv.slice(2));
const only = [...args].find((a) => a.startsWith("--only="))?.slice(7);
const refresh = args.has("--refresh");
const OSM_DIR = join(REPO, "data/osm");
const CACHE = join(OSM_DIR, "cache");
const TERRAIN_DIR = join(REPO, "data/terrain");

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const get = async (url: string, attempts = 3): Promise<Uint8Array> => {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
    if (i >= attempts) throw new Error(`${res.status} ${res.statusText}: ${url}`);
    await pause(5000 * i);
  }
};

/** Geographic box of a world rectangle grown by `margin`. */
const geoBox = (d: DistrictSpec, margin: number) => {
  const sw = worldToGeo({ x: d.rect.minX - margin, z: d.rect.minZ - margin });
  const ne = worldToGeo({ x: d.rect.maxX + margin, z: d.rect.maxZ + margin });
  return { minLon: sw.lon, minLat: sw.lat, maxLon: ne.lon, maxLat: ne.lat };
};

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
      parts.push(filterOsm(parseOsmXml(readFileSync(file, "utf8"))));
    }
  }
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

const WCS =
  "https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WCS/DigitalTerrainModelFormatTIFF?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=DTM_PL-KRON86-NH_TIFF&FORMAT=image/tiff";
const DTM_TILE = 500;

const fetchDtm = async (d: DistrictSpec) => {
  const box = puwgBox(d, ELEVATION_MARGIN);
  const cols = box.e1 - box.e0;
  const rows = box.n1 - box.n0;
  const cells = new Uint16Array(cols * rows);
  for (let n = box.n0; n < box.n1; n += DTM_TILE) {
    for (let e = box.e0; e < box.e1; e += DTM_TILE) {
      const e1 = Math.min(e + DTM_TILE, box.e1);
      const n1 = Math.min(n + DTM_TILE, box.n1);
      const file = join(CACHE, `nmt-${e}-${n}-${e1}-${n1}.tif`);
      if (refresh || !existsSync(file)) {
        console.log(`nmt ${d.slug}: E ${e}..${e1}, N ${n}..${n1}`);
        // The service takes x as easting and y as northing, whatever EPSG:2180's axis order says.
        writeFileSync(file, await get(`${WCS}&SUBSET=x(${e},${e1})&SUBSET=y(${n},${n1})`));
        await pause(2000);
      }
      const r = readGeoTiff(new Uint8Array(readFileSync(file)));
      for (let row = 0; row < r.height; row++) {
        for (let col = 0; col < r.width; col++) {
          const gc = Math.round(r.e0 + (col + 0.5) * r.step - box.e0 - 0.5);
          const gr = Math.round(box.n1 - (r.n0 - (row + 0.5) * r.step) - 0.5);
          if (gc < 0 || gr < 0 || gc >= cols || gr >= rows) continue;
          cells[gr * cols + gc] = encodeHeight(r.values[row * r.width + col]!);
        }
      }
    }
  }
  const missing = cells.reduce((s, v) => s + (v === 0 ? 1 : 0), 0);
  const header: DtmHeader = {
    source: "GUGiK NMT 1 m (geoportal.gov.pl, WCS DTM_PL-KRON86-NH_TIFF)",
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
    if (!args.has("--skip-osm")) await fetchOsm(d);
    if (!args.has("--skip-dtm")) await fetchDtm(d);
    if (args.has("--eudem")) await fetchEudem(d);
  }
};

await main();
