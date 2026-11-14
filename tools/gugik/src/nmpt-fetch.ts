/**
 * `pnpm gugik:nmpt` (first half): the surface model NMPT 0.5 m of every district of the map from the
 * geoportal's WCS, tile by tile on the fixed grid of `nmpt.ts`, into the cache outside the repo
 * (`seki-gugik/nmpt`, float32). Network, by hand or in `pnpm map:refresh`, never in the build. A
 * cached tile is not asked for again unless `--refresh`. One request per tile, two seconds apart;
 * a connection the far side closes mid-answer (the geoportal does, every few tiles) is asked once
 * more after five seconds, nothing else is: an HTTP 429 or any other error stops it. Behind a
 * proxy run it with `NODE_USE_ENV_PROXY=1`. The answers are untrusted data: only parsed as numbers.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { DISTRICTS } from "../../osm-import/src/config.ts";
import { DSM_STEP, NMPT_CACHE, TILE, districtBox, parseAsciiGrid, tileFile, tileUrl, tilesOf } from "./nmpt.ts";

/** Who asks (ADR-0042: no user data). */
const USER_AGENT = "SekiSenshi-topo/1.0";
const refresh = process.argv.includes("--refresh");
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A tile's answer; one more try after a dropped connection, none after an HTTP error. */
const getTile = async (url: string, again = true): Promise<string> => {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    // Too many requests: the service asks to stop, not to be asked again.
    if (res.status === 429) throw new Error(`HTTP 429 (no retry): ${url}`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
    return await res.text();
  } catch (err) {
    if (!again || !(err instanceof TypeError)) throw err;
    console.log(`nmpt: connection dropped (${String((err as { cause?: unknown }).cause ?? err)}), once more in 5 s`);
    await pause(5000);
    return getTile(url, false);
  }
};

mkdirSync(NMPT_CACHE, { recursive: true });
const tiles = new Map<string, { e: number; n: number }>();
for (const d of DISTRICTS) for (const t of tilesOf(districtBox(d))) tiles.set(`${t.e},${t.n}`, t);
let fetched = 0;
for (const { e, n } of [...tiles.values()].sort((a, b) => a.n - b.n || a.e - b.e)) {
  const file = tileFile(e, n);
  if (!refresh && existsSync(file)) continue;
  const g = parseAsciiGrid(await getTile(tileUrl(e, n)));
  const side = TILE / DSM_STEP;
  if (g.cols !== side || g.rows !== side || g.xll !== e || g.yll !== n || g.cell !== DSM_STEP) throw new Error(`nmpt ${e},${n}: unexpected grid ${g.cols}×${g.rows} at ${g.xll},${g.yll}, cell ${g.cell}`);
  writeFileSync(file, new Uint8Array(g.values.buffer));
  fetched++;
  console.log(`nmpt ${e},${n}: ${g.values.reduce((s, v) => s + (Number.isNaN(v) ? 1 : 0), 0)} cells without data`);
  await pause(2000);
}
console.log(`nmpt: ${tiles.size} tiles, ${fetched} fetched, ${tiles.size - fetched} from the cache (${NMPT_CACHE})`);
