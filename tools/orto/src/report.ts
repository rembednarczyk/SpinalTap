/**
 * `node tools/orto/src/report.ts --cell krakowskie-0-1 | --all | --area <T-…/id> | --added [--out FILE]`:
 * the overlay of ADR-0077 in JSON (to `--out`, else none) and short text, offline, no images.
 * - a cell: its bare ground (and the scan's `landuse-bare` part) by cover class, the import's
 *   surfaces against the cover, the added areas in it, the street furniture by kind (OSM or the
 *   generator) with the pavements left empty, and the barriers of the map against the game's;
 * - an added area (`ADDED_AREAS`), or all of them: m² by cover class.
 */
import { writeFileSync } from "node:fs";
import { ADDED_AREAS } from "../../osm-import/src/corrections.ts";
import { type Rect } from "../../osm-import/src/geometry.ts";
import { type OsmData } from "../../osm-import/src/osm.ts";
import { barrierReport } from "./barriers.ts";
import { CELLS, cellById } from "./config.ts";
import { type Cover, coverFor, emptyCover, readCover } from "./cover.ts";
import { EMPTY_RUN, emptyRuns, furnitureCounts, osmPlanPoints, piecesOf } from "./furniture.ts";
import { CHUNKS, PROP_TABLE, loadLanduseBareAt } from "./game.ts";
import { MAP_REGIONS } from "./region.ts";
import { cellOverlay, ringOverlay } from "./overlay.ts";
import { type ClassCounts } from "./rings.ts";
import { THRESHOLDS } from "./thresholds.ts";
import { loadOsm } from "./truth.ts";

const argv = process.argv.slice(2);
const val = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const covers: Cover[] = MAP_REGIONS.map((r) => readCover(r.slug)).filter((c) => c !== undefined);
const m2 = (c: ClassCounts | undefined) => (c ? `zieleń ${c.green}, pod koronami ${c.canopy}, jasna ${c.paving}, asfalt ${c.asphalt}, cień ${c.shadow}, nieznane ${c.unknown}${c.none ? `, bez zdjęcia ${c.none}` : ""}` : "brak rastra");
const hard = (c: ClassCounts) => Math.round((c.paving + c.asphalt) * 10) / 10;
const inside = (ring: readonly { x: number; z: number }[], r: Rect) => ring.some((p) => p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ);

const addedOverlay = (rect?: Rect) =>
  ADDED_AREAS.filter((a) => !rect || inside(a.ring, rect)).map((a) => ({ id: a.id, ref: a.ref, tags: a.tags, m2: ringOverlay(covers, a.ring) ?? null }));

const cellReport = (id: string, osm: OsmData, landuseBareAt: (x: number, z: number) => boolean) => {
  const cell = cellById(id);
  const chunk = CHUNKS.find((c) => c.id === id);
  const cover = coverFor(covers, { x: (cell.rect.minX + cell.rect.maxX) / 2, z: (cell.rect.minZ + cell.rect.maxZ) / 2 });
  const pieces = piecesOf(PROP_TABLE);
  // The pavements need the grid only: a district without a raster gets an empty one.
  const region = MAP_REGIONS.find((r) => r.slug === cell.slug)!;
  const runs = chunk ? emptyRuns((cover ?? emptyCover(region.slug, region.rect, THRESHOLDS)).header, chunk, pieces) : [];
  const barriers = barrierReport(osm, cell.rect, CHUNKS.flatMap((c) => c.barriers ?? []));
  return {
    cell: id,
    rect: cell.rect,
    ground: cover ? cellOverlay(cover, cell.rect, CHUNKS, landuseBareAt) : null,
    added: addedOverlay(cell.rect),
    furniture: furnitureCounts(pieces, osmPlanPoints(), cell.rect),
    emptyPavements: { over: EMPTY_RUN, count: runs.length, metres: runs.reduce((s, r) => s + r.length, 0), longest: runs.slice(0, 8) },
    barriers: { kinds: barriers.kinds, notDrawnCount: barriers.notDrawn.length, notDrawn: barriers.notDrawn },
  };
};

type CellReport = ReturnType<typeof cellReport>;

const cellText = (r: CellReport): string[] => {
  const g = r.ground;
  const out = [`== ${r.cell}`];
  if (g) {
    out.push(`goła ziemia (m²): ${m2(g.bare)}`);
    out.push(`  w tym landuse-bare: ${m2(g.landuseBare)}`);
    const grass = g.surfaces.grass;
    const paved = Object.entries(g.surfaces).filter(([s]) => s !== "grass" && s !== "water" && s !== "basin" && s !== "rail");
    if (grass) out.push(`trawa importu na nawierzchni ortofoto: ${hard(grass)} m² z ${Math.round(Object.values(grass).reduce((s, v) => s + v, 0))} m²`);
    out.push(`nawierzchnia importu na zieleni ortofoto: ${Math.round(paved.reduce((s, [, c]) => s + c.green + c.canopy, 0) * 10) / 10} m²`);
  } else out.push("brak rastra pokrycia");
  out.push(`meble (razem/OSM/generator): ${Object.entries(r.furniture).map(([k, c]) => `${k} ${c.total}/${c.osm}/${c.generator}`).join(", ")}`);
  out.push(`chodniki bez mebli > ${r.emptyPavements.over} m: ${r.emptyPavements.count} odcinków, ${r.emptyPavements.metres} m${r.emptyPavements.longest.slice(0, 3).map((x) => `; ${x.street} (${x.side}) ${x.length} m od ${x.from.x},${x.from.z}`).join("")}`);
  const b = Object.entries(r.barriers.kinds).filter(([, v]) => v.osmLines + v.osmPoints + v.game > 0);
  out.push(`bariery OSM (linie/m/punkty, gra): ${b.length ? b.map(([k, v]) => `${k} ${v.osmLines}/${v.osmMetres}/${v.osmPoints}, gra ${v.game}`).join("; ") : "brak"}; nierysowane linie ${r.barriers.notDrawnCount}`);
  return out;
};

const main = async () => {
  const out = val("--out");
  const area = val("--area");
  if (area || argv.includes("--added")) {
    const rows = addedOverlay().filter((a) => !area || a.id === area);
    if (!rows.length) throw new Error(`no added area ${area}`);
    for (const a of rows) console.log(`${a.id} (${a.tags.landuse ?? a.tags["area:highway"] ?? "?"}): ${m2(a.m2 ?? undefined)}`);
    if (out) writeFileSync(out, `${JSON.stringify(rows, null, 2)}\n`);
    return;
  }
  const ids = argv.includes("--all") ? CELLS.map((c) => c.id) : [val("--cell") ?? ""];
  if (!ids[0]) throw new Error("usage: report.ts --cell <id> | --all | --area <id> | --added [--out FILE]");
  const osm = loadOsm();
  const landuseBareAt = await loadLanduseBareAt(osm);
  const cells = ids.map((id) => cellReport(id, osm, landuseBareAt));
  for (const r of cells) console.log(cellText(r).join("\n"));
  const total = (pick: (r: CellReport) => ClassCounts | undefined) =>
    cells.reduce<Record<string, number>>((s, r) => {
      for (const [k, v] of Object.entries(pick(r) ?? {})) s[k] = Math.round(((s[k] ?? 0) + v) * 10) / 10;
      return s;
    }, {});
  const summary = { cells: cells.length, bare: total((r) => r.ground?.bare), landuseBare: total((r) => r.ground?.landuseBare) };
  if (cells.length > 1) console.log(`== razem (${cells.length} komórek)\ngoła ziemia (m²): ${JSON.stringify(summary.bare)}\n  w tym landuse-bare: ${JSON.stringify(summary.landuseBare)}`);
  if (out) writeFileSync(out, `${JSON.stringify({ summary, cells }, null, 2)}\n`);
};

await main();
