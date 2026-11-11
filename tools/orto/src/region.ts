/**
 * What a run of the tool covers: the map's districts and cells, or any rectangle (`--bbox` in world
 * metres, `--bbox-2180` in the PUWG 1992 grid) for when the map grows (decision of 11.11.2026). A
 * rectangle is cut into cells of at most `BBOX_CELL` metres, one tile a flight each, and gets a cover
 * raster of its own named by `--name`.
 */
import { type Rect } from "../../osm-import/src/geometry.ts";
import { puwgFrame } from "../../osm-import/src/project.ts";
import { CELLS, type CellSpec, DISTRICT_RECTS, cellById } from "./config.ts";

export interface Region {
  /** The cover raster's name: `data/orto/<slug>.cover.png`. */
  readonly slug: string;
  readonly rect: Rect;
  readonly cells: readonly CellSpec[];
}

/** The largest side of a rectangle's cell (m): 1000 px at 0.25 m, well under the service's 4096. */
export const BBOX_CELL = 250;

export const MAP_REGIONS: readonly Region[] = DISTRICT_RECTS.map((d) => ({ slug: d.slug, rect: d.rect, cells: CELLS.filter((c) => c.slug === d.slug) }));

const numbers = (s: string): [number, number, number, number] => {
  const v = s.split(",").map(Number);
  if (v.length !== 4 || v.some((x) => !Number.isFinite(x))) throw new Error(`a box is four numbers: ${s}`);
  return v as [number, number, number, number];
};

/** World rectangle round a PUWG 1992 box (the inverse of the anchor's similarity, grown 2 m). */
export const rectOf2180 = (minE: number, minN: number, maxE: number, maxN: number): Rect => {
  const f = puwgFrame();
  const g = (f.gammaDeg * Math.PI) / 180;
  const toWorld = (e: number, n: number) => {
    const [de, dn] = [(e - f.origin.e) / f.scale, (n - f.origin.n) / f.scale];
    return { x: Math.cos(g) * de + Math.sin(g) * dn, z: -Math.sin(g) * de + Math.cos(g) * dn };
  };
  const pts = [toWorld(minE, minN), toWorld(maxE, minN), toWorld(minE, maxN), toWorld(maxE, maxN)];
  return { minX: Math.min(...pts.map((p) => p.x)) - 2, minZ: Math.min(...pts.map((p) => p.z)) - 2, maxX: Math.max(...pts.map((p) => p.x)) + 2, maxZ: Math.max(...pts.map((p) => p.z)) + 2 };
};

/** A rectangle as a region of cells `<slug>-<col>-<row>` (west to east, south to north). */
export const bboxRegion = (slug: string, rect: Rect): Region => {
  const cols = Math.max(1, Math.ceil((rect.maxX - rect.minX) / BBOX_CELL));
  const rows = Math.max(1, Math.ceil((rect.maxZ - rect.minZ) / BBOX_CELL));
  const [w, h] = [(rect.maxX - rect.minX) / cols, (rect.maxZ - rect.minZ) / rows];
  const cells: CellSpec[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push({ id: `${slug}-${c}-${r}`, slug, rect: { minX: rect.minX + c * w, minZ: rect.minZ + r * h, maxX: rect.minX + (c + 1) * w, maxZ: rect.minZ + (r + 1) * h } });
  return { slug, rect, cells };
};

/**
 * The regions of the command line: `--cell <id>` (its district, that cell), `--all` (the map),
 * `--only <district>`, `--bbox minX,minZ,maxX,maxZ` or `--bbox-2180 minE,minN,maxE,maxN` with
 * `--name <slug>`; the whole map without any.
 */
export const regionsOf = (argv: readonly string[]): Region[] => {
  const val = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const name = val("--name") ?? "bbox";
  if (!/^[a-z0-9-]+$/.test(name) || MAP_REGIONS.some((r) => r.slug === name)) throw new Error(`--name: lower-case letters, digits and dashes, not a district's: ${name}`);
  const box = val("--bbox");
  if (box) {
    const [minX, minZ, maxX, maxZ] = numbers(box);
    return [bboxRegion(name, { minX, minZ, maxX, maxZ })];
  }
  const box2180 = val("--bbox-2180");
  if (box2180) return [bboxRegion(name, rectOf2180(...numbers(box2180)))];
  const cell = val("--cell");
  if (cell) {
    const c = cellById(cell);
    return [{ ...MAP_REGIONS.find((r) => r.slug === c.slug)!, cells: [c] }];
  }
  const only = val("--only");
  return MAP_REGIONS.filter((r) => !only || r.slug === only);
};
