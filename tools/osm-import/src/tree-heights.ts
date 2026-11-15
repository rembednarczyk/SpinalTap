/**
 * The heights of the city's trees (G-422, T-195; audit of ADR-0077 14.11, gap 4), metres from the
 * ground to the crown's top, by one rule for every tree rather than a table of some: OSM `height`
 * where the node has one (the oaks of Plac Litewski, pomniki przyrody); else the highest NMPT less
 * NMT within `CROWN_REACH` of the tree (`data/gugik/nmpt`, `pnpm gugik:nmpt`), leaving out the cells
 * within `OFF_ROOF` of a building's outline (eaves and facades, not crowns), clamped to
 * `TREE_RANGE`; else none, and the tree keeps the random size of its seed. A reading over
 * `NOT_A_CROWN` is a roof or a tower the outlines miss: none. Where the surface model shows no crown
 * (under 3 m: a young tree or one planted since) the tree takes the smallest size of `TREE_SCALE`.
 * The drawn crown's reach grows with the height: the model is scaled as a whole (`TREE_CROWN`),
 * and narrowed where the walls leave it no room (`treeVariant`, G-814).
 */
import {
  TREE_CROWN,
  TREE_SPREADS,
  measuredTreeVariant,
  narrowTreeVariant,
  plainTreeVariant,
  treeScale,
  treeSpecies,
  treeSpread,
  withTreeSpecies,
} from "../../../packages/core/src/world/trees.ts";
import { type Chm, highestAround, loadChms } from "../../gugik/src/nmpt.ts";
import type { FurniturePoint } from "./furniture.ts";
import type { Pt } from "./geometry.ts";
import type { Tags } from "./osm.ts";
import type { Site } from "./props-site.ts";

/** How far from a tree's node its crown is looked for in the surface model (m): a street tree's crown. */
export const CROWN_REACH = 3;
/** Cells of the surface model this near a building's outline are its roof or wall (m). */
export const OFF_ROOF = 2;
/** The heights a measured tree is clamped to (m). */
export const TREE_RANGE = { min: 3, max: 30 } as const;
/** A reading over this is no tree's crown (m). */
export const NOT_A_CROWN = 35;

/** Where a tree's height comes from. */
export type TreeHeightFrom = "osm" | "nmpt";

export interface TreeHeight {
  readonly height: number;
  readonly from: TreeHeightFrom;
}

/** OSM `height` of a tree in metres (`20`, `20 m`, `20,5`); null without one or with one no tree has. */
export const osmTreeHeight = (tags: Tags | undefined): number | null => {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(?:m)?\s*$/.exec(tags?.height ?? "");
  if (!m) return null;
  const h = Number(m[1]!.replace(",", "."));
  return h > 0 && h <= NOT_A_CROWN ? h : null;
};

/** Directions a cell is tried off the roofs in, at the buffer and at half of it. */
const ROOF_TRIES: readonly Pt[] = Array.from({ length: 8 }, (_, i) => ({ x: Math.cos((i * Math.PI) / 4), z: Math.sin((i * Math.PI) / 4) }));

/** Whether p lies in a building's outline or within `reach` of it, on the eight ways at `reach` and half of it. */
export const byRoof = (site: Site, p: Pt, reach: number): boolean =>
  site.buildingNear(p, reach) && (site.inBuilding(p) || ROOF_TRIES.some((d) => [reach, reach / 2].some((r) => site.inBuilding({ x: p.x + d.x * r, z: p.z + d.z * r }))));

let city: Chm[] | null = null;
/** The committed extracts of every district, read once. */
const cityChms = (): Chm[] => (city ??= loadChms());

/** The height of the tree at p with OSM `tags`, and where it comes from; null: no source has one. */
export const measureTree = (site: Site, p: Pt, tags: Tags | undefined, chms: readonly Chm[] = cityChms(), offRoof = OFF_ROOF): TreeHeight | null => {
  const osm = osmTreeHeight(tags);
  if (osm !== null) return { height: osm, from: "osm" };
  const top = highestAround(chms, p, CROWN_REACH, (q) => byRoof(site, q, offRoof));
  if (top === null || top > NOT_A_CROWN) return null;
  return { height: Math.round(Math.min(TREE_RANGE.max, Math.max(TREE_RANGE.min, top)) * 10) / 10, from: "nmpt" };
};

/** `tags` with the OSM `height` of the extract's trees (`furniture.json`, its detail) where they have none. */
export const withTreeHeights = (tags: ReadonlyMap<string, Tags>, points: readonly FurniturePoint[]): ReadonlyMap<string, Tags> => {
  const out = new Map(tags);
  for (const f of points) if (f.tag === "natural=tree" && f.detail && out.get(f.id)?.height === undefined) out.set(f.id, { ...out.get(f.id), height: f.detail });
  return out;
};

/** Directions the crown's reach is tried in, at its full reach and at half of it. */
const AROUND = 16;

/** Whether a crown reaching `r` from the trunk at p stays off every building's outline. */
const clearOfWalls = (site: Site, p: Pt, r: number): boolean => {
  if (!site.buildingNear(p, r)) return true;
  for (let i = 0; i < AROUND; i++) {
    const a = (2 * Math.PI * i) / AROUND;
    for (const d of [r, r / 2]) if (site.inBuilding({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d })) return false;
  }
  return true;
};

/** How far the drawn crown of `variant` reaches from its trunk, narrowed or not (m). */
const drawnReach = (variant: number): number => TREE_CROWN[treeSpecies(variant)]! * treeScale(variant) * treeSpread(variant);

/** Whether the drawn crown of `variant` at p stays off every building's outline. */
export const crownClear = (site: Site, p: Pt, variant: number): boolean => clearOfWalls(site, p, drawnReach(variant));

/**
 * A tree's variant from its seed: of `species` where OSM names it (`tree-species.ts`, G-423), else
 * the seed's, grown to its measured `height` where it has one (`measureTree`). A crown that would
 * reach into a wall (the renderer's crown would hang through the facade) keeps the height and
 * narrows to the widest of `TREE_SPREADS` clear of it (G-814: a tree by a facade grows up, not
 * out, and the seed's size was no closer to the real one); one whose trunk stands so near the wall
 * that even the narrowest crown reaches it takes the narrowest.
 */
export const treeVariant = (site: Site, p: Pt, seed: number, species: number | undefined, height: number | null): number => {
  const plain = species === undefined ? plainTreeVariant(seed) : withTreeSpecies(plainTreeVariant(seed), species);
  if (height === null) return plain;
  const v = measuredTreeVariant(seed, height, treeSpecies(plain));
  if (crownClear(site, p, v)) return v;
  const narrow = TREE_SPREADS.map((w) => narrowTreeVariant(v, w)!);
  return narrow.find((n) => crownClear(site, p, n)) ?? narrow[narrow.length - 1]!;
};
