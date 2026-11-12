/**
 * `node tools/orto/src/build.ts [--cache DIR] [--only <district> | --bbox … --name <slug>]`: classifies
 * the cached orthophoto into `data/orto/<slug>.cover.{png,json}` (ADR-0077), offline, and writes the
 * manifest `data/orto/sources.json` (services, flights and their sheets, classifier). A district is
 * always built whole; a cell without a cached tile of every flight stays `none`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { COVER_DIR, FLIGHTS, defaultCache } from "./config.ts";
import { classifyRect, coverFiles, coverToFiles, emptyCover, readCover } from "./cover.ts";
import { COVER_NAMES } from "./classify.ts";
import { MAP_REGIONS, regionsOf } from "./region.ts";
import { type CoverEntry, MANIFEST, manifest } from "./manifest.ts";
import { THRESHOLDS } from "./thresholds.ts";
import { loadTile } from "./tiles.ts";

const argv = process.argv.slice(2);
const cache = argv.includes("--cache") ? argv[argv.indexOf("--cache") + 1]! : defaultCache();

mkdirSync(COVER_DIR, { recursive: true });
const built = new Map<string, CoverEntry>();
for (const asked of regionsOf(argv)) {
  const region = MAP_REGIONS.find((r) => r.slug === asked.slug) ?? asked;
  const cover = emptyCover(region.slug, region.rect, THRESHOLDS);
  const tiles: CoverEntry["tiles"][number][] = [];
  for (const cell of region.cells) {
    const have = FLIGHTS.map((f) => loadTile(cache, f.id, cell)).filter((t) => t !== undefined);
    if (have.length < FLIGHTS.length) {
      if (have.length) console.log(`${cell.id}: ${have.length} of ${FLIGHTS.length} flights cached, left out`);
      continue;
    }
    classifyRect(cover, have, cell.rect);
    for (const t of have) tiles.push({ cell: cell.id, flight: t.meta.flight, service: t.meta.service, fetched: t.meta.fetched, ...(t.meta.sheet ? { sheet: t.meta.sheet } : {}) });
  }
  if (!tiles.length) {
    console.log(`${region.slug}: no cached tiles`);
    continue;
  }
  const out = coverToFiles({ ...cover, header: { ...cover.header, tiles: tiles.map(({ cell, flight, service, fetched }) => ({ cell, flight, service, fetched })) } });
  const f = coverFiles(region.slug);
  writeFileSync(f.png, out.png);
  writeFileSync(f.header, out.header);
  const counts = Object.fromEntries(COVER_NAMES.map((name, k) => [name, cover.cls.reduce((s, v) => s + (v === k ? 1 : 0), 0)]));
  built.set(region.slug, { slug: region.slug, rect: region.rect, bytes: out.png.length, cells: [...new Set(tiles.map((t) => t.cell))], tiles, samples: counts });
  console.log(`${region.slug}: ${tiles.length / FLIGHTS.length} cells, ${(out.png.length / 1024).toFixed(0)} KiB; ${JSON.stringify(counts)}`);
}

// The covers built before and not now keep their entries, as long as their rasters are there.
const before = existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as { covers?: CoverEntry[] }).covers ?? [] : [];
for (const c of before) if (!built.has(c.slug) && readCover(c.slug)) built.set(c.slug, c);
writeFileSync(MANIFEST, `${JSON.stringify(manifest([...built.values()].sort((a, b) => a.slug.localeCompare(b.slug))), null, 2)}\n`);
console.log(`manifest: ${MANIFEST}`);
