import type { StreetPropItem } from "../../../packages/core/src";
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types";
import { type Structure, StructureIndex } from "../../osm-import/src/structures.ts";

/**
 * Trees standing where no tree grows (G-815, T-300, review of the crowns' rule of G-797):
 * - `tree-in-structure`: a tree whose trunk lies in a structure of the map data (`structures.ts`:
 *   an OSM building or building part out of the ruins, a building site, a market, a canopy), out
 *   of its holes: the crowns' rule took a roof, a building's shell or a market's stall roofs for a
 *   crown;
 * - `tree-by-deck`: a tree whose trunk lies `DECK_REACH` or nearer to a bridge's deck of the
 *   tables: the surface model reads the deck's height over the ground as a crown.
 * A finding is a tree, keyed by its metre.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** How near a bridge's deck a trunk may not stand (m). */
export const DECK_REACH = 2;

const at = (p: Pt): string => `${p.x.toFixed(1)},${p.z.toFixed(1)}`;
const trees = (props: readonly StreetPropItem[]) => props.filter((i) => i.prop === "tree");

/** Every tree of `props` in a structure of `list`. */
export const treesInStructure = (list: readonly Structure[], props: readonly StreetPropItem[]): Finding[] => {
  const index = new StructureIndex(list);
  return trees(props).flatMap((t) => {
    const s = index.at(t);
    return s ? [{ at: at(t), what: `tree in ${s.kind} ${s.id}` }] : [];
  });
};

/** The outlines of the bridges' decks of the tables. */
export const deckRings = (chunks: readonly LublinChunkData[]): Pt[][] =>
  chunks.flatMap((c) => c.ground.filter((g) => g.bridge).map((g) => Array.from({ length: g.outline.length / 2 }, (_, k) => ({ x: g.outline[2 * k]!, z: g.outline[2 * k + 1]! }))));

const inRing = (p: Pt, ring: readonly Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[i]!, ring[j]!];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

/** The distance from p to a deck (0 on it). */
const deckGap = (p: Pt, ring: readonly Pt[]): number =>
  inRing(p, ring) ? 0 : Math.min(...ring.map((a, i) => segmentDistance(p.x, p.z, a.x, a.z, ring[(i + 1) % ring.length]!.x, ring[(i + 1) % ring.length]!.z)));

/** Every tree of `props` within `reach` of a deck of `decks`. */
export const treesByDeck = (decks: readonly (readonly Pt[])[], props: readonly StreetPropItem[], reach = DECK_REACH): Finding[] => {
  const boxed = decks.map((ring) => ({ ring, minX: Math.min(...ring.map((p) => p.x)), maxX: Math.max(...ring.map((p) => p.x)), minZ: Math.min(...ring.map((p) => p.z)), maxZ: Math.max(...ring.map((p) => p.z)) }));
  return trees(props).flatMap((t) => {
    const d = Math.min(Infinity, ...boxed.filter((b) => t.x > b.minX - reach && t.x < b.maxX + reach && t.z > b.minZ - reach && t.z < b.maxZ + reach).map((b) => deckGap(t, b.ring)));
    return d <= reach ? [{ at: at(t), what: `tree ${d.toFixed(2)} m from a bridge's deck` }] : [];
  });
};
