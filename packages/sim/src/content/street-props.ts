import type { StreetPropItem } from "@seki/core";
import type { ActorDef, Rect, StaticProp } from "./builders";
import { DISTRICT_M0_ACTORS, DISTRICT_M0_PROPS } from "./district-m0";
import { KANAL_ACTORS, KANAL_PROPS } from "./district-kanal";
import { TARG_NORTH_ACTORS, TARG_NORTH_PROPS, TARG_SOUTH_ACTORS, TARG_SOUTH_PROPS } from "./district-targ";
import { DOKI_QUAY_ACTORS, DOKI_QUAY_PROPS, DOKI_YARD_ACTORS, DOKI_YARD_PROPS } from "./district-doki";
import { METRO_STATIONS } from "./metro";
import { CLEARED_BUILDINGS, MAP_CHUNKS, PASSAGES } from "./lublin/sites";
import { inBuilding } from "./lublin/places";
import { groundY } from "./lublin/terrain";
import { LUBLIN_STREET_PROPS } from "./lublin";
import { anchors, bollardChains, chainSegments, distanceToPiece, dropChains, furnitureRadius } from "./lublin/furniture";
import { DRINKER_SITES, drinkerWay } from "./contract-plans";

/**
 * What stands on the game's streets besides the game's own content (ADR-0050): the map's
 * furniture that keeps clear of the set pieces, the game's blocks and characters and the ways
 * the content walks straight, and the test other street things (parked cars) use for the same.
 */

const distanceToRect = (x: number, z: number, r: Rect): number => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

/** What the game adds to the map, in the order its entity ids are reserved. */
export const GAME_PROPS: readonly StaticProp[] = [...DISTRICT_M0_PROPS, ...KANAL_PROPS, ...TARG_SOUTH_PROPS, ...TARG_NORTH_PROPS, ...DOKI_YARD_PROPS, ...DOKI_QUAY_PROPS];
export const GAME_ACTORS: readonly ActorDef[] = [...DISTRICT_M0_ACTORS, ...KANAL_ACTORS, ...TARG_SOUTH_ACTORS, ...TARG_NORTH_ACTORS, ...DOKI_YARD_ACTORS, ...DOKI_QUAY_ACTORS];

/** A set piece's or a game block's clearance from the map's furniture (m). */
const FURNITURE_CLEARANCE = 1.2;

const gameBlocks: readonly Rect[] = [...GAME_PROPS, ...METRO_STATIONS.flatMap((m) => m.props)].flatMap((p) =>
  p.view.kind === "block" ? [{ minX: p.center.x - p.view.size.x / 2, maxX: p.center.x + p.view.size.x / 2, minZ: p.center.z - p.view.size.z / 2, maxZ: p.center.z + p.view.size.z / 2 }] : [],
).concat(METRO_STATIONS.map((m) => ({ minX: m.kiosk.x - 0.6, maxX: m.kiosk.x + 0.6, minZ: m.kiosk.z - 0.6, maxZ: m.kiosk.z + 0.6 })));

type Pt = { readonly x: number; readonly z: number };

/** Horizontal distance from (x, z) to the segment a..b. */
const segmentDistance = (x: number, z: number, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
};

/** Plac Łokietka on foot: from the deptak across the square to the mouth of Brama Krakowska (ADR-0045). */
const GATE_WALK: readonly Pt[] = [
  { x: 400, z: -97 },
  { x: 440, z: -100 },
  { x: 447, z: -95 },
  { x: 457, z: -95.6 },
];

/** From Brama Grodzka down Zamkowa, across Plac Zamkowy's car park, under the viaduct to the market (ADR-0045). */
const CASTLE_WALK: readonly Pt[] = [
  { x: 730, z: 155 },
  { x: 739, z: 174 },
  { x: 725, z: 193 },
  { x: 720, z: 203 },
  { x: 720, z: 267 },
  { x: 737, z: 286 },
  { x: 741, z: 327 },
];

/** Ways the content walks in straight lines (the night drinker's to the bar, the gates' passages): no furniture on them. */
const KEEP_CLEAR: readonly (readonly [Pt, Pt])[] = [
  ...DRINKER_SITES.flatMap((site) => {
    const way = drinkerWay(site) ?? [];
    return way.slice(1).map((p, k) => [way[k] as Pt, p] as const);
  }),
  ...PASSAGES.map((p) => [p.from, p.to] as const),
  // The way from the deptak across Plac Łokietka into Brama Krakowska.
  ...GATE_WALK.slice(1).map((p, k) => [GATE_WALK[k] as Pt, p] as const),
  ...CASTLE_WALK.slice(1).map((p, k) => [CASTLE_WALK[k] as Pt, p] as const),
];

/**
 * Does a thing of radius `r` at (x, z), under a building, reach into a passage through it: within
 * half the passage's width (and 0.3 m) of its axis? The OSM way through a gate need not be the
 * passage's axis (Brama Grodzka, G-136), so the wall lanterns under the vault go by the passage.
 */
const inPassage = (x: number, z: number, r: number): boolean =>
  inBuilding(x, z) &&
  PASSAGES.some((p) => {
    const len = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
    const [ux, uz] = [(p.to.x - p.from.x) / len, (p.to.z - p.from.z) / len];
    const s = (x - p.from.x) * ux + (z - p.from.z) * uz;
    const off = (x - p.from.x) * uz - (z - p.from.z) * ux;
    return s >= 0 && s <= len && Math.abs(off) < p.width / 2 + r + 0.3;
  });

/**
 * Does a thing of radius `r` at (x, z) stand clear of the ways the content walks straight, and
 * `pad` metres more than the furniture does of the game's set pieces, blocks and characters?
 */
export const clearOfGame = (x: number, z: number, r: number, pad = 0): boolean =>
  !CLEARED_BUILDINGS.some((c) => distanceToRect(x, z, c) < 2 + pad) &&
  !gameBlocks.some((b) => distanceToRect(x, z, b) < FURNITURE_CLEARANCE + pad) &&
  !GAME_ACTORS.some((a) => Math.hypot(a.spawn.position.x - x, a.spawn.position.z - z) < FURNITURE_CLEARANCE + pad) &&
  !KEEP_CLEAR.some(([a, b]) => segmentDistance(x, z, a, b) < r + 0.7) &&
  !inPassage(x, z, r);

/** How far a stall's stock stands from it (ADR-0058 stage 3, `props-food.ts`: beside its canvas), at most. */
const STOCK_REACH = 2.6;

/** The map's pieces clear of the game, before their stock is matched to the stalls kept. */
const clear: Readonly<Record<string, readonly StreetPropItem[]>> = Object.fromEntries(
  MAP_CHUNKS.map((c) => [c.id, (LUBLIN_STREET_PROPS[c.id] ?? []).filter((i) => clearOfGame(i.x, i.z, furnitureRadius(i)))]),
);

/** Every stall the game kept, of all chunks: a stall and its stock may lie on two sides of a chunk's edge. */
const keptStalls = Object.values(clear)
  .flat()
  .filter((i) => i.prop === "market-stall");

/** The stock whose stall gave way to the game goes with it: no pallet of a stall that is not there. */
const withStall = (i: StreetPropItem): boolean => i.prop !== "market-goods" || keptStalls.some((s) => Math.hypot(s.x - i.x, s.z - i.z) <= STOCK_REACH);

/**
 * The map's pieces clear of the game, on the shaped terrain. A door on a facade (ADR-0058 stage 9)
 * keeps the foot the import measured on the paving drawn under it: its top was fitted to the
 * facade's windows from there.
 */
const kept: Readonly<Record<string, readonly StreetPropItem[]>> = Object.fromEntries(
  Object.entries(clear).map(([id, items]) => [id, items.filter(withStall).map((i) => (i.prop === "door" ? i : { ...i, y: Math.round(groundY(i.x, i.z) * 100) / 100 }))]),
);

const keptPieces = Object.values(kept).flat();

/** Is a chain ending at `to` held there by another post or a pole the game kept (G-032)? */
const held = (i: StreetPropItem, to: { x: number; z: number }): boolean =>
  keptPieces.some((o) => o !== i && Math.abs(o.x - to.x) < 1 && Math.abs(o.z - to.z) < 1 && (o.prop === "bollard" ? distanceToPiece(o, to.x, to.z) <= 0.2 : anchors(o, to)));

/** A bollard without the chains whose far end gave way to the game. */
const unhung = (i: StreetPropItem): StreetPropItem => {
  const loose = chainSegments(i).map((s) => !held(i, s.to));
  return loose.some(Boolean) ? dropChains(i, bollardChains(i).filter((_, k) => loose[k])) : i;
};

/**
 * The street furniture of the game's Lublin per chunk (ADR-0050): the map's pieces (ADR-0047)
 * that stand clear of the set pieces and the game's own blocks, on the shaped terrain. A bollard
 * whose next post of the row gave way to the game ends the row there, with no chain into the air.
 */
export const WORLD_STREET_PROPS: Readonly<Record<string, readonly StreetPropItem[]>> = Object.fromEntries(
  Object.entries(kept).map(([id, items]) => [id, items.map(unhung)]),
);

