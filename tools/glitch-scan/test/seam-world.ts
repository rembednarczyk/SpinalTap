import { terrainHeightAt } from "../../../packages/core/src";
import { bridgeDeckAt } from "../../../packages/sim/src/content/lublin/decks";
import { SHAPED_TERRAIN } from "../../../packages/sim/src/content/lublin/terrain";
import { DECK_HEADROOM } from "../../../packages/sim/src/world/deck";
import { SCENE_SOLIDS, holds } from "./scene-solids";
import type { SeamWorld } from "./seam-gap";

/**
 * The game's Lublin as `seam-gap` reads it (`seam-gap.ts`): each chunk's shaped terrain
 * (`SHAPED_TERRAIN`), the bridges' decks and the solids of its chunks, the map's buildings and the
 * set pieces with their rooms (the Arkady's pavement among Alchemia's), the street's furniture not.
 * A map building covers the seam too: the terrain inside its outline is neither drawn to the eye
 * nor walked, the walls stand on it (the ledge of 0.18 m at (240; 114) after G-748 lies in one,
 * the orchestrator's decision of 13.11). A passage cut through a building is no cover: its vault's
 * prism starts over the walker's head, past `DECK_HEADROOM`.
 */

/**
 * How far under the higher side of the seam a cover's top may be (m) and still hide it: the
 * Arkady's slabs are level with the map's ground to 1 cm (`arkady.ts`), the shaping moves it a hair.
 */
export const COVER_SINK = 0.05;

/**
 * Something covers the ground at `y` when it holds the point and is level with it or over it, but
 * leaves no room to walk under it (`DECK_HEADROOM`, as the game's ground takes a deck): a slab, a
 * building, a bridge's deck on the ground. Not a deck or a floor over a street.
 */
const covers = (bottom: number, top: number, y: number) => top >= y - COVER_SINK && bottom <= y + DECK_HEADROOM;

export const citySeamWorld = (): SeamWorld => ({
  height: (chunk, x, z) => {
    const g = SHAPED_TERRAIN.get(chunk);
    return g ? terrainHeightAt(g, x, z) : null;
  },
  covered: (x, z, y) => {
    const deck = bridgeDeckAt(x, z);
    return (deck !== null && covers(deck, deck, y)) || SCENE_SOLIDS().some((p) => holds(p, x, z) && covers(p.bottom, p.top, y));
  },
});
