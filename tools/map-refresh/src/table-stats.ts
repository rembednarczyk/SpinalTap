/**
 * The city's tables counted: objects by kind (a chunk's lists and the props' kinds), by chunk, and
 * the ground's area by surface. `node tools/map-refresh/src/table-stats.ts <root> <out.json>` reads
 * the tables of `<root>` in a process of its own, so the refresh counts the tables before and after
 * a build without a module cache in between.
 */
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PROPS_TABLE, TABLE_DIR } from "./config.ts";

/** What of a chunk is counted: its id, the ground's surfaces and outlines, and any other list. */
export interface ChunkLike {
  readonly id: string;
  readonly ground?: readonly { readonly surface: string; readonly outline: readonly number[] }[];
  readonly [field: string]: unknown;
}

/** Per chunk, per kind: flat rows of five numbers (`LublinPropTable`). */
export type PropsLike = Readonly<Record<string, Readonly<Record<string, readonly number[] | undefined>>>>;

export interface TableStats {
  /** Objects by kind: a chunk's list by its field (`buildings`, `ground`…), the props as `prop:<kind>`. */
  readonly objects: Record<string, number>;
  /** Objects by chunk (lists and props). */
  readonly byChunk: Record<string, number>;
  /** m² of ground by surface, to 0.1. */
  readonly surfaces: Record<string, number>;
  /** m² of ground by chunk and surface, to 0.1. */
  readonly surfaceByChunk: Record<string, Record<string, number>>;
}

/** Fields of a chunk that are not lists of objects. */
const NOT_OBJECTS = new Set(["id", "district", "bounds", "terrain"]);
/** Lists of flat points: one object every two numbers. */
const FLAT_POINTS = new Set(["busStops"]);
const PROP_ROW = 5;

/** Shoelace area of a flat outline `[x0, z0, x1, z1…]`. */
export const outlineArea = (o: readonly number[]): number => {
  let s = 0;
  for (let i = 0; i + 1 < o.length; i += 2) {
    const j = (i + 2) % o.length;
    s += o[i]! * o[j + 1]! - o[j]! * o[i + 1]!;
  }
  return Math.abs(s) / 2;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const add = (m: Record<string, number>, k: string, n: number) => (m[k] = (m[k] ?? 0) + n);
const sorted = <T>(m: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(m).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** The counts of the chunks and the props (pure). */
export const tableStats = (chunks: readonly ChunkLike[], props: PropsLike): TableStats => {
  const objects: Record<string, number> = {};
  const byChunk: Record<string, number> = {};
  const surfaces: Record<string, number> = {};
  const surfaceByChunk: Record<string, Record<string, number>> = {};
  for (const c of chunks) {
    for (const [field, v] of Object.entries(c)) {
      if (NOT_OBJECTS.has(field) || !Array.isArray(v)) continue;
      const n = FLAT_POINTS.has(field) ? v.length / 2 : v.length;
      add(objects, field, n);
      add(byChunk, c.id, n);
    }
    for (const g of c.ground ?? []) {
      const a = outlineArea(g.outline);
      add(surfaces, g.surface, a);
      add((surfaceByChunk[c.id] ??= {}), g.surface, a);
    }
  }
  for (const [chunk, kinds] of Object.entries(props)) {
    for (const [kind, rows] of Object.entries(kinds)) {
      const n = (rows?.length ?? 0) / PROP_ROW;
      add(objects, `prop:${kind}`, n);
      add(byChunk, chunk, n);
    }
  }
  const round = (m: Record<string, number>) => sorted(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, r1(v)])));
  return { objects: sorted(objects), byChunk: sorted(byChunk), surfaces: round(surfaces), surfaceByChunk: sorted(Object.fromEntries(Object.entries(surfaceByChunk).map(([k, m]) => [k, round(m)]))) };
};

const isChunkList = (v: unknown): v is ChunkLike[] => Array.isArray(v) && v.every((c) => c && typeof c === "object" && typeof (c as ChunkLike).id === "string");

/** Reads the tables of `root` (dynamic import) and counts them. */
export const readTableStats = async (root: string): Promise<TableStats> => {
  const dir = join(root, TABLE_DIR);
  if (!existsSync(dir)) return tableStats([], {});
  const files = readdirSync(dir).filter((f) => f.endsWith(".generated.ts")).sort();
  const chunks: ChunkLike[] = [];
  let props: PropsLike = {};
  for (const f of files) {
    const mod = (await import(pathToFileURL(join(dir, f)).href)) as Record<string, unknown>;
    if (f === PROPS_TABLE) props = (Object.values(mod).find((v) => v && typeof v === "object" && !Array.isArray(v)) ?? {}) as PropsLike;
    else for (const v of Object.values(mod)) if (isChunkList(v)) chunks.push(...v);
  }
  return tableStats(chunks, props);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [root, out] = process.argv.slice(2);
  if (!root || !out) throw new Error("usage: table-stats.ts <root> <out.json>");
  writeFileSync(out, `${JSON.stringify(await readTableStats(root), null, 2)}\n`);
}
