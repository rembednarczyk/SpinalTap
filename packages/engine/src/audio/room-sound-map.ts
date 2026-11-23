import { type AudioListenerPose, ROOM_DETAIL_SHAPES, type RoomSound, type Vec3 } from "@seki/core";
import { INTERIORS, WORLD_SCENERY, interiorAt } from "@seki/sim";
import { type Emitter, type EmitterMix, emitterMix } from "./spatial";

/**
 * Where the rooms sound (`docs/zasady-lokacji.md` §17, ADR-0099 stage 6): every placing of a room-detail model whose
 * shape has a `sound` (an aquarium's pump, a fuse box's hum, a metro vent, a leak's drip, a pot on the hob, the strip
 * lights) is an emitter in world metres, in the interior it stands in. Pure numbers, no WebAudio: `RoomScape` turns the
 * mix into node levels.
 *
 * Pattern: the rooms and portals of game audio's spatial middleware (Wwise Spatial Audio rooms, Unreal's audio volumes
 * with interior settings): an emitter in the listener's room is heard whole, one in another room or outside comes
 * through the walls quieter and low-passed. Different from them: no portals (a room's doorway does not carry the sound
 * further than its walls do) and no reverb of the room's own, as the street's ambience has none either. The open air
 * is one more room (null): a thing outside every interior (the neon's transformer, a kitchen's exhaust fan and a
 * bucket's drip on the pavilion's roof, 23.11) is heard whole by a listener outside and through the walls from inside.
 */

export interface RoomEmitter extends Emitter {
  readonly sound: RoomSound;
  /** The interior it stands in (`INTERIORS`), null outside every one. */
  readonly room: string | null;
}

export const ROOM_SOUNDS: readonly RoomSound[] = ["vent", "hum", "pump", "drip", "simmer", "tubes"];

/** Each sound's reach: loudest within `ref` metres, silent past `max` (small things heard in their room, not the street's). */
export const ROOM_SOUND_REACH: Readonly<Record<RoomSound, { readonly ref: number; readonly max: number }>> = {
  vent: { ref: 2, max: 16 },
  hum: { ref: 1.2, max: 10 },
  pump: { ref: 1.5, max: 12 },
  drip: { ref: 1.5, max: 14 },
  simmer: { ref: 1.5, max: 12 },
  tubes: { ref: 2, max: 14 },
};

/** Through a wall: this much of the sound, low-passed at `cutoff` Hz (as W-3's hall heard from its basement). */
export const THROUGH_WALL = { gain: 0.18, cutoff: 420 } as const;
const OPEN = 12000;

/** A wall-hung thing's centre can be in the wall: this much past a room's edge it still counts as in it. */
const WALL_SLACK = 0.6;

/**
 * The interior a thing stands in: as it stands (on the floor or a shelf), a fitting under the ceiling in the room under
 * it, a thing on a wall in the room it faces (its centre within `WALL_SLACK` of the room).
 */
const roomOf = (p: Vec3): string | null => {
  const at = interiorAt(p) ?? interiorAt({ ...p, y: p.y - 1.5 });
  if (at) return at.id;
  const near = INTERIORS.find((i) =>
    i.rooms.some((r) => p.x >= r.minX - WALL_SLACK && p.x <= r.maxX + WALL_SLACK && p.z >= r.minZ - WALL_SLACK && p.z <= r.maxZ + WALL_SLACK && p.y >= r.bottom - 0.3 && p.y <= r.top + 0.3),
  );
  return near?.id ?? null;
};

/** Every placed room-detail model with a sound, its interior found once. */
export const roomEmitters = (): RoomEmitter[] => {
  const out: RoomEmitter[] = [];
  for (const s of WORLD_SCENERY) {
    if (s.view.kind !== "street-props") continue;
    for (const item of s.view.items) {
      if (item.prop !== "room-detail") continue;
      const sound = ROOM_DETAIL_SHAPES[item.variant % ROOM_DETAIL_SHAPES.length]?.sound;
      if (!sound) continue;
      const position: Vec3 = { x: s.at.x + item.x, y: s.at.y + item.y, z: s.at.z + item.z };
      out.push({ position, level: 1, sound, room: roomOf(position) });
    }
  }
  return out;
};

/** The soundscape is built within this of the nearest emitter and torn down past `ROOM_SOUND_FAR` (hysteresis). */
export const ROOM_SOUND_NEAR = 18;
export const ROOM_SOUND_FAR = 26;

/** One sound as heard: its level and pan, and the low-pass of the walls between (Hz). */
export interface RoomLayerMix extends EmitterMix {
  readonly cutoff: number;
}

export interface RoomMix {
  /** The listener's interior, null outside. */
  readonly room: string | null;
  /** Metres to the nearest emitter. */
  readonly nearest: number;
  readonly layers: Readonly<Record<RoomSound, RoomLayerMix>>;
}

const SILENT: RoomLayerMix = { gain: 0, pan: 0, cutoff: OPEN };

/**
 * What the listener at `pose` hears of the rooms; `held` is the interior of the last mix (its walls hold 0.4 m, as
 * W-3's places). Only emitters within reach count, so the city far from any room costs a distance per emitter.
 */
export const roomMix = (pose: AudioListenerPose, emitters: readonly RoomEmitter[], held: string | null = null): RoomMix => {
  const p = pose.position;
  let nearest = Infinity;
  const near: RoomEmitter[] = [];
  for (const e of emitters) {
    const d = Math.hypot(e.position.x - p.x, e.position.y - p.y, e.position.z - p.z);
    if (d < nearest) nearest = d;
    if (d < ROOM_SOUND_REACH[e.sound].max) near.push(e);
  }
  const room = near.length > 0 ? (interiorAt(p, held, 0.4)?.id ?? null) : null;
  const layers = {} as Record<RoomSound, RoomLayerMix>;
  for (const sound of ROOM_SOUNDS) {
    const { ref, max } = ROOM_SOUND_REACH[sound];
    const mine = near.filter((e) => e.sound === sound);
    if (mine.length === 0) {
      layers[sound] = SILENT;
      continue;
    }
    const inside = emitterMix(pose, mine.filter((e) => e.room === room), ref, max);
    const through = emitterMix(pose, mine.filter((e) => e.room !== room), ref, max);
    const wall = through.gain * THROUGH_WALL.gain;
    layers[sound] = inside.gain >= wall ? { ...inside, cutoff: OPEN } : { gain: wall, pan: through.pan, cutoff: THROUGH_WALL.cutoff };
  }
  return { room, nearest, layers };
};
