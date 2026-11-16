import type { StreetPropItem, Vec3 } from "@seki/core";
import { type ChunkDef, type StaticProp, Simulation, WORLD_BARRIERS, WORLD_CHUNKS, chunkAt, gangerEntity, ground } from "../../src";
import { barrierProps, distanceToBarrier } from "../../src/content/lublin/barriers";
import { teleportPlayer } from "../helpers";

/**
 * The map's barriers round a few places on flat ground, as a test floor (ADR-0046, ADR-0083): the
 * rules of the chase round a long barrier (G-610, G-625, G-643, G-644, G-694) do not need the
 * city round it, only the barriers' shape. Each place is a chunk of its own, 500 m a side, with
 * the pieces of `WORLD_BARRIERS` within `FLOOR_REACH` of it laid at y = 0 (their kind, length and
 * rise kept) and nothing else: no terrain, furniture or level graph. A place with `buildings`
 * (a yard walled by houses) gets the map's solids there too, each as high above y = 0 as it stood
 * above the ground. The steering's
 * windows lie on the same grid of the world as in the city, so the corners of the wide windows
 * stay where the tests of the city found them, (2352, 432). Load it with `barrierSim`.
 */

/** How far from a place its barriers are laid (m): past the wide window round it (192 m a side). */
export const FLOOR_REACH = 150;
/** Half the side of a place's chunk (m). */
const HALF = 250;

/** A place of a floor: its middle, and whether the map's buildings round it are laid too. */
export interface FloorPlace {
  readonly x: number;
  readonly z: number;
  readonly buildings?: boolean;
}

/** The fence along the Bystrzyca (G-625): an alerted ganger walks some 85 m round it. */
export const BYSTRZYCA_FENCE: FloorPlace = { x: 2359.33, z: 445.19 };
/** Yards on Krakowskie walled by a wall 3 m high and by a fence, with the houses round them: no way round (G-625). */
export const WALLED_YARD: FloorPlace = { x: 214, z: -28.13, buildings: true };
export const FENCED_YARD: FloorPlace = { x: 114.7, z: 85.3, buildings: true };

/** The pieces each floor's chunk lays. */
const laid = new WeakMap<ChunkDef, readonly StreetPropItem[]>();

const pieces = Object.entries(WORLD_BARRIERS).flatMap(([chunk, items]) => items.map((item) => ({ chunk, item })));

const within = (place: FloorPlace, x: number, z: number) => Math.hypot(x - place.x, z - place.z) <= FLOOR_REACH;

/** The map's solids round `place` (no lifts), as high above y = 0 as they stood above the ground. */
const buildingsAt = (place: FloorPlace): StaticProp[] =>
  WORLD_CHUNKS.flatMap((c) => c.props).flatMap((p) =>
    p.solid && !p.mechanism && within(place, p.center.x, p.center.z) ? [{ ...p, center: { ...p.center, y: p.center.y - ground(p.center.x, p.center.z).y } }] : [],
  );

/** The floor round `place`: its barriers flat on y = 0, in the district the city has there. */
const floorAt = (place: FloorPlace, id: string): ChunkDef => {
  const items: StreetPropItem[] = pieces.flatMap(({ item }) => (within(place, item.x, item.z) ? [{ ...item, y: 0 }] : []));
  const district = chunkAt(place.x, place.z)?.district ?? "doki";
  const bounds = { minX: place.x - HALF, maxX: place.x + HALF, minZ: place.z - HALF, maxZ: place.z + HALF };
  const chunk: ChunkDef = { id, district, bounds, props: place.buildings ? buildingsAt(place) : [], actors: [], street: barrierProps(items) };
  laid.set(chunk, items);
  return chunk;
};

/** One floor a set of places, made once a set: the steering's shared memory keys on the chunks' identity. */
const floors = new Map<string, readonly ChunkDef[]>();
export const barrierFloor = (...places: readonly FloorPlace[]): readonly ChunkDef[] => {
  const key = places.map((p) => `${p.x},${p.z},${p.buildings === true}`).join(";");
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
export const barrierSim = (at: { readonly x: number; readonly z: number }, ...places: readonly FloorPlace[]) => {
  const chunks = barrierFloor(...(places.length > 0 ? places : [at]));
  const sim = Simulation.create({ seed: 2, chunks });
  teleportPlayer(sim, flat(at.x, at.z));
  sim.step();
  return { sim, chunks };
};

/** The player 1.5 m off the piece nearest `place` on one side, an alerted ganger 4 m off it on the other, on the floor round it. */
export const standOff = (place: FloorPlace, side: 1 | -1) => {
  const chunks = barrierFloor(place);
  const { chunk, item } = pieceAt(chunks, place.x, place.z);
  const to = off(item, 1.5 * side);
  const from = off(item, -4 * side);
  const { sim } = barrierSim(to, place);
  const player = sim.player()!;
  const ganger = gangerEntity(9001, { key: "g625", position: flat(from.x, from.z), yaw: 0 }, null, 200, chunk);
  ganger.ai!.alerted = true;
  sim.world.add(ganger);
  return { sim, chunks, player, ganger, hp: player.health!.current };
};
