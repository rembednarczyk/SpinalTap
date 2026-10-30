import { type GroundDeck, deckAt, makeDeck } from "../../world/deck";
import { MAP_CHUNKS, rawHeight } from "./sites";

/**
 * The bridges' decks of the map (ADR-0053), by chunk: each piece of a road or path the map has
 * on a bridge, level from abutment to abutment at the terrain's height there, over the valley.
 */
export const BRIDGE_DECKS: ReadonlyMap<string, readonly GroundDeck[]> = new Map(
  MAP_CHUNKS.map((c) => [c.id, c.ground.flatMap((g) => (g.deck ? [makeDeck(g.outline, g.deck, rawHeight)] : []))]),
);

const ALL_DECKS: readonly GroundDeck[] = [...BRIDGE_DECKS.values()].flat();

/** The highest bridge deck over (x, z), or null off the bridges. */
export const bridgeDeckAt = (x: number, z: number): number | null => deckAt(ALL_DECKS, x, z);
