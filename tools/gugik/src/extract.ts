/**
 * `pnpm gugik:extract` (the whole city into `data/gugik/`) or `pnpm gugik:extract --bbox minX,minZ,maxX,maxZ | --bbox-2180 minE,minN,maxE,maxN --out <dir>`
 * (ADR-0077): cuts the cached GUGiK sets (`pnpm gugik:fetch`) to a rectangle, by default the whole
 * city, and writes the tiled extracts of `extracts.ts` into `data/gugik/`. Offline; it reads the
 * GML files as text and the GeoPackages read-only, nothing in them is run. Tiles it writes are
 * replaced whole. With a rectangle the tiles are partial, so it needs `--out` elsewhere.
 *
 * BDOT10k has no fences (ogrodzenia are not in its 2021 schema at the 1:10 000 level); the
 * lines kept are its walls and wall-like lines: retaining walls and bank revetments
 * (`OT_BUUO_L`), historic walls (`OT_OIOR_L`), noise barriers (`OT_OIKM_L`) and hedges
 * (`OT_OIPR_L`, without the rows of trees and forest lines).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { centroid, openRing, type Pt, type Rect, ringBounds, signedArea } from "../../osm-import/src/geometry.ts";
import { outDir, parseBbox } from "./bbox.ts";
import { buildingElements, type GmlBuilding, parseLod1, parseLod2, type Ring3 } from "./citygml.ts";
import { type BdotRow, DATA_DIR, encode, type Lod1Row, type Lod2Row, r1, tileKey, writeRows } from "./extracts.ts";
import { frameInfo, puwgToWorld, worldToEn } from "./frame.ts";
import { readGpkgLines } from "./gpkg.ts";
import { footprint, iou } from "./overlap.ts";
import { CACHE_DIR, SOURCES } from "./sources.ts";

const bbox = parseBbox(process.argv);
const OUT = outDir(process.argv) ?? DATA_DIR;
// Tiles cut by a rectangle are partial: they must not replace the whole tiles of `data/gugik/`.
if (bbox && OUT === DATA_DIR) throw new Error("a rectangle (--bbox, --bbox-2180) needs --out <dir> outside data/gugik");
const touches = (b: Rect) => !bbox || (b.minX < bbox.maxX && bbox.minX < b.maxX && b.minZ < bbox.maxZ && bbox.minZ < b.maxZ);
const grid = bbox && [worldToEn({ x: bbox.minX, z: bbox.minZ }), worldToEn({ x: bbox.maxX, z: bbox.minZ }), worldToEn({ x: bbox.minX, z: bbox.maxZ }), worldToEn({ x: bbox.maxX, z: bbox.maxZ })];

/** GML files under `dir` whose envelope meets the rectangle. */
const gmlFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".gml"))
    .map((f) => join(dir, f))
    .filter((f) => {
      if (!grid) return true;
      const head = readFileSync(f, "utf8").slice(0, 4000);
      const lo = /<gml:lowerCorner>([^<]*)</.exec(head)?.[1]?.trim().split(/\s+/).map(Number);
      const hi = /<gml:upperCorner>([^<]*)</.exec(head)?.[1]?.trim().split(/\s+/).map(Number);
      if (!lo || !hi) return true;
      return lo[0]! < Math.max(...grid.map((p) => p.e)) && hi[0]! > Math.min(...grid.map((p) => p.e)) && lo[1]! < Math.max(...grid.map((p) => p.n)) && hi[1]! > Math.min(...grid.map((p) => p.n));
    })
    .sort();

/** The footprint in world metres: the largest exterior ring, counter-clockwise, open. */
const worldRing = (rings: readonly Ring3[]): Pt[] => {
  const all = rings.map((r) => openRing(r.map(([e, n]) => puwgToWorld(e, n))));
  const best = all.reduce((a, b) => (Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a));
  return signedArea(best) < 0 ? best.reverse() : best;
};

interface Parsed {
  readonly b: GmlBuilding;
  readonly ring: Pt[];
  readonly tile: string;
}

const buildings = (key: "lod1" | "lod2", parse: (el: string) => GmlBuilding | undefined): Parsed[] => {
  const out: Parsed[] = [];
  const seen = new Set<string>();
  for (const f of gmlFiles(join(CACHE_DIR, key))) {
    for (const el of buildingElements(readFileSync(f, "utf8"))) {
      const b = parse(el);
      if (!b || seen.has(b.id)) continue;
      const ring = worldRing(b.footprint);
      if (ring.length < 3 || !touches(ringBounds(ring))) continue;
      seen.add(b.id);
      out.push({ b, ring, tile: tileKey(centroid(ring)) });
    }
  }
  return out.sort((p, q) => p.tile.localeCompare(q.tile) || p.b.id.localeCompare(q.b.id));
};

const byTile = <T>(items: readonly { tile: string; row: T }[]) => {
  const m = new Map<string, T[]>();
  for (const it of items) (m.get(it.tile) ?? m.set(it.tile, []).get(it.tile)!).push(it.row);
  return m;
};

const writeTiles = (key: string, tiles: Map<string, unknown[]>) => {
  mkdirSync(join(OUT, key), { recursive: true });
  for (const [t, rows] of tiles) writeFileSync(join(OUT, key, `${t}.json`), writeRows({ tile: t }, "buildings", rows));
};

const BDOT_LINES: Readonly<Record<string, ReadonlySet<string> | undefined>> = {
  OT_BUUO_L: undefined,
  OT_OIOR_L: new Set(["mur historyczny"]),
  OT_OIKM_L: undefined,
  OT_OIPR_L: new Set(["pas krzewów lub żywopłot"]),
};

const bdotRows = (): BdotRow[] => {
  const rows: BdotRow[] = [];
  const dir = join(CACHE_DIR, "bdot");
  for (const f of readdirSync(dir).sort()) {
    const table = Object.keys(BDOT_LINES).find((t) => f.endsWith(`__${t}.gpkg`));
    if (!table) continue;
    const kinds = BDOT_LINES[table];
    for (const feat of readGpkgLines(join(dir, f))) {
      if (kinds && !kinds.has(feat.kind)) continue;
      feat.lines.forEach((l, i) => {
        const line = l.map(([e, n]) => puwgToWorld(e, n));
        if (line.length >= 2 && touches(ringBounds(line))) rows.push([feat.lines.length > 1 ? `${feat.id}/${i}` : feat.id, feat.kind, encode(line)]);
      });
    }
  }
  return rows.sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
};

const lod1 = buildings("lod1", parseLod1);
writeTiles(
  "lod1",
  byTile(lod1.map(({ b, ring, tile }) => ({ tile, row: [b.id, r1(b.measuredHeight ?? (b.top ?? b.ground) - b.ground), r1(b.ground), encode(ring)] satisfies Lod1Row }))),
);

// A LoD2 footprint that is its LoD1 footprint (same BDOT10k id, IoU ≥ 0.9) is stored once, in LoD1's tile.
const lod1ById = new Map(lod1.map((p) => [p.b.id, p]));
let shared = 0;
const lod2 = buildings("lod2", parseLod2).map(({ b, ring, tile }) => {
  const twin = lod1ById.get(b.id);
  const same = twin !== undefined && iou(footprint(twin.ring), footprint(ring)) >= 0.9;
  if (same) shared++;
  const row: Lod2Row = [
    b.id,
    b.roofType ?? null,
    r1(b.ground),
    b.eaves !== undefined ? r1(b.eaves - b.ground) : null,
    b.ridge !== undefined ? r1(b.ridge - b.ground) : null,
    same ? null : encode(ring),
  ];
  // The main mass's eaves and ridge only where they are not the whole roof's (G-639).
  if (b.mainEaves !== undefined && b.mainRidge !== undefined) {
    const main = [r1(b.mainEaves - b.ground), r1(b.mainRidge - b.ground)] as const;
    if (main[0] !== row[3] || main[1] !== row[4]) row.push(...main);
  }
  return { tile: same ? twin.tile : tile, row };
});
writeTiles("lod2", byTile(lod2));

const bdot = bdotRows();
writeFileSync(join(OUT, "bdot.json"), writeRows({ note: "see index.json" }, "lines", bdot));

/** The index: header and every tile present in `OUT` (also those of earlier runs). */
const count = (key: string) =>
  Object.fromEntries(
    readdirSync(join(OUT, key))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => [f.slice(0, -5), (readFileSync(join(OUT, key, f), "utf8").match(/^\["/gm) ?? []).length]),
  );
const index = {
  license: "CC BY 4.0, Główny Urząd Geodezji i Kartografii (geoportal.gov.pl); attribution in data/osm/ATTRIBUTION.md",
  tool: "tools/gugik (pnpm gugik:fetch, pnpm gugik:extract)",
  sources: Object.fromEntries(SOURCES.map((s) => [s.key, s.url])),
  frame: frameInfo(),
  tile: "1 km world tiles <tx>_<tz>: centroid x in [tx, tx + 1) km, z in [tz, tz + 1) km",
  outline: "counter-clockwise ring, decimetres, delta-coded [x0, z0, dx1, dz1, ...]",
  lod1: { heights: "PL-EVRF2007-NH", row: "[buildingId, measuredHeight, ground, outline]", tiles: count("lod1") },
  lod2: { heights: "PL-KRON86-NH", row: "[buildingId, roofType, ground, eaves over ground, ridge over ground, outline | null = the LoD1 outline of the same id, main eaves, main ridge over ground when not the whole roof's]", tiles: count("lod2") },
  bdot: { row: "[LOKALNYID, RODZAJ, line]", file: "bdot.json" },
};
writeFileSync(join(OUT, "index.json"), `${JSON.stringify(index, null, 1)}\n`);
console.log(`gugik extract${bbox ? ` ${JSON.stringify(bbox)}` : ""}: lod1 ${lod1.length}, lod2 ${lod2.length} (${shared} sharing the LoD1 outline), bdot ${bdot.length} lines → ${OUT}`);
