import type { StreetPropItem, Vec3 } from "@seki/core";
import { type ChunkDef, Simulation, WORLD_BARRIERS, chunkAt, gangerEntity } from "../../src";
import { barrierProps, distanceToBarrier } from "../../src/content/lublin/barriers";
import { teleportPlayer } from "../helpers";

/**
 * The map's barriers round a few places on flat ground, as a test floor (ADR-0046, ADR-0083): the
 * rules of the chase round a long barrier (G-610, G-625, G-643, G-644, G-694) do not need the
 * city round it, only the barriers' shape. Each place is a chunk of its own, 500 m a side, with
 * the pieces of `WORLD_BARRIERS` within `FLOOR_REACH` of it laid at y = 0 (their kind, length and
 * rise kept) and nothing else: no terrain, buildings, furniture or level graph. The steering's
 * windows lie on the same grid of the world as in the city, so the corners of the wide windows
 * stay where the tests of the city found them, (2352, 432). Load it with `barrierSim`.
 */

/** How far from a place its barriers are laid (m): past the wide window round it (192 m a side). */
export const FLOOR_REACH = 150;
/** Half the side of a place's chunk (m). */
const HALF = 250;

/** The places of the tests: the fence along the Bystrzyca, two walled yards and two lone fences (G-610). */
export const BYSTRZYCA_FENCE = { x: 2359.33, z: 445.19 } as const;

/** The pieces each floor's chunk lays. */
const laid = new WeakMap<ChunkDef, readonly StreetPropItem[]>();

const pieces = Object.entries(WORLD_BARRIERS).flatMap(([chunk, items]) => items.map((item) => ({ chunk, item })));

/** The floor round `place`: its barriers flat on y = 0, in the district the city has there. */
const floorAt = (place: { readonly x: number; readonly z: number }, id: string): ChunkDef => {
  const items: StreetPropItem[] = pieces.flatMap(({ item }) => (Math.hypot(item.x - place.x, item.z - place.z) <= FLOOR_REACH ? [{ ...item, y: 0 }] : []));
  const district = chunkAt(place.x, place.z)?.district ?? "doki";
  const chunk: ChunkDef = { id, district, bounds: { minX: place.x - HALF, maxX: place.x + HALF, minZ: place.z - HALF, maxZ: place.z + HALF }, props: [], actors: [], street: barrierProps(items) };
  laid.set(chunk, items);
  return chunk;
};

/** One floor a set of places, made once a set: the steering's shared memory keys on the chunks' identity. */
const floors = new Map<string, readonly ChunkDef[]>();
export const barrierFloor = (...places: readonly { readonly x: number; readonly z: number }[]): readonly ChunkDef[] => {
  const key = places.map((p) => `${p.x},${p.z}`).join(";");
  let chunks = floors.get(key);
  if (!chunks) {
    chunks = places.map((p, i) => floorAt(p, `barrier-floor-${i}`));
    floors.set(key, chunks);
  }
  return chunks;
};

/** A point on the floor: its ground is y = 0 everywhere. */
export const flat = (x: number, z: number): Vec3 => ({ x, y: 0, z });

/** The barrier pieces of a floor, with the chunk each stands in. */
export const floorPieces = (chunks: readonly ChunkDef[]) => chunks.flatMap((c) => (laid.get(c) ?? []).map((item) => ({ chunk: c.id, item })));

/** The piece of a floor's barriers nearest to a point. */
export const pieceAt = (chunks: readonly ChunkDef[], x: number, z: number) =>
  floorPieces(chunks).reduce((a, b) => (Math.hypot(b.item.x - x, b.item.z - z) < Math.hypot(a.item.x - x, a.item.z - z) ? b : a));
/** A point `a` metres off a piece's middle, square to it. */
export const off = (i: StreetPropItem, a: number) => ({ x: i.x + Math.cos(i.yaw) * a, z: i.z - Math.sin(i.yaw) * a });
/** How far a point is from the nearest barrier of a floor. */
export const nearestBarrier = (chunks: readonly ChunkDef[], x: number, z: number) => Math.min(...floorPieces(chunks).map((o) => distanceToBarrier(o.item, x, z)));

/** A new game on the floor of `places`, the player at `at`, after one step to load it. */
export const barrierSim = (at: { readonly x: number; readonly z: number }, ...places: readonly { readonly x: number; readonly z: number }[]) => {
  const chunks = barrierFloor(...(places.length > 0 ? places : [at]));
  const sim = Simulation.create({ seed: 2, chunks });
  teleportPlayer(sim, flat(at.x, at.z));
  sim.step();
  return { sim, chunks };
};

/** The player 1.5 m off the piece nearest `(x, z)` on one side, an alerted ganger 4 m off it on the other, on the floor round it. */
export const standOff = (x: number, z: number, side: 1 | -1) => {
  const chunks = barrierFloor({ x, z });
  const { chunk, item } = pieceAt(chunks, x, z);
  const to = off(item, 1.5 * side);
  const from = off(item, -4 * side);
  const { sim } = barrierSim(to, { x, z });
  const player = sim.player()!;
  const ganger = gangerEntity(9001, { key: "g625", position: flat(from.x, from.z), yaw: 0 }, null, 200, chunk);
  ganger.ai!.alerted = true;
  sim.world.add(ganger);
  return { sim, chunks, player, ganger, hp: player.health!.current };
};
