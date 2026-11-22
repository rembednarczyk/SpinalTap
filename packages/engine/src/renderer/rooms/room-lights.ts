import type { Vec3 } from "@seki/core";
import { INTERIORS, W3_Y, clinicPoint, koiPoint } from "@seki/sim";
import type { LightClip, PointLightDef } from "../../npr/lighting";

/**
 * The old town's rooms and Tessen's office lit by their practicals in their interior mode (`docs/zasady-lokacji.md`
 * §13, the 60-30-10 of the cards' shots of 22.11: Neon Koi 97% dark, the office 98%, the clinic 88%). Pattern: lighting
 * by practicals (every light from a source the eye sees: the bar's shelf neon and aquarium, its jukebox and stage, the
 * clinic's surgical lamp and its signs, the office's ceiling fitting and screens) with the room-scoped lamps of W-3 and
 * Alchemia: each clipped to its room's rectangle and storey (the shader's lights pass through walls, G-263), the few
 * nearest the eye on. Pure data.
 */
export interface RoomLamp {
  readonly key: string;
  /** The interior it belongs to (`INTERIORS`). */
  readonly room: string;
  readonly light: PointLightDef & { readonly clip: Required<LightClip> };
}

/** The lamps' keys begin with this: in these rooms only they are on (`ToonMaterials.setLightFocus`). */
export const ROOM_LAMP_PREFIX = "room-lamp-";
/** How many are on at once: the rooms are small, a handful lights one. */
export const ROOM_LAMPS_ON = 4;

/** The interior's room that holds a point, as a lamp's clip. */
const clipOf = (room: string, at: Vec3): Required<LightClip> => {
  const def = INTERIORS.find((i) => i.id === room);
  const r = def?.rooms.find((q) => at.x >= q.minX && at.x <= q.maxX && at.z >= q.minZ && at.z <= q.maxZ) ?? def?.rooms[0];
  if (!r) throw new Error(`no room ${room} at ${at.x},${at.z}`);
  return { minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ, minY: r.bottom - 0.5, maxY: r.top + 0.5 };
};

const lamp = (room: string, name: string, at: Vec3, color: string, range: number, intensity: number): RoomLamp => ({
  key: `${ROOM_LAMP_PREFIX}${room}-${name}`,
  room,
  light: { position: at, color, range, intensity, clip: clipOf(room, at) },
});

/** Neon Koi (`koi()` of `interiors.ts`, old coordinates): the shelf's pink neon and the aquarium over it, the jukebox, the stage's sign. */
const koi = (): RoomLamp[] => [
  lamp("neon-koi", "shelf", koiPoint(16.0, 2.2, -0.5), "#ff5aa8", 9.5, 2.3),
  lamp("neon-koi", "aquarium", koiPoint(16.2, 2.6, 3.0), "#4fd6ff", 6.5, 1.4),
  lamp("neon-koi", "jukebox", koiPoint(15.6, 1.2, 10.0), "#ffb040", 5, 1.3),
  lamp("neon-koi", "stage", koiPoint(11.75, 2.4, 10.2), "#ff2e88", 6.5, 1.6),
];

/** The clinic (`clinic()`, old coordinates): the waiting room's ceiling fittings, the surgical lamp's two heads over the chair, its signs. */
const clinic = (): RoomLamp[] => [
  lamp("clinic", "waiting", clinicPoint(-9.6, 3.6, 4.5), "#e8f4ff", 5.5, 0.42),
  lamp("clinic", "surgery", clinicPoint(-14.6, 2.75, 2.85), "#eafcff", 6, 1.5),
  lamp("clinic", "queue", clinicPoint(-11.6, 2.1, 3.0), "#39ffd0", 3.2, 1.8),
  lamp("clinic", "pulse", clinicPoint(-16.6, 1.9, 4.0), "#39ffd0", 3.5, 0.6),
];

/** Tessen's pass office in W-3's tower: the ceiling's fitting over its middle, the terminal's screens on the desk. */
const office = (): RoomLamp[] => [
  lamp("tessen-office", "ceiling", { x: 2491, y: W3_Y + 3.9, z: 441 }, "#dfe9ff", 11, 1.9),
  lamp("tessen-office", "screens", { x: 2487.4, y: W3_Y + 1.4, z: 441 }, "#45e8ff", 6, 1.8),
];

export const ROOM_LAMPS: readonly RoomLamp[] = [...koi(), ...clinic(), ...office()];

/** The rooms lit so. */
export const LIT_ROOMS: ReadonlySet<string> = new Set(ROOM_LAMPS.map((l) => l.room));

/**
 * Rooms under the room's dim rig with the lamps they already have, the props' and their own views' (the Trasa
 * Podziemna's museum lamps and LEDs on cables, the capsule's ceiling fitting): the street's moon and violet ambient
 * no longer flatten them (§13), and their lamps keep their slots as before.
 */
export const DIM_ROOMS: ReadonlySet<string> = new Set(["trasa-podziemna", "capsule"]);

/** The lamps on for an eye in `room`: its own, the nearest first, at most `n`. */
export const roomLampsFor = (room: string, eye: Vec3, n = ROOM_LAMPS_ON): readonly RoomLamp[] =>
  ROOM_LAMPS.filter((l) => l.room === room)
    .map((l, i) => ({ l, i, d: Math.hypot(eye.x - l.light.position.x, eye.y - l.light.position.y, eye.z - l.light.position.z) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, n)
    .map((e) => e.l);
