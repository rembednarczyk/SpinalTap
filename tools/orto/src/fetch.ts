/**
 * `node tools/orto/src/fetch.ts --cell krakowskie-0-1 | --only <district> | --all | --bbox … [--flight ID]
 * [--cache DIR] [--refresh]` (regions as in `region.ts`): the PZGiK orthophoto (ADR-0077) of the map's cells, each flight of `FLIGHTS` (or one), through
 * WMS GetMap into the cache outside the repository (default `${XDG_CACHE_HOME:-~/.cache}/seki-orto`,
 * a folder a flight). One request at a time with a pause, never retried after HTTP 429. The current
 * image from the high-resolution service, the standard one where it has no image; an archived
 * flight from the archive's service by its `TIME`. Network, by hand, never in a test or the build.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { type CellSpec, FLIGHTS, type Flight, MAX_SIDE, ORTHO_STEP, PAUSE_MS, USER_AGENT, WMS_LAYER, WMS_SERVICES, WMS_TIME_SERVICE, defaultCache } from "./config.ts";
import { decodeRgb } from "./png.ts";
import { regionsOf } from "./region.ts";
import { type Sheet, featureInfoUrl, indexLayer, parseSheets, sheetOf } from "./sheets.ts";
import { type GridBox, getMapUrl, gridBox, type TileMeta, tileFiles } from "./tiles.ts";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The share of a WMS image with no photograph: transparent, or the blank white of a service outside its sheets. */
const blankShare = (png: Uint8Array): number => {
  const img = decodeRgb(png);
  let blank = 0;
  for (let i = 0; i < img.empty.length; i++) {
    const [r, g, b] = [img.rgb[i * 3]!, img.rgb[i * 3 + 1]!, img.rgb[i * 3 + 2]!];
    if (img.empty[i] || (r === 255 && g === 255 && b === 255)) blank++;
  }
  return blank / img.empty.length;
};

class RateLimited extends Error {}

const getPng = async (url: string): Promise<Uint8Array> => {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 429) throw new RateLimited(`HTTP 429 (no retry): ${url}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
  const type = res.headers.get("content-type") ?? "";
  const body = new Uint8Array(await res.arrayBuffer());
  if (!type.startsWith("image/png")) throw new Error(`${type}: ${new TextDecoder().decode(body.subarray(0, 300))}`);
  return body;
};

const getText = async (url: string): Promise<string> => {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 429) throw new RateLimited(`HTTP 429 (no retry): ${url}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
  return res.text();
};

/** The sheet the tile shows, from the index's years of the flight. */
const lookUpSheet = async (flight: Flight, box: GridBox): Promise<Sheet | undefined> => {
  const sheets: Sheet[] = [];
  for (const year of flight.indexYears) {
    await pause(PAUSE_MS);
    sheets.push(...parseSheets(await getText(featureInfoUrl(indexLayer(year), box))));
  }
  const sheet = sheetOf(sheets, flight.time?.slice(0, 7));
  console.log(`  sheet: ${sheet ? `${sheet.sheet} ${sheet.date} ${sheet.pixel} m` : "not in the index"}`);
  return sheet;
};

const fetchCell = async (cache: string, flight: Flight, cell: CellSpec): Promise<void> => {
  const time = flight.time;
  const box = gridBox(cell.rect);
  const width = Math.round((box.maxE - box.minE) / ORTHO_STEP);
  const height = Math.round((box.maxN - box.minN) / ORTHO_STEP);
  if (width > MAX_SIDE || height > MAX_SIDE) throw new Error(`${cell.id}: ${width}×${height} over the service's ${MAX_SIDE}`);
  const services = time ? [WMS_TIME_SERVICE] : WMS_SERVICES;
  for (const [k, s] of services.entries()) {
    if (k > 0) await pause(PAUSE_MS);
    const png = await getPng(getMapUrl(s.url, WMS_LAYER, box, width, height, time));
    const blank = blankShare(png);
    console.log(`${flight.id} ${cell.id}: ${s.id} ${width}×${height}, ${(png.length / 1e6).toFixed(2)} MB, blank ${(blank * 100).toFixed(1)}%`);
    if (blank > 0.05 && k < services.length - 1) continue;
    const sheet = await lookUpSheet(flight, box);
    const meta: TileMeta = { cell: cell.id, flight: flight.id, service: s.id, ...(time ? { time } : {}), crs: "EPSG:2180", box, width, height, fetched: new Date().toISOString().slice(0, 10), ...(sheet ? { sheet } : {}) };
    const f = tileFiles(cache, flight.id, cell.id);
    mkdirSync(f.dir, { recursive: true });
    writeFileSync(f.png, png);
    writeFileSync(f.meta, `${JSON.stringify(meta, null, 2)}\n`);
    return;
  }
};

const main = async () => {
  const argv = process.argv.slice(2);
  const val = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const cache = val("--cache") ?? defaultCache();
  const cells = argv.includes("--all") || argv.some((a) => ["--cell", "--only", "--bbox", "--bbox-2180"].includes(a)) ? regionsOf(argv).flatMap((r) => r.cells) : [];
  const flightId = val("--flight");
  const flights = FLIGHTS.filter((f) => !flightId || f.id === flightId);
  if (!cells.length || !flights.length) throw new Error(`usage: fetch.ts --cell <id> | --only <district> | --all | --bbox minX,minZ,maxX,maxZ | --bbox-2180 minE,minN,maxE,maxN [--name <slug>] [--flight ${FLIGHTS.map((f) => f.id).join("|")}] [--cache DIR] [--refresh]`);
  let first = true;
  for (const flight of flights)
    for (const cell of cells) {
      if (!argv.includes("--refresh") && existsSync(tileFiles(cache, flight.id, cell.id).png)) {
        console.log(`${flight.id} ${cell.id}: cached`);
        continue;
      }
      if (!first) await pause(PAUSE_MS);
      first = false;
      await fetchCell(cache, flight, cell);
    }
  console.log(`cache: ${cache}`);
};

await main();
