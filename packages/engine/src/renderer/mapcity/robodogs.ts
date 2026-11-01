import type { Vec3 } from "@seki/core";
import { GATE_PASSAGES, PASSAGES, againstWall, chunkAt, inBuilding, nearestWall } from "@seki/sim";
import type { KitModel } from "../city-kit-data";
import { type CityProps, addPropToSink, facing, pointSeed, propHash } from "../city-props";
import type { MeshSink } from "../mesh-sink";
import { type WorldProp, placePoint } from "./prop-batch";

/**
 * Robot dogs (ADR-0063): the CC-BY `pr-robodog` of `city-props.glb`, one at a time and rarely: by
 * a market stall of Podzamcze and by a gate (the city gates, the gateways of Podzamcze and
 * Nabrzeże). A dog has no solid, so it lies side-on against something the body cannot get into:
 * the front of a stall's counter (a solid, ADR-0050) or a wall, within `DOG_DEPTH` of it, less
 * than the body's radius (0.38 m). Chosen from the position (no randomness), baked into the street
 * furniture's block mesh; the simulation does not change.
 */

/** How far the dog reaches out from what it lies against (its width, the model's x), metres. */
export const DOG_DEPTH = 0.33;
/** One stall in this many gets a dog; one gateway in this many (the city gates always). */
const STALL_SHARE = 3;
const GATEWAY_SHARE = 2;
/** Other furniture this close to a dog leaves the spot empty, metres. */
const CLEAR = 1.0;
/** The counter's front face in the stall's frame (`marketStall`, the sim's counter box). */
const COUNTER_FRONT = 0.8;
const COUNTER_END = 0.62;

export interface DogSpot {
  /** The middle of its feet. */
  readonly at: Vec3;
  /** Where its head points (horizontal unit vector). */
  readonly front: Vec3;
}

/** The dog's model of the props file, or null. */
export const dogModel = (props: CityProps | null): KitModel | null => props?.byStyle.get("robodog")?.[0] ?? null;

/** From what it lies against to the middle of the dog. */
const HALF = DOG_DEPTH / 2 + 0.01;

/**
 * The dog by a stall, or null: a third of Podzamcze's stalls, in front of the counter at one end,
 * its side to the counter and its head out along it.
 */
export const stallDog = (stall: WorldProp): DogSpot | null => {
  if (stall.prop !== "market-stall" || chunkAt(stall.x, stall.z)?.district !== "targ") return null;
  const seed = pointSeed(stall);
  if (propHash(seed, 63) % STALL_SHARE !== 0) return null;
  const side = propHash(seed, 64) % 2 === 0 ? -1 : 1;
  const at = placePoint(stall, { x: side * COUNTER_END, y: 0, z: COUNTER_FRONT + HALF });
  const ahead = placePoint(stall, { x: side * (COUNTER_END + 1), y: 0, z: COUNTER_FRONT + HALF });
  return { at, front: { x: ahead.x - at.x, y: 0, z: ahead.z - at.z } };
};

/** The dog against the facade at a mouth, on one side of it, or null where that wall is not the mouth's facade (a corner) or the spot is in a building. */
const dogBeside = (p: (typeof PASSAGES)[number], mouth: { x: number; z: number }, side: number): DogSpot | null => {
  const wall = againstWall(mouth.x, mouth.z, 0);
  const n = { x: Math.sin(wall.yaw), z: Math.cos(wall.yaw) };
  const along = { x: n.z * side, z: -n.x * side };
  const off = p.width / 2 + 1 + 0.3;
  const spot = againstWall(wall.at.x + along.x * off, wall.at.z + along.z * off, HALF);
  const back = nearestWall(spot.at.x, spot.at.z, true);
  // The same facade (its normal within some 10°) and the spot about where it was asked for.
  if (Math.abs(Math.sin(spot.yaw - wall.yaw)) > 0.18 || Math.cos(spot.yaw - wall.yaw) < 0 || back.d > HALF + 0.1) return null;
  if (Math.hypot(spot.at.x - (wall.at.x + along.x * off), spot.at.z - (wall.at.z + along.z * off)) > 1 || inBuilding(spot.at.x, spot.at.z)) return null;
  return { at: spot.at, front: { x: -along.x, y: 0, z: -along.z } };
};

/**
 * The dog by a gateway, or null: against the facade beside one mouth of the passage, a metre past
 * its edge, its head to the opening. Every city gate gets one, half of the other gateways of
 * Podzamcze and Nabrzeże; a spot whose wall is not the facade of the mouth (a corner) stays empty,
 * but a city gate's dog moves to the mouth's other side, then to the other mouth.
 */
export const gateDog = (p: (typeof PASSAGES)[number], gate: boolean): DogSpot | null => {
  const seed = pointSeed({ x: p.from.x, y: 0, z: p.from.z });
  if (!gate && propHash(seed, 65) % GATEWAY_SHARE !== 0) return null;
  const mouths = propHash(seed, 66) % 2 === 0 ? [p.from, p.to] : [p.to, p.from];
  const sides = propHash(seed, 67) % 2 === 0 ? [-1, 1] : [1, -1];
  const tries = gate ? mouths.flatMap((m) => sides.map((s) => [m, s] as const)) : [[mouths[0]!, sides[0]!] as const];
  for (const [m, s] of tries) {
    const spot = dogBeside(p, m, s);
    if (spot) return spot;
  }
  return null;
};

let gates: readonly DogSpot[] | null = null;

/** The dogs by the gateways (worked out once). */
export const gateDogs = (): readonly DogSpot[] => {
  if (gates) return gates;
  const out: DogSpot[] = [];
  for (const p of PASSAGES) {
    const gate = GATE_PASSAGES.includes(p);
    const district = chunkAt(p.from.x, p.from.z)?.district;
    if (!gate && district !== "targ" && district !== "doki") continue;
    const spot = gateDog(p, gate);
    if (spot) out.push(spot);
  }
  gates = out;
  return out;
};

/** A spot with no other furniture within `CLEAR` (a sign, a bench, a planter would cut through the dog). */
export const clearOf = (spot: DogSpot, pieces: readonly WorldProp[], own: WorldProp | null = null): boolean =>
  pieces.every((p) => p === own || p.prop === "manhole" || Math.hypot(p.x - spot.at.x, p.z - spot.at.z) >= CLEAR);

/** Bakes the dogs of a block. */
export const bakeDogs = (sink: MeshSink, props: CityProps, model: KitModel, spots: readonly DogSpot[]): void => {
  for (const s of spots) addPropToSink(sink, props, model, facing(s.at, s.front, { x: 1, y: 1, z: 1 }));
};
