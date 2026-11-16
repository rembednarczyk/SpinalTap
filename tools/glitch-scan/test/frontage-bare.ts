import { type Line } from "../../osm-import/src/features.ts";
import { pointInRing } from "../../osm-import/src/geometry.ts";
import { OLD_TOWN_RING } from "../../osm-import/src/old-town.ts";
import { placeOf } from "../src/scan-keys.ts";
import { BARE_GRID, Grid, HAIRLINE, type LanduseWorld } from "./landuse-bare";

/**
 * Bare terrain before a pedestrian street's walls (`frontage-bare`, G-855, from the hunt of G-853):
 * a point of a 0.5 m grid with no building and no ground piece of the map's on it, outside the
 * map's lawns, beds and water (drawn or not) and its building sites (G-866: a site's ground is
 * bare, as anywhere in the game), within `WALKED_REACH` of the axis of a pedestrian
 * way or a living street, or inside the Old Town's walls within `OLD_TOWN_REACH` of a residential
 * street's. A 10 m square counts with `MIN_BARE` m² of such points and more, and not when another
 * kind of bare ground has it (`landuse-bare`, `kerb-gap-bare`, `kerb-strip-bare`,
 * `ground-strip-gap`): the coverage report holds each bare place once. The ground between the
 * setts of Krakowskie Przedmieście and its tenements was such a strip: too far off a carriageway
 * for the kerbs' checks, off a shop's forecourt, wider than the ground's gaps.
 */

type Pt = { readonly x: number; readonly z: number };
type Ring = readonly Pt[];
type Finding = { readonly at: string; readonly what: string };

/** How far off a pedestrian way's or a living street's axis the check looks (m). */
export const WALKED_REACH = 8;
/** How far off a residential street's axis inside the Old Town's walls (m): its lanes are narrower. */
export const OLD_TOWN_REACH = 6;
/** The least bare area of a 10 m square that counts (m²). */
export const MIN_BARE = 2;
const SQUARE = 10;

export interface FrontageWorld extends Pick<LanduseWorld, "buildings" | "ground" | "green" | "chunks"> {
  /** The axes of the pedestrian ways and living streets on the ground. */
  readonly walked: readonly Ring[];
  /** The axes of the residential streets on the ground: within the Old Town's walls (`oldTown`) only. */
  readonly residential: readonly Ring[];
  readonly oldTown: (p: Pt) => boolean;
  /** The 10 m squares (`x,z` of the corner at the least x and z) another kind of bare ground has. */
  readonly taken?: ReadonlySet<string>;
  /** The map's building sites (`landuse=construction`, `building=construction`): no frontage. */
  readonly sites?: readonly Ring[];
}

/** How far past its edges a building's outline covers the raster (m), along x and z. */
const WALL_SLACK: readonly (readonly [number, number])[] = [[0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1]];

const WALKED = 1;
const RESIDENTIAL = 2;
const COVERED = 4;

const squareOf = (x: number, z: number) => `${Math.floor(x / SQUARE) * SQUARE},${Math.floor(z / SQUARE) * SQUARE}`;

/** The 10 m squares the findings of other kinds lie in (`FrontageWorld.taken`). */
export const squaresOf = (findings: readonly Finding[]): Set<string> => {
  const out = new Set<string>();
  for (const f of findings) {
    const p = placeOf(f.at);
    if (p) out.add(squareOf(p.x, p.z));
  }
  return out;
};

type Box = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
type Boxed = { readonly ring: Ring; readonly box: Box };
const boxed = (ring: Ring): Boxed => ({
  ring,
  box: { minX: Math.min(...ring.map((p) => p.x)), maxX: Math.max(...ring.map((p) => p.x)), minZ: Math.min(...ring.map((p) => p.z)), maxZ: Math.max(...ring.map((p) => p.z)) },
});

/** The bare samples before the pedestrian streets' walls, in the squares that count: one finding a sample. */
export const frontageBare = (w: FrontageWorld): Finding[] => {
  const out: Finding[] = [];
  const [walked, residential, buildings, green, ground] = [w.walked, w.residential, w.buildings, [...w.green, ...(w.sites ?? [])], w.ground].map((rs) => rs.map(boxed));
  for (const chunk of w.chunks) {
    const grid = new Grid(chunk);
    const near = (rs: readonly Boxed[], d: number) =>
      rs.filter(({ box: b }) => b.minX <= chunk.maxX + d && chunk.minX - d <= b.maxX && b.minZ <= chunk.maxZ + d && chunk.minZ - d <= b.maxZ).map((r) => r.ring);
    // An axis as an open line: each segment a ring of two points.
    for (const l of near(walked!, WALKED_REACH)) for (let k = 0; k + 1 < l.length; k++) grid.around([l[k]!, l[k + 1]!], WALKED_REACH, WALKED);
    for (const l of near(residential!, OLD_TOWN_REACH)) for (let k = 0; k + 1 < l.length; k++) grid.around([l[k]!, l[k + 1]!], OLD_TOWN_REACH, RESIDENTIAL);
    if (!grid.cells.some((c) => c !== 0)) continue;
    for (const r of near(green!, 0)) grid.fill(r, COVERED);
    // A building's outline in the tables is rounded to 0.1 m and simplified (`buildings.ts`), the
    // import's fills are cut on the outline before: a hairline between them is no strip.
    for (const r of near(buildings!, 0)) {
      grid.fill(r, COVERED);
      for (const [dx, dz] of WALL_SLACK) grid.fill(r.map((p) => ({ x: p.x + dx, z: p.z + dz })), COVERED);
    }
    // The ground is a partition (ADR-0078 step 3): as `landuse-bare`, a piece covers 2 mm past its edge.
    for (const r of near(ground!, 0)) {
      grid.fill(r, COVERED);
      for (const [dx, dz] of HAIRLINE) grid.fill(r.map((p) => ({ x: p.x + dx, z: p.z + dz })), COVERED);
    }
    const bySquare = new Map<string, Pt[]>();
    for (let j = 0; j < grid.nz; j++)
      for (let i = 0; i < grid.nx; i++) {
        const c = grid.cells[j * grid.nx + i]!;
        if (c & COVERED || c === 0) continue;
        const p = { x: grid.x(i), z: grid.z(j) };
        if (p.x <= chunk.minX || p.x >= chunk.maxX || p.z <= chunk.minZ || p.z >= chunk.maxZ) continue;
        if (!(c & WALKED) && !w.oldTown(p)) continue;
        const key = squareOf(p.x, p.z);
        if (w.taken?.has(key)) continue;
        (bySquare.get(key) ?? bySquare.set(key, []).get(key)!).push(p);
      }
    for (const pts of bySquare.values()) {
      if (pts.length * BARE_GRID * BARE_GRID < MIN_BARE) continue;
      for (const p of pts) out.push({ at: `${p.x.toFixed(2)},${p.z.toFixed(2)}`, what: `bare before a pedestrian street's walls, ${pts.length * BARE_GRID * BARE_GRID} m² in its square` });
    }
  }
  return out;
};

const onGround = (t: Line["tags"]): boolean => t.area !== "yes" && t.tunnel === undefined && (t.bridge ?? "no") === "no" && Number(t.layer ?? 0) >= 0;

/** The city's world: the map's lines as the import reads them (`lines`), the game's buildings and ground, the map data's lawns and water (`landuse`) and building sites (`sites`). */
export const cityFrontageWorld = (lines: readonly Line[], landuse: LanduseWorld, taken: ReadonlySet<string>, sites: readonly Ring[] = []): FrontageWorld => {
  const axes = (highways: ReadonlySet<string>) => lines.filter((l) => highways.has(l.tags.highway ?? "") && onGround(l.tags)).map((l) => l.line);
  return {
    walked: axes(new Set(["pedestrian", "living_street"])),
    residential: axes(new Set(["residential"])),
    oldTown: (p) => pointInRing(p, OLD_TOWN_RING),
    buildings: landuse.buildings,
    ground: landuse.ground,
    green: landuse.green,
    chunks: landuse.chunks,
    taken,
    sites,
  };
};
