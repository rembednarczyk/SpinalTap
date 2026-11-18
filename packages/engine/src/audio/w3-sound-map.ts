import type { AudioListenerPose, Vec3 } from "@seki/core";
import { W3_CHAMBER, W3_GATE, W3_LAYOUT, W3_PIPES, W3_PLATFORM, W3_ROOF, W3_WATER_Y, W3_Y, interiorAt } from "@seki/sim";
import { type Emitter, type EmitterMix, emitterMix } from "./spatial";

/**
 * Where W-3 sounds (ADR-0082 stage 4): the emitters of the sector's soundscape in world metres,
 * read off the same `@seki/sim` constants as the halls' meshes, and the mix the listener hears
 * from them. Pure numbers, no WebAudio: `W3Scape` turns the mix into node levels.
 *
 * - In the hall: the assembly line's belts, the transformers of the test chamber and the server
 *   rooms, the strip lights under the ceiling; the robot arms and the steam valves are one-shots
 *   scheduled by `W3Scape` at `W3_ARMS` and `W3_STEAM_INSIDE`.
 * - Outside: the Bystrzyca along the quay and the basin, the plant's drone off the cooling units
 *   and the walls, the TESSEN neon over the wagon gate, steam off the pipeline's valves.
 * The hall's sounds reach the yard muffled through its walls and the yard's reach the hall the
 * same way (`W3_PLACES`). Far from the sector everything is silent and `near` is false.
 */

export type W3Layer = "line" | "hum" | "tubes" | "river" | "plant" | "sign";
export type W3Place = "hall" | "basement" | "office" | "outside";

/** The group a layer sounds in: the hall's (behind its walls) or the yard's (in the open). */
export const W3_LAYER_GROUP: Readonly<Record<W3Layer, "hall" | "yard">> = {
  line: "hall",
  hum: "hall",
  tubes: "hall",
  river: "yard",
  plant: "yard",
  sign: "yard",
};

/** How one group is heard from a place: its level and the low-pass of the walls between (Hz). */
export interface W3Group {
  readonly gain: number;
  readonly cutoff: number;
}

const OPEN = 12000;
/** The groups from each place: inside, the yard comes through the walls dull; outside, the hall does. */
export const W3_PLACES: Readonly<Record<W3Place, { readonly hall: W3Group; readonly yard: W3Group }>> = {
  hall: { hall: { gain: 1, cutoff: OPEN }, yard: { gain: 0.12, cutoff: 500 } },
  basement: { hall: { gain: 0.45, cutoff: 320 }, yard: { gain: 0.06, cutoff: 400 } },
  office: { hall: { gain: 0.2, cutoff: 380 }, yard: { gain: 0.35, cutoff: 900 } },
  outside: { hall: { gain: 0.3, cutoff: 450 }, yard: { gain: 1, cutoff: OPEN } },
};

/** How loud the street's rain and traffic stay in each place (the hall's roof keeps the rain off). */
export const W3_STREET_LEVEL: Readonly<Record<W3Place, number>> = { hall: 0.3, basement: 0.15, office: 0.5, outside: 1 };

const y = (over: number) => W3_Y + over;
const L = W3_LAYOUT;
const beltZ = [(L.BELT_L1.minZ + L.BELT_L1.maxZ) / 2, (L.BELT_L2.minZ + L.BELT_L2.maxZ) / 2] as const;
const along = (from: number, to: number, step: number): number[] => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

/** The belts' rollers, every 8 m along both belts. */
const LINE: readonly Emitter[] = beltZ.flatMap((z) => along(L.BELT_X.minX, L.BELT_X.maxX, 8).map((x) => ({ position: { x, y: y(L.BELT_H), z }, level: 0.7 })));

/** The transformers: the test chamber's and one in each server room (the far ends of rows S and N). */
const SERVER_X = ((L.ROW_N_SPLITS.at(-1) ?? W3_CHAMBER.minX) + W3_CHAMBER.maxX) / 2;
const HUM: readonly Emitter[] = [
  { position: { x: (W3_CHAMBER.minX + W3_CHAMBER.maxX) / 2, y: y(1.5), z: (W3_CHAMBER.minZ + W3_CHAMBER.maxZ) / 2 }, level: 1 },
  { position: { x: SERVER_X, y: y(1.5), z: (L.ROW_S_ROOMS.minZ + L.ROW_S_ROOMS.maxZ) / 2 }, level: 0.8 },
  { position: { x: SERVER_X, y: y(1.5), z: (L.ROW_N_ROOMS.minZ + L.ROW_N_ROOMS.maxZ) / 2 }, level: 0.8 },
];

/** The robot arms over the belts, where `W3Scape` sets off their servos and welds. */
export const W3_ARMS: readonly Vec3[] = beltZ.flatMap((z) => L.ARMS_X.map((x) => ({ x, y: y(L.BELT_H + 1.8), z })));

/** The valves on the orange pipes under the hall's ceiling (the renderer's steam, stage 4a). */
export const W3_STEAM_INSIDE: readonly Vec3[] = [
  { x: 2522, y: y(13.4), z: 407.4 },
  { x: 2541, y: y(13.4), z: 428.6 },
];
/** And outside: the pipeline's valves over the river, the cooling units on row N's roof. */
export const W3_STEAM_OUTSIDE: readonly Vec3[] = [
  { x: 2452, y: y(W3_PLATFORM + 0.95), z: (W3_PIPES.minZ + W3_PIPES.maxZ) / 2 },
  { x: 2474, y: y(W3_PLATFORM + 0.95), z: (W3_PIPES.minZ + W3_PIPES.maxZ) / 2 },
  ...[2532, 2556].map((x) => ({ x, y: y(W3_ROOF + L.COOLER.h), z: L.COOLER.z })),
];

/** The Bystrzyca past the quay and the pier (the bed west of x 2477), and the basin's still water, quieter. */
const RIVER: readonly Emitter[] = [
  ...along(380, 452, 12).map((z) => ({ position: { x: 2470, y: W3_WATER_Y, z }, level: 1 })),
  ...along(2516, 2588, 18).map((x) => ({ position: { x, y: W3_WATER_Y, z: 465 }, level: 0.45 })),
];

/** The plant's drone: the cooling units on row N's roof, and the hall's walls the line hums through. */
const PLANT: readonly Emitter[] = [
  ...L.COOLERS_X.map((x) => ({ position: { x, y: y(W3_ROOF + 0.7), z: L.COOLER.z }, level: 0.8 })),
  { position: { x: W3_GATE.x, y: y(4), z: (W3_GATE.minZ + W3_GATE.maxZ) / 2 }, level: 0.6 },
  { position: { x: W3_CHAMBER.maxX, y: y(4), z: (W3_CHAMBER.minZ + W3_CHAMBER.maxZ) / 2 }, level: 0.6 },
];

/** The TESSEN neon on its board over the wagon gate (picture 01, stage 4a). */
const SIGN: readonly Emitter[] = [{ position: { x: W3_GATE.x - 0.22, y: y(9), z: (W3_GATE.minZ + W3_GATE.maxZ) / 2 }, level: 1 }];

/** Each layer's emitters, the distance it is loudest within and the one it is silent beyond (m). */
const LAYERS: Readonly<Record<Exclude<W3Layer, "tubes">, { readonly emitters: readonly Emitter[]; readonly ref: number; readonly max: number }>> = {
  line: { emitters: LINE, ref: 3, max: 45 },
  hum: { emitters: HUM, ref: 3, max: 38 },
  river: { emitters: RIVER, ref: 4, max: 38 },
  plant: { emitters: PLANT, ref: 5, max: 70 },
  sign: { emitters: SIGN, ref: 3, max: 28 },
};

/** The sector's box: the river's bed on the west to the east fence, the public strip to the basin. */
export const W3_SOUND_BOX = { minX: 2440, maxX: 2606, minZ: 378, maxZ: 480 } as const;
/** The soundscape is built within this of the box and torn down past `W3_SOUND_FAR` (hysteresis). */
export const W3_SOUND_NEAR = 90;
export const W3_SOUND_FAR = 120;

/** How far the listener is from the sector's box on the ground (0 inside). */
export const w3SoundDistance = (p: Vec3): number => {
  const b = W3_SOUND_BOX;
  return Math.hypot(Math.max(b.minX - p.x, 0, p.x - b.maxX), Math.max(b.minZ - p.z, 0, p.z - b.maxZ));
};

/** Where the listener is in W-3: in the hall, its basement, the tower's office, or in the open. */
export const w3Place = (p: Vec3, last: W3Place = "outside"): W3Place => {
  const held = last === "hall" ? "w3-hall" : last === "basement" ? "w3-basement" : last === "office" ? "tessen-office" : null;
  const id = interiorAt(p, held, 0.4)?.id;
  return id === "w3-hall" ? "hall" : id === "w3-basement" ? "basement" : id === "tessen-office" ? "office" : "outside";
};

export interface W3Mix {
  /** Within `W3_SOUND_NEAR` of the sector: the soundscape is (or should be) built. */
  readonly near: boolean;
  readonly place: W3Place;
  /** Each layer's level and pan from distance alone, before its group. */
  readonly layers: Readonly<Record<W3Layer, EmitterMix>>;
  readonly hall: W3Group;
  readonly yard: W3Group;
}

const SILENT: EmitterMix = { gain: 0, pan: 0 };

/** What the listener hears of W-3 from `pose`; `last` is the place of the last mix (its walls hold 0.4 m). */
export const w3Mix = (pose: AudioListenerPose, last: W3Place = "outside"): W3Mix => {
  const near = w3SoundDistance(pose.position) < W3_SOUND_NEAR;
  const place = near ? w3Place(pose.position, last) : "outside";
  const mix = (l: Exclude<W3Layer, "tubes">): EmitterMix => (near ? emitterMix(pose, LAYERS[l].emitters, LAYERS[l].ref, LAYERS[l].max) : SILENT);
  const layers = { line: mix("line"), hum: mix("hum"), tubes: place === "hall" ? { gain: 1, pan: 0 } : SILENT, river: mix("river"), plant: mix("plant"), sign: mix("sign") };
  return { near, place, layers, ...W3_PLACES[place] };
};

/** A layer's level as heard: its distance mix times its group's level from the listener's place. */
export const w3Heard = (m: W3Mix, layer: W3Layer): number => m.layers[layer].gain * m[W3_LAYER_GROUP[layer]].gain;

/** One emitter's level and pan for a one-shot at `at` (an arm, a valve), within `max` metres. */
export const w3PointMix = (pose: AudioListenerPose, at: Vec3, ref = 2.5, max = 32): EmitterMix => emitterMix(pose, [{ position: at, level: 1 }], ref, max);
