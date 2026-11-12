/**
 * The compact GUGiK extracts in `data/gugik/` (ADR-0077), for the whole city (powiat 0663) in
 * world tiles of 1 km, so the import and the game read only the tiles they need.
 *
 * World metres like the game's `*.generated.ts`: x east, z north around `LUBLIN_ANCHOR`. A tile
 * `<tx>_<tz>` holds what has its centroid in x ∈ [tx, tx + 1) km, z ∈ [tz, tz + 1) km.
 * Outlines are counter-clockwise rings in decimetres, delta-coded: `[x0, z0, dx1, dz1, …]`.
 *
 * - `index.json`: header (sources, licence, frame, row formats) and the tiles with their counts;
 * - `lod1/<tile>.json`: `[id, measuredHeight, ground, outline]`, ground in m above sea level
 *   (PL-EVRF2007-NH);
 * - `lod2/<tile>.json`: `[id, roofType, ground, eaves, ridge, outline, mainEaves?, mainRidge?]`, eaves and
 *   ridge in metres over the ground (PL-KRON86-NH), `null` without roof surfaces; outline `null`
 *   when it is the LoD1 outline of the same id (the same BDOT10k footprint, IoU ≥ 0.9), then in
 *   the same tile; `mainEaves`, `mainRidge` those of the main mass (`citygml.ts` `mainRoof`),
 *   only where they are not the whole roof's;
 * - `bdot.json`: `[id, kind, line]` for the whole city, kind the BDOT10k `RODZAJ`, line delta-coded.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { REPO } from "../../osm-import/src/paths.ts";

export const DATA_DIR = join(REPO, "data/gugik");
export const TILE = 1000;

export type Lod1Row = [id: string, measuredHeight: number, ground: number, outline: number[]];
export type Lod2Row = [id: string, roofType: number | null, ground: number, eaves: number | null, ridge: number | null, outline: number[] | null, mainEaves?: number, mainRidge?: number];
export type BdotRow = [id: string, kind: string, line: number[]];

export interface Lod1Building {
  readonly id: string;
  readonly height: number;
  readonly ground: number;
  readonly ring: Pt[];
}

export interface Lod2Building {
  readonly id: string;
  readonly roofType?: number;
  readonly ground: number;
  readonly eaves?: number;
  readonly ridge?: number;
  /** The eaves and the ridge of the main mass over the ground (`citygml.ts` `mainRoof`): the whole roof's when absent from the row. */
  readonly mainEaves?: number;
  readonly mainRidge?: number;
  readonly ring: Pt[];
}

export interface BdotLine {
  readonly id: string;
  readonly kind: string;
  readonly line: Pt[];
}

export const r1 = (v: number) => Math.round(v * 10) / 10 + 0;

/** Points as delta-coded decimetres. */
export const encode = (pts: readonly Pt[]): number[] => {
  const out: number[] = [];
  let px = 0;
  let pz = 0;
  for (const p of pts) {
    const x = Math.round(p.x * 10);
    const z = Math.round(p.z * 10);
    out.push(x - px + 0, z - pz + 0);
    px = x;
    pz = z;
  }
  return out;
};

export const decode = (v: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  let x = 0;
  let z = 0;
  for (let i = 0; i + 1 < v.length; i += 2) {
    x += v[i]!;
    z += v[i + 1]!;
    out.push({ x: x / 10, z: z / 10 });
  }
  return out;
};

export const tileKey = (p: Pt) => `${Math.floor(p.x / TILE)}_${Math.floor(p.z / TILE)}`;

/** Tiles meeting a world rectangle. */
export const tilesOf = (r: Rect): string[] => {
  const out: string[] = [];
  for (let i = Math.floor(r.minX / TILE); i <= Math.floor(r.maxX / TILE); i++) for (let j = Math.floor(r.minZ / TILE); j <= Math.floor(r.maxZ / TILE); j++) out.push(`${i}_${j}`);
  return out;
};

/** A JSON document with one array of rows, each row on its own line (small diffs). */
export const writeRows = (head: Record<string, unknown>, key: string, rows: readonly unknown[]): string =>
  `{${Object.entries(head)
    .map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)},`)
    .join("")}\n"${key}":[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]}\n`;

const rows = <T>(file: string, key: string): T[] => (existsSync(file) ? ((JSON.parse(readFileSync(file, "utf8")) as Record<string, T[]>)[key] ?? []) : []);

const tileFiles = (dir: string, tiles?: readonly string[]) =>
  existsSync(dir) ? (tiles ? tiles.map((t) => `${t}.json`) : readdirSync(dir).filter((f) => f.endsWith(".json"))).map((f) => join(dir, f)) : [];

/** LoD1 buildings of the given tiles (all tiles when omitted). */
export const loadLod1 = (tiles?: readonly string[], dir = DATA_DIR): Lod1Building[] =>
  tileFiles(join(dir, "lod1"), tiles)
    .flatMap((f) => rows<Lod1Row>(f, "buildings"))
    .map(([id, height, ground, o]) => ({ id, height, ground, ring: decode(o) }));

/** LoD2 buildings of the given tiles; outlines shared with LoD1 come from the same tile of `lod1/`. */
export const loadLod2 = (tiles?: readonly string[], dir = DATA_DIR): Lod2Building[] =>
  tileFiles(join(dir, "lod2"), tiles).flatMap((f) => {
    const lod1 = new Map(rows<Lod1Row>(f.replace(/lod2([/\\][^/\\]+)$/, "lod1$1"), "buildings").map((r) => [r[0], r[3]]));
    return rows<Lod2Row>(f, "buildings").flatMap(([id, roofType, ground, eaves, ridge, o, mainEaves, mainRidge]) => {
      const outline = o ?? lod1.get(id);
      if (!outline) return [];
      return [
        {
          id,
          ground,
          ring: decode(outline),
          ...(roofType !== null ? { roofType } : {}),
          ...(eaves !== null ? { eaves } : {}),
          ...(ridge !== null ? { ridge } : {}),
          ...(mainEaves !== undefined ? { mainEaves } : eaves !== null ? { mainEaves: eaves } : {}),
          ...(mainRidge !== undefined ? { mainRidge } : ridge !== null ? { mainRidge: ridge } : {}),
        },
      ];
    });
  });

export const loadBdot = (dir = DATA_DIR): BdotLine[] => rows<BdotRow>(join(dir, "bdot.json"), "lines").map(([id, kind, l]) => ({ id, kind, line: decode(l) }));
