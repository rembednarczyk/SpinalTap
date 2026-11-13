import { barrierLayout, pointInRingEvenOdd, terrainHeightAt } from "../../../packages/core/src";
import { distanceToBarrier } from "../../../packages/sim/src/content/lublin/barriers";
import { GROUND_DECKS } from "../../../packages/sim/src/content/lublin/decks";
import { inBuilding } from "../../../packages/sim/src/content/lublin/places";
import { SHAPED_TERRAIN, groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { WORLD_BARRIERS } from "../../../packages/sim/src/content/world-barriers";
import { DECK_HEADROOM, type GroundDeck, deckHeight, groundOver } from "../../../packages/sim/src/world/deck";
import { type WalkChunk, type WalkWorld, WALK_CELL } from "./walk-blocked";

/**
 * The game's Lublin as `walk-blocked` reads it (`walk-blocked.ts`): the ground of `groundY` worked
 * out a chunk at a time (its own terrain and the decks over it), the decks that are the ground,
 * and the edges the model means.
 */

type Pt = { readonly x: number; readonly z: number };
type Box = GroundDeck["box"];

const touches = (a: Box, b: WalkChunk["bounds"]) => a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
const inBox = (b: Box, x: number, z: number) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

/** The bridges' pieces and the flights hung off them, each once. */
const DECKS: readonly GroundDeck[] = [...new Set([...GROUND_DECKS.values()].flat())];

/** The decks by 10 m square of their boxes: the check asks at every edge of the walked surfaces. */
const DECK_CELL = 10;
const deckIndex = new Map<string, GroundDeck[]>();
for (const d of DECKS) {
  for (let i = Math.floor(d.box.minX / DECK_CELL); i <= Math.floor(d.box.maxX / DECK_CELL); i++) {
    for (let k = Math.floor(d.box.minZ / DECK_CELL); k <= Math.floor(d.box.maxZ / DECK_CELL); k++) deckIndex.set(`${i}:${k}`, [...(deckIndex.get(`${i}:${k}`) ?? []), d]);
  }
}
const decksAt = (x: number, z: number): readonly GroundDeck[] => deckIndex.get(`${Math.floor(x / DECK_CELL)}:${Math.floor(z / DECK_CELL)}`) ?? [];

/** The barriers' pieces by 8 m (ADR-0077). */
const BARRIER_CELL = 8;
const barriers = new Map<string, (typeof WORLD_BARRIERS)[string][number][]>();
for (const item of Object.values(WORLD_BARRIERS).flat()) {
  const k = `${Math.floor(item.x / BARRIER_CELL)}:${Math.floor(item.z / BARRIER_CELL)}`;
  barriers.set(k, [...(barriers.get(k) ?? []), item]);
}
/** How many cells round (x, z) may hold the centre of a piece reaching it: the longest piece's half and the reach. */
const BARRIER_REACH = Math.ceil((Object.values(WORLD_BARRIERS).flat().reduce((m, i) => Math.max(m, barrierLayout(i.variant).length / 2), 0) + WALK_CELL) / BARRIER_CELL);
/** A barrier's piece within a cell of (x, z). */
const byBarrier = (x: number, z: number): boolean => {
  const [cx, cz] = [Math.floor(x / BARRIER_CELL), Math.floor(z / BARRIER_CELL)];
  for (let i = cx - BARRIER_REACH; i <= cx + BARRIER_REACH; i++) {
    for (let k = cz - BARRIER_REACH; k <= cz + BARRIER_REACH; k++) for (const b of barriers.get(`${i}:${k}`) ?? []) if (distanceToBarrier(b, x, z) < WALK_CELL) return true;
  }
  return false;
};

/** The niche of the steps by the viaduct of Zamkowa, cut on purpose (T-147). */
const T147 = (p: Pt) => p.x >= 728.5 && p.x <= 735.1 && p.z >= 157.5 && p.z <= 163.8;

/** The ground of a chunk's cells: `groundY` for its own terrain and the decks over it, `groundY` itself past its bounds. */
const heightIn = (chunk: WalkChunk) => {
  const grid = SHAPED_TERRAIN.get(chunk.id);
  const decks = DECKS.filter((d) => touches(d.box, chunk.bounds));
  const b = chunk.bounds;
  return (x: number, z: number): number => {
    if (!grid || x <= b.minX || x >= b.maxX || z <= b.minZ || z >= b.maxZ) return groundY(x, z);
    return groundOver(decks, x, z, terrainHeightAt(grid, x, z));
  };
};

export const CITY_WALK_WORLD: WalkWorld = {
  height: heightIn,
  deck: (x, z, y) => decksAt(x, z).find((d) => inBox(d.box, x, z) && pointInRingEvenOdd(x, z, d.ring) && Math.abs(deckHeight(d, x, z) - y) < 1e-6) ?? null,
  headroom: DECK_HEADROOM,
  edge: (a, b) => {
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    return T147(mid) || inBuilding(a.x, a.z) || inBuilding(b.x, b.z) || byBarrier(mid.x, mid.z);
  },
};
