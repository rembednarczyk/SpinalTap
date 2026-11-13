/**
 * `node tools/orto/src/albedo-report.ts [--cache DIR] [--out FILE]`: the median colour of each ground
 * surface of the import on the orthophoto over the whole map, per flight (`albedo.ts`), offline from
 * the cache and the cover rasters, with the brightness of the paving against the lawns. The ground
 * palette of the renderer (`ground-plan.ts`, G-721) is calibrated on it.
 */
import { writeFileSync } from "node:fs";
import { type AlbedoBucket, gatherAlbedo, luma, medianColour, topPieces, wellInside } from "./albedo.ts";
import { type Colour } from "./classify.ts";
import { CELLS, defaultCache } from "./config.ts";
import { readCover, sampleColours } from "./cover.ts";
import { CHUNKS } from "./game.ts";
import { flatRing } from "./overlay.ts";
import { MAP_REGIONS } from "./region.ts";
import { samplesIn } from "./rings.ts";
import { loadTile } from "./tiles.ts";

const argv = process.argv.slice(2);
const val = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const cache = val("--cache") ?? defaultCache();
/** The leaf-off current image shows the ground under the trees; June the lawns in leaf. */
const ALBEDO_FLIGHTS = ["2025-04", "2024-06"] as const;

const pieces = CHUNKS.flatMap((c) => c.ground.map((g) => ({ surface: g.surface, ring: flatRing(g.outline) })));
const roofs = CHUNKS.flatMap((c) => c.buildings.map((b) => flatRing(b.outline, b.x, b.z)));
const buckets = new Map<string, Map<string, AlbedoBucket>>(ALBEDO_FLIGHTS.map((f) => [f, new Map()]));

for (const region of MAP_REGIONS) {
  const cover = readCover(region.slug);
  if (!cover) continue;
  const h = cover.header;
  const hidden = new Uint8Array(h.width * h.height);
  for (const r of roofs) for (const k of samplesIn(h, r)) hidden[k] = 1;
  const top = topPieces(h, pieces, hidden);
  const surfaceOf = (k: number) => (top[k]! >= 0 && wellInside(h, top, k) ? pieces[top[k]!]!.surface : null);
  for (const cell of CELLS.filter((c) => c.slug === region.slug)) {
    const r = cell.rect;
    const ks = samplesIn(h, [{ x: r.minX, z: r.minZ }, { x: r.maxX, z: r.minZ }, { x: r.maxX, z: r.maxZ }, { x: r.minX, z: r.maxZ }]);
    for (const flight of ALBEDO_FLIGHTS) {
      const tile = loadTile(cache, flight, cell);
      if (tile) gatherAlbedo(buckets.get(flight)!, ks, surfaceOf, cover.cls, sampleColours(h, tile, r));
    }
  }
}

const hex = (c: Colour) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const out: Record<string, unknown> = {};
for (const [flight, map] of buckets) {
  const rows = [...map].sort(([a], [b]) => a.localeCompare(b)).map(([surface, b]) => {
    const median = medianColour(b.rgb);
    const all = Object.values(b.classes).reduce((s, v) => s + v, 0);
    return { surface, samples: b.rgb.length / 3, share: Math.round(((b.rgb.length / 3) * 1000) / Math.max(1, all)) / 1000, median: median.map((v) => Math.round(v)), hex: hex(median), luma: Math.round(luma(median) * 10) / 10, classes: b.classes };
  });
  const grass = rows.find((r) => r.surface === "grass")?.luma ?? 0;
  console.log(`== ${flight}`);
  for (const r of rows) console.log(`${r.surface.padEnd(9)} ${r.hex} RGB ${r.median.join("/")} L ${r.luma} (${r.samples} próbek, ${Math.round(r.share * 100)}% w klasie)${grass ? `, do trawy ${(r.luma / grass).toFixed(2)}` : ""}`);
  out[flight] = rows;
}
const file = val("--out");
if (file) writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
