/**
 * `pnpm orto:diff <ref-A> <ref-B> [--cell <id>] [--box x0,z0,x1,z1] [--out FILE] [--work DIR]`:
 * two versions of the map for the `topography-curator`'s review, offline and without a build.
 * Each ref's map is read from its sources (`diff-snapshot.ts`: the import's tables, the game's
 * shaped terrain, the decks); `HEAD` is the current checkout with its uncommitted changes. The
 * cover rasters are this checkout's `data/orto` (a district without one is told, and counted
 * as `none`). Prints a short text; the whole result as JSON to `--out`.
 */
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { type Rect } from "../../osm-import/src/geometry.ts";
import { COVER_NAMES } from "./classify.ts";
import { CELLS, FLIGHTS, cellById, defaultCache } from "./config.ts";
import { type Cover, emptyCover, readCover } from "./cover.ts";
import { type DeckDiff, type SurfaceDiff, type TerrainDiff, deckDiff, surfaceDiff, terrainDiff } from "./diff-map.ts";
import { type MapSnapshot, snapshotOf, unpackRef } from "./diff-snapshot.ts";
import { MAP_REGIONS } from "./region.ts";
import { type ClassCounts } from "./rings.ts";
import { THRESHOLDS } from "./thresholds.ts";

const USAGE = "usage: pnpm orto:diff <ref-A> <ref-B> [--cell <id>] [--box x0,z0,x1,z1] [--out FILE] [--work DIR]";
const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { cell: { type: "string" }, box: { type: "string" }, out: { type: "string" }, work: { type: "string" } } });
if (positionals.length !== 2) {
  console.error(USAGE);
  process.exit(2);
}

const ALL: Rect = { minX: -Infinity, minZ: -Infinity, maxX: Infinity, maxZ: Infinity };
const boxOf = (s: string): Rect => {
  const v = s.split(",").map(Number);
  if (v.length !== 4 || v.some((x) => !Number.isFinite(x))) throw new Error(`--box ${s}: four numbers x0,z0,x1,z1`);
  return { minX: Math.min(v[0]!, v[2]!), minZ: Math.min(v[1]!, v[3]!), maxX: Math.max(v[0]!, v[2]!), maxZ: Math.max(v[1]!, v[3]!) };
};
const meet = (a: Rect, b: Rect): Rect => ({ minX: Math.max(a.minX, b.minX), minZ: Math.max(a.minZ, b.minZ), maxX: Math.min(a.maxX, b.maxX), maxZ: Math.min(a.maxZ, b.maxZ) });

/** The cover rasters of the map, an empty one where `data/orto` has none, and what is missing. */
const loadCovers = (): { readonly covers: Cover[]; readonly missing: string[] } => {
  const covers: Cover[] = [];
  const missing: string[] = [];
  const cached = FLIGHTS.filter((f) => existsSync(join(defaultCache(), f.id))).map((f) => f.id);
  for (const r of MAP_REGIONS) {
    const c = readCover(r.slug);
    if (c) covers.push(c);
    else {
      covers.push(emptyCover(r.slug, r.rect, THRESHOLDS));
      missing.push(
        cached.length
          ? `${r.slug}: brak rastra pokrycia w data/orto; kafle są tylko w pamięci podręcznej ${defaultCache()} (${cached.join(", ")}), zbuduj go: node tools/orto/src/build.ts`
          : `${r.slug}: brak rastra pokrycia w data/orto i brak kafli w ${defaultCache()}; m² tej dzielnicy liczone jako „none”`,
      );
    }
  }
  return { covers, missing };
};

const CLASS_PL: Record<string, string> = { green: "trawa", canopy: "korony", paving: "kostka", asphalt: "asfalt", shadow: "cień", unknown: "nieznane", none: "bez zdjęcia" };
const classes = (c: ClassCounts): string => {
  const parts = COVER_NAMES.filter((n) => c[n] > 0).map((n) => `${CLASS_PL[n]} ${c[n]}`);
  return parts.length ? parts.join(", ") : "0";
};
const sum = (c: ClassCounts) => Math.round(Object.values(c).reduce((s, v) => s + v, 0) * 10) / 10;

const surfaceText = (d: SurfaceDiff): string[] => {
  const out = [`nawierzchnia: zmienione ${d.changedM2} m²`];
  for (const [s, c] of Object.entries(d.bySurface)) out.push(`  ${s}: +${sum(c.added)} m² (${classes(c.added)}), -${sum(c.removed)} m² (${classes(c.removed)})`);
  const cells = Object.entries(d.byCell).map(([id, per]) => `${id} ${Math.round(Object.values(per).reduce((s, c) => s + sum(c.added), 0))}`);
  if (cells.length) out.push(`  komórki (m² dodane): ${cells.join(", ")}`);
  return out;
};

const terrainText = (t: TerrainDiff): string[] => {
  const s = t.total;
  const out = [`teren: ${s.points} punktów, ${s.m2} m², maks. ${s.maxAbs} m (w górę ${s.maxUp}, w dół ${s.maxDown}), mediana ${s.medianAbs} m; od NMT mediana ${s.offNmtBefore.median} -> ${s.offNmtAfter.median} m, maks. ${s.offNmtBefore.max} -> ${s.offNmtAfter.max} m`];
  for (const [id, c] of Object.entries(t.byChunk)) out.push(`  ${id}: ${c.points} pkt, ${c.m2} m², maks. ${c.maxAbs} m, mediana ${c.medianAbs} m`);
  for (const p of t.largest.slice(0, 3)) out.push(`  największy: (${p.x}; ${p.z}) ${p.before} -> ${p.after} m, NMT ${p.nmt} m`);
  const nmt = Object.entries(t.nmtMoved);
  if (nmt.length) out.push(`  NMT importu zmieniony: ${nmt.map(([id, n]) => `${id} ${n} pkt`).join(", ")}`);
  if (t.onlyBefore.length || t.onlyAfter.length) out.push(`  komórki tylko w A: ${t.onlyBefore.join(", ") || "-"}; tylko w B: ${t.onlyAfter.join(", ") || "-"}`);
  return out;
};

const deckText = (d: DeckDiff): string[] => {
  const out = [`pomosty: zmienione ${d.changed.length}, dodane ${d.added.length}, usunięte ${d.removed.length}, bez zmian ${d.unchanged}`];
  const at = (p: { x: number; z: number }) => `(${Math.round(p.x * 10) / 10}; ${Math.round(p.z * 10) / 10})`;
  const mid = (r: Rect) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });
  for (const c of d.changed)
    out.push(`  ${c.flight ? "schody" : "pomost"} ${at(mid(c.before.box))}, oś ${at(c.before.a)}-${at(c.before.b)}: końce o ${c.moveA}/${c.moveB} m, wysokości ${c.before.ya.toFixed(2)}/${c.before.yb.toFixed(2)} -> ${c.after.ya.toFixed(2)}/${c.after.yb.toFixed(2)} m, pole ${c.dArea >= 0 ? "+" : ""}${c.dArea} m²`);
  for (const x of d.added) out.push(`  dodany ${at(mid(x.box))}, oś ${at(x.a)}-${at(x.b)} ${x.ya.toFixed(2)}/${x.yb.toFixed(2)} m`);
  for (const x of d.removed) out.push(`  usunięty ${at(mid(x.box))}, oś ${at(x.a)}-${at(x.b)} ${x.ya.toFixed(2)}/${x.yb.toFixed(2)} m`);
  return out;
};

const main = async () => {
  const [refA, refB] = positionals as [string, string];
  const root = process.cwd();
  const work = resolve(opt.work ?? join(tmpdir(), "orto-diff-work"));
  const window = meet(opt.cell ? cellById(opt.cell).rect : ALL, opt.box ? boxOf(opt.box) : ALL);
  const { covers, missing } = loadCovers();
  const snaps: MapSnapshot[] = [];
  for (const [tag, ref] of [["a", refA], ["b", refB]] as const) {
    const u = unpackRef(root, ref, work, tag);
    try {
      snaps.push(await snapshotOf(u.dir, ref, u.sha));
    } finally {
      u.remove();
    }
  }
  const [a, b] = snaps as [MapSnapshot, MapSnapshot];
  const surfaces = surfaceDiff(covers, a, b, window, CELLS);
  const terrain = terrainDiff(a, b, window);
  const decks = deckDiff(a, b, window);
  const head = `orto:diff ${refA} (${a.sha.slice(0, 10)}) -> ${refB} (${b.sha.slice(0, 10)})${opt.cell ? ` komórka ${opt.cell}` : ""}${opt.box ? ` prostokąt ${opt.box}` : ""}`;
  console.log([head, ...missing.map((m) => `UWAGA ${m}`), ...surfaceText(surfaces), ...terrainText(terrain), ...deckText(decks)].join("\n"));
  const result = { a: { ref: refA, sha: a.sha }, b: { ref: refB, sha: b.sha }, cell: opt.cell ?? null, box: opt.box ?? null, missingCover: missing, surfaces, terrain, decks };
  if (opt.out) writeFileSync(opt.out, `${JSON.stringify(result, (_, v: unknown) => (v === Infinity || v === -Infinity ? null : v), 2)}\n`);
};

await main();
