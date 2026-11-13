import { barrierLayout, pointInRingEvenOdd, segmentDistance, terrainHeightAt } from "../../../packages/core/src";
import { ALCHEMIA_PADS, ALCHEMIA_RAMPS } from "../../../packages/sim/src/content/alchemia/terraces";
import { distanceToBarrier } from "../../../packages/sim/src/content/lublin/barriers";
import { GROUND_DECKS } from "../../../packages/sim/src/content/lublin/decks";
import { inBuilding } from "../../../packages/sim/src/content/lublin/places";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { SHAPED_TERRAIN, groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { WORLD_BARRIERS } from "../../../packages/sim/src/content/world-barriers";
import { DECK_HEADROOM, type GroundDeck, deckHeight, groundOver } from "../../../packages/sim/src/world/deck";
import { roadWidth } from "../../osm-import/src/ground.ts";
import { type WalkWay, blockedStretches, nearStretches } from "./walk-axes";
import type { WalkChunk, WalkWorld } from "./walk-blocked";

/**
 * The game's Lublin as `walk-blocked` reads it (`walk-blocked.ts`): the ground of `groundY` worked
 * out a chunk at a time (its own terrain and the decks over it), the decks that are the ground,
 * the edges the model means (walls, barriers, T-147, Alchemia's terraces) and the stretches of
 * the map's ways blocked along them (`walk-axes.ts`).
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
/**
 * How far off a barrier's piece the ground is its edge (m): a wall's foot is shaped with it, the
 * terrain banked along it (the curator's review of PR 4).
 */
export const BARRIER_CLEAR = 0.6;
/** How many cells round (x, z) may hold the centre of a piece reaching it: the longest piece's half and the reach. */
const BARRIER_REACH = Math.ceil((Object.values(WORLD_BARRIERS).flat().reduce((m, i) => Math.max(m, barrierLayout(i.variant).length / 2), 0) + BARRIER_CLEAR) / BARRIER_CELL);
/** A barrier's piece within `BARRIER_CLEAR` of (x, z). */
const byBarrier = (x: number, z: number): boolean => {
  const [cx, cz] = [Math.floor(x / BARRIER_CELL), Math.floor(z / BARRIER_CELL)];
  for (let i = cx - BARRIER_REACH; i <= cx + BARRIER_REACH; i++) {
    for (let k = cz - BARRIER_REACH; k <= cz + BARRIER_REACH; k++) for (const b of barriers.get(`${i}:${k}`) ?? []) if (distanceToBarrier(b, x, z) < BARRIER_CLEAR) return true;
  }
  return false;
};

/** The niche of the steps by the viaduct of Zamkowa, cut on purpose (T-147), with 0.5 m round it: its rim is the cut's too. */
const T147_MARGIN = 0.5;
const T147 = (p: Pt) => p.x >= 728.5 - T147_MARGIN && p.x <= 735.1 + T147_MARGIN && p.z >= 157.5 - T147_MARGIN && p.z <= 163.8 + T147_MARGIN;

/** The chunk holding (x, z), or none off the map (past the chunks `groundY` is 0, no ground of the map). */
const chunkAt = (x: number, z: number) => MAP_CHUNKS.find(({ bounds: b }) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);

/**
 * Alchemia's terraces and the Hebi hollow under T2 (ADR-0074; T-186, T-206, T-207, T-217): its pads
 * and ramps with their blends, shaped on purpose by the investor's plan, their banks the model's.
 * A pad moves the grid's points within its blend, and the terrain between points spreads that over
 * a cell of the grid round them (the arcade's floor points, 2.5 and 4 m): the zone takes that cell
 * too. Not the car wash's pad (T-051, G-754).
 */
const rectOff = (r: (typeof ALCHEMIA_PADS)[number]["rect"], p: Pt) => Math.hypot(Math.max(r.minX - p.x, 0, p.x - r.maxX), Math.max(r.minZ - p.z, 0, p.z - r.maxZ));
export const onAlchemia = (p: Pt): boolean => {
  const cell = chunkAt(p.x, p.z)?.terrain.cell ?? 0;
  return ALCHEMIA_PADS.some((d) => rectOff(d.rect, p) <= d.blend + cell) || ALCHEMIA_RAMPS.some((r) => segmentDistance(p.x, p.z, r.a.x, r.a.z, r.b.x, r.b.z) <= r.width / 2 + r.blend + cell);
};

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

/**
 * How far off its axis a way's own ground goes (m): a path's is about its axis (`AXIS_REACH`, the
 * curator's 0.6 m), a street's or a pedestrian street's half its carriageway (`roadWidth`), else
 * a bank in the middle of w179264855 (G-755, 1-3 m off its axis) would be across it.
 */
const PATHS = new Set(["footway", "path", "cycleway", "bridleway", "corridor", "track"]);
const reachOf = (t: WalkWay["tags"]): number => (PATHS.has(t.highway ?? "") ? 0 : roadWidth(t) / 2);

/**
 * The city's world for `walk-blocked`, along the map data's ways `ways` (`extractFeatures(...).lines`),
 * their blocked stretches worked out once: their samples off the map are no ground.
 */
export const cityWalkWorld = (ways: readonly WalkWay[]): WalkWorld => {
  const along = nearStretches(blockedStretches(ways, (x, z) => (chunkAt(x, z) ? groundY(x, z) : Number.NaN), reachOf));
  return {
    height: heightIn,
    deck: (x, z, y) => decksAt(x, z).find((d) => inBox(d.box, x, z) && pointInRingEvenOdd(x, z, d.ring) && Math.abs(deckHeight(d, x, z) - y) < 1e-6) ?? null,
    headroom: DECK_HEADROOM,
    edge: (a, b) => {
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      return T147(mid) || onAlchemia(mid) || inBuilding(a.x, a.z) || inBuilding(b.x, b.z) || byBarrier(mid.x, mid.z);
    },
    along: (a, b) => along((a.x + b.x) / 2, (a.z + b.z) / 2),
  };
};
