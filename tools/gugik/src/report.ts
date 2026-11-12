/**
 * `pnpm gugik:report [--out <prefix>]` (ADR-0077): the game's buildings and barriers against the
 * GUGiK extracts in `data/gugik/`, for each cell of `docs/mapa-pokrycie.json` and for the whole
 * map. Writes `<prefix>.json` and `<prefix>.txt` (default `reports/gugik/gugik-report`). Offline;
 * changes nothing in the game or the import.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { centroid, type Rect } from "../../osm-import/src/geometry.ts";
import { REPO } from "../../osm-import/src/paths.ts";
import { barrierStats, buildingSides, type HeightRow, heightRows, heightStats, roofStats } from "./analysis.ts";
import { cellOf, loadCells, type MapCell } from "./cells.ts";
import { loadBdot, loadLod1, loadLod2, tilesOf } from "./extracts.ts";
import { address, gameBuildings, loadOsm, osmBarriers, osmTags } from "./game.ts";
import { matchFootprints, MIN_IOU } from "./match.ts";

const argOut = process.argv.indexOf("--out");
const PREFIX = argOut > 0 ? process.argv[argOut + 1]! : join(REPO, "reports/gugik/gugik-report");

const cells = loadCells();
const tiles = [...new Set(cells.flatMap((c) => tilesOf({ minX: c.bounds.minX - 100, minZ: c.bounds.minZ - 100, maxX: c.bounds.maxX + 100, maxZ: c.bounds.maxZ + 100 })))];
const lod1All = loadLod1(tiles);
const lod2All = loadLod2(tiles);
const bdot = loadBdot();
const osm = loadOsm();
const barriers = osmBarriers(osm);
const game = gameBuildings().filter((b) => !b.part);
const parts = gameBuildings().length - game.length;

const m1 = matchFootprints(game, lod1All);
const m2 = matchFootprints(game, lod2All);
const lod1ById = new Map(lod1All.map((b) => [b.id, b]));
const lod2ById = new Map(lod2All.map((b) => [b.id, b]));
const inCell = <T extends { ring: readonly { x: number; z: number }[] }>(xs: readonly T[], c: MapCell) =>
  xs.filter((x) => {
    const p = centroid(x.ring);
    return cellOf(cells, p.x, p.z)?.id === c.id;
  });
const label = (b: (typeof game)[number]) => {
  const t = osmTags(osm, b.id);
  const name = b.name ?? t?.name;
  const addr = address(t);
  return { ...(name ? { name } : {}), ...(addr ? { address: addr } : {}) };
};

const section = (cellGame: typeof game, cellLod1: typeof lod1All, rect: Rect | null) => {
  const sides = buildingSides(cellGame, cellLod1, m1);
  const rows = heightRows(cellGame, lod1ById, m1, label);
  return {
    buildings: {
      game: { total: sides.game.total, matched: sides.game.matched, unmatchedCovered: sides.game.unmatchedCovered, unmatchedMissing: sides.game.unmatchedMissing, missing: sides.game.missing },
      lod1: {
        total: sides.lod1.total,
        matched: sides.lod1.matched,
        unmatchedCovered: sides.lod1.unmatchedCovered,
        unmatchedMissing: sides.lod1.unmatchedMissing,
        missing: sides.lod1.missing.map((id) => {
          const b = lod1ById.get(id)!;
          const c = centroid(b.ring);
          return { id, x: Math.round(c.x), z: Math.round(c.z), height: b.height };
        }),
      },
    },
    heights: { ...heightStats(rows, cellGame, lod1ById, m1), largest: [...rows].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 20) },
    roofs: roofStats(cellGame, lod2ById, m2),
    barriers: rect ? barrierStats(bdot, barriers, rect) : null,
  };
};

const perCell = cells.map((c) => ({ id: c.id, ...section(game.filter((b) => b.cell === c.id), inCell(lod1All, c), c.bounds) }));
const total = section(game, cells.flatMap((c) => inCell(lod1All, c)), null);
// Barriers in total: the cells' sums (cells do not overlap).
const sum = (pick: (s: NonNullable<(typeof perCell)[number]["barriers"]>) => Record<string, number>) => {
  const out: Record<string, number> = {};
  for (const c of perCell) for (const [k, v] of Object.entries(pick(c.barriers!))) out[k] = (out[k] ?? 0) + v;
  return out;
};
const totalBarriers = {
  bdotLines: perCell.reduce((s, c) => s + c.barriers!.bdotLines, 0),
  bdotLength: sum((b) => b.bdotLength),
  osmLength: sum((b) => b.osmLength),
  bdotWithoutOsm: perCell.reduce((s, c) => s + c.barriers!.bdotWithoutOsm, 0),
  bdotWithoutOsmLength: perCell.reduce((s, c) => s + c.barriers!.bdotWithoutOsmLength, 0),
};

const report = {
  generated: "tools/gugik/src/report.ts",
  method: {
    match: `one-to-one greedy by footprint IoU >= ${MIN_IOU}; unmatched split into covered (>= 50 % under the other side's buildings) and missing`,
    height: "game height + roof / 2 (middle of the roof) minus LoD1 2024 measuredHeight",
    roofs: "game roofShape (OSM roof:shape) against LoD2 2017 roofType of the IoU-matched building; 'combination' (1130) is not a usable shape",
    barriers: "BDOT10k lines clipped to the cell; a line has an OSM counterpart when >= 50 % of it lies within 2 m of an OSM barrier=* way of data/osm",
  },
  gamePartsSkipped: parts,
  cells: perCell,
  total: { ...total, barriers: totalBarriers },
};

const n = (v: number | null) => (v === null ? "–" : v.toFixed(1));
const line = (id: string, s: ReturnType<typeof section>) => {
  const b = s.buildings;
  const h = s.heights;
  const r = s.roofs;
  return `${id.padEnd(17)} gra ${String(b.game.total).padStart(4)} dop ${String(b.game.matched).padStart(4)} (podz ${String(b.game.unmatchedCovered).padStart(3)}, brak ${String(b.game.unmatchedMissing).padStart(3)}) | LoD1 ${String(b.lod1.total).padStart(4)} (podz ${String(b.lod1.unmatchedCovered).padStart(3)}, brak w grze ${String(b.lod1.unmatchedMissing).padStart(3)}) | dH med ${n(h.median).padStart(5)} p90|dH| ${n(h.absP90).padStart(5)} >3m ${String(h.over3).padStart(3)} | dachy OSM ${String(r.withRoofShape).padStart(3)} LoD2 dop ${String(r.matchedLod2).padStart(4)} nowe ${String(r.wouldGetShape).padStart(3)}`;
};
const row = (r: HeightRow) => `  ${r.id.padEnd(13)} ${r.cell.padEnd(17)} gra ${r.game.toFixed(1).padStart(5)} LoD1 ${r.lod1.toFixed(1).padStart(5)} różnica ${r.diff.toFixed(1).padStart(6)} IoU ${r.iou.toFixed(2)} [${r.source}] ${r.name ?? ""}${r.address ? ` (${r.address})` : ""}`;
const text = [
  "Raport GUGiK (ADR-0077): budynki gry kontra LoD1 2024 i LoD2 2017, bariery BDOT10k kontra OSM",
  `Metoda: ${Object.values(report.method).join("; ")}`,
  `Pominięte części budynków (building:part z soffit): ${parts}`,
  "",
  ...perCell.map((c) => line(c.id, c)),
  line("RAZEM", total),
  "",
  `Wysokość (gra środek dachu − LoD1), razem: n ${total.heights.n}, mediana ${n(total.heights.median)}, p10 ${n(total.heights.p10)}, p90 ${n(total.heights.p90)}, p90 |d| ${n(total.heights.absP90)}, |d| > 3 m: ${total.heights.over3}`,
  `  okap − LoD1 mediana ${n(total.heights.medianEavesMinusLod1)}, szczyt − LoD1 mediana ${n(total.heights.medianTopMinusLod1)}`,
  `  według źródła wysokości gry: ${JSON.stringify(total.heights.bySource)}`,
  "20 największych różnic:",
  ...total.heights.largest.map(row),
  "",
  `Dachy: ${JSON.stringify({ withRoofShape: total.roofs.withRoofShape, matchedLod2: total.roofs.matchedLod2, wouldGetShape: total.roofs.wouldGetShape, sameShape: `${total.roofs.sameShape}/${total.roofs.bothKnown}` })}`,
  `  typy LoD2 dopasowanych: ${JSON.stringify(total.roofs.lod2Types)}`,
  `  dostałyby kształt: ${JSON.stringify(total.roofs.wouldGetTypes)}`,
  `  OSM→LoD2: ${JSON.stringify(total.roofs.osmToLod2)}`,
  "",
  `Bariery: BDOT linie ${totalBarriers.bdotLines}, długości BDOT ${JSON.stringify(totalBarriers.bdotLength)}, OSM ${JSON.stringify(totalBarriers.osmLength)}`,
  `  linie BDOT bez odpowiednika w OSM (bufor 2 m): ${totalBarriers.bdotWithoutOsm}, ${totalBarriers.bdotWithoutOsmLength} m`,
  ...perCell.filter((c) => c.barriers!.bdotLines > 0).map((c) => `  ${c.id}: ${JSON.stringify(c.barriers!.bdotLength)} OSM ${JSON.stringify(c.barriers!.osmLength)} bez OSM ${c.barriers!.bdotWithoutOsm}`),
].join("\n");

mkdirSync(dirname(PREFIX), { recursive: true });
writeFileSync(`${PREFIX}.json`, `${JSON.stringify(report, null, 1)}\n`);
writeFileSync(`${PREFIX}.txt`, `${text}\n`);
console.log(text);
