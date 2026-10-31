/**
 * What the importer covers (ADR-0042): the four districts of Lublin 2077 as rectangles in world
 * metres around `LUBLIN_ANCHOR` (x east, z north) and their split into streaming chunks.
 */
import { type Rect } from "./geometry.ts";

export interface DistrictSpec {
  /** District id the game already uses (ADR-0042 keeps the ids). */
  readonly id: "shinsekai-7" | "kanal" | "targ" | "doki";
  /** File and chunk id prefix. */
  readonly slug: string;
  readonly name: string;
  readonly rect: Rect;
  /** Chunks across (x) and along (z). */
  readonly cols: number;
  readonly rows: number;
  /**
   * The chunks' edges along z, south to north, when the rows are not even: a district grown past
   * its first grid keeps the old edges, so the chunk ids and what the game streams around its
   * places stay as they were. Even rows over `rect` without it.
   */
  readonly zEdges?: readonly number[];
  /** Floors of a building without height tags. */
  readonly defaultLevels: readonly [number, number];
}

export const DISTRICTS: readonly DistrictSpec[] = [
  {
    id: "shinsekai-7",
    slug: "krakowskie",
    name: "Krakowskie Przedmieście",
    // South to z = -270 for Teatr Osterwy and the Bernardine church (G-052, ADR-0042); the
    // southern row takes the strip, the deptak's seam at z = -20 stays.
    rect: { minX: -200, minZ: -270, maxX: 460, maxZ: 160 },
    cols: 3,
    rows: 2,
    zEdges: [-270, -20, 160],
    defaultLevels: [3, 4],
  },
  {
    id: "kanal",
    slug: "stare-miasto",
    name: "Stare Miasto",
    rect: { minX: 460, minZ: -240, maxX: 760, maxZ: 160 },
    cols: 2,
    rows: 2,
    defaultLevels: [3, 3],
  },
  {
    id: "targ",
    slug: "podzamcze",
    name: "Podzamcze",
    rect: { minX: 520, minZ: 160, maxX: 1120, maxZ: 580 },
    cols: 3,
    rows: 2,
    defaultLevels: [3, 4],
  },
  {
    id: "doki",
    slug: "nabrzeze",
    name: "Nabrzeże Bystrzycy",
    rect: { minX: 2300, minZ: 60, maxX: 2700, maxZ: 480 },
    cols: 2,
    rows: 2,
    defaultLevels: [2, 4],
  },
];

export interface ChunkSpec {
  readonly id: string;
  readonly district: DistrictSpec;
  readonly rect: Rect;
}

/** Chunks of a district: a grid over its rectangle (rows on `zEdges` if given), west to east, then south to north. */
export const chunksOf = (d: DistrictSpec): ChunkSpec[] => {
  const out: ChunkSpec[] = [];
  const w = (d.rect.maxX - d.rect.minX) / d.cols;
  const h = (d.rect.maxZ - d.rect.minZ) / d.rows;
  const z = d.zEdges ?? Array.from({ length: d.rows + 1 }, (_, r) => d.rect.minZ + r * h);
  for (let r = 0; r < d.rows; r++) {
    for (let c = 0; c < d.cols; c++) {
      out.push({
        id: `${d.slug}-${c}-${r}`,
        district: d,
        rect: { minX: d.rect.minX + c * w, minZ: z[r]!, maxX: d.rect.minX + (c + 1) * w, maxZ: z[r + 1]! },
      });
    }
  }
  return out;
};

export const ALL_CHUNKS: readonly ChunkSpec[] = DISTRICTS.flatMap(chunksOf);

/** Map data is fetched this far around each district, so ways crossing the edge are whole. */
export const FETCH_MARGIN = 40;
/** Largest OSM API tile in degrees (the API refuses more than 50 000 nodes). */
export const MAX_TILE_DEG = { lon: 0.0075, lat: 0.0045 } as const;
/** The terrain model is fetched this far around each district; the EU-DEM fallback on this lattice (metres). */
export const ELEVATION_STEP = 25;
export const ELEVATION_MARGIN = 50;

export const USER_AGENT = "SekiSenshi-osm-import/0.1 (+https://github.com/rembednarczyk/SpinalTap)";
