import type { Vec3 } from "@seki/core";
import { W3_ASSEMBLY, W3_CHAMBER, W3_LAYOUT, W3_ROW_N, W3_Y } from "@seki/sim";
import type { PointLightDef } from "../../npr/lighting";
import { W3_SERVER_ROOMS } from "./w3-inside-geometry";

/**
 * W-3's lamps (ADR-0082 §4: no moon inside, the lamps and the strips' glow). The toon shader's
 * lights pass through walls (G-263), so each is clipped to its room's ground rectangle, and only
 * the nearest to the eye are on at a time: the hall's fluorescent light, the chamber's, the server
 * rooms' teal glow, the basement's. The hall keeps the 60-30-10 rule of light (`docs/zasady-lokacji.md`
 * §13): four lamps under its strips for the motivated light, the stations' screens and the chamber
 * gate's red lights for the accents, each lamp by the fitting it comes from. Pure data.
 */

export interface W3Lamp {
  readonly key: string;
  readonly light: PointLightDef;
  /** The floor and the ceiling of the room it lights (world y). */
  readonly bottom: number;
  readonly top: number;
}

/** The lamps' keys begin with this: in the hall only they are on (`ToonMaterials.setLightFocus`). */
export const W3_LAMP_PREFIX = "w3-lamp-";
/** How many lamps are on at once: the hall's seven (of the shader's eight slots, the flashlight apart). */
export const W3_LAMPS_ON = 7;
/** How many while the eye is outside, seeing the hall through its gates. */
export const W3_LAMPS_OUT = 2;

type Rect = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

const lamp = (name: string, color: string, at: Vec3, range: number, intensity: number, clip: Rect, bottom: number, top: number): W3Lamp => ({
  key: `${W3_LAMP_PREFIX}${name}`,
  light: { color, range, intensity, position: { x: at.x, y: W3_Y + at.y, z: at.z }, clip },
  bottom: W3_Y + bottom,
  top: W3_Y + top,
});

const hall: Rect = { minX: W3_ASSEMBLY.minX - 10, maxX: W3_ASSEMBLY.maxX, minZ: W3_ASSEMBLY.minZ, maxZ: W3_ASSEMBLY.maxZ };
const [serverS, serverN] = W3_SERVER_ROOMS as [Rect, Rect];
const B = W3_LAYOUT.BASEMENT;

export const W3_LAMPS: readonly W3Lamp[] = [
  // Under the strips' second and fourth rows (`w3-inside-geometry.ts`, 14.1 m up), over the aisle's edges.
  lamp("hall-sw", "#dfe9ff", { x: 2519, y: 13.6, z: 413.2 }, 22, 1.0, hall, 0, 16),
  lamp("hall-nw", "#dfe9ff", { x: 2519, y: 13.6, z: 422.8 }, 22, 1.0, hall, 0, 16),
  lamp("hall-se", "#dfe9ff", { x: 2537, y: 13.6, z: 413.2 }, 22, 1.0, hall, 0, 16),
  lamp("hall-ne", "#dfe9ff", { x: 2537, y: 13.6, z: 422.8 }, 22, 1.0, hall, 0, 16),
  // The teal of stations S1 and S3's screens (`STATIONS`, the line's mesh) on their desks and the aisle's floor.
  lamp("screen-s1", "#45e8ff", { x: 2519, y: 1.35, z: 413.3 }, 5.5, 2.6, hall, 0, 4),
  lamp("screen-s3", "#45e8ff", { x: 2519, y: 1.35, z: 422.7 }, 5.5, 2.6, hall, 0, 4),
  // The red lights over the chamber's gate from the hall (`warnings`), on the gate and the floor before it.
  lamp("gate", "#ff3a2e", { x: 2547.2, y: 6.4, z: 418 }, 11, 3.0, hall, 0, 16),
  lamp("chamber", "#cfdcff", { x: 2560, y: 9, z: 418 }, 16, 1.5, W3_CHAMBER, 0, 13.4),
  lamp("server-n", "#45e8ff", { x: 2566, y: 4.6, z: 436 }, 9, 1.1, serverN, 0, 10),
  lamp("server-s", "#45e8ff", { x: 2565, y: 4.6, z: 400 }, 9, 1.1, serverS, 0, 5),
  lamp("armoury-s", "#ffd9a8", { x: 2552, y: 4.6, z: 400 }, 9, 1.0, { minX: 2546, maxX: serverS.minX, minZ: 396, maxZ: 404 }, 0, 5),
  lamp("row-n", "#e8eef8", { x: 2530, y: 4.6, z: 435 }, 22, 0.9, { minX: W3_ROW_N.minX, maxX: serverN.minX, minZ: W3_ROW_N.minZ, maxZ: W3_ROW_N.maxZ }, 0, 5),
  lamp("row-s", "#e8eef8", { x: 2526, y: 4.6, z: 401 }, 24, 0.9, { minX: 2500, maxX: 2546, minZ: 396, maxZ: 406 }, 0, 5),
  lamp("basement", "#d4dcea", { x: 2530, y: -0.8, z: 402 }, 20, 0.9, { minX: B.minX - 6, maxX: B.maxX, minZ: B.minZ, maxZ: B.maxZ }, -4.5, -0.4),
];

/** Distance from the eye to a lamp's room: across its rectangle and up or down to its floors. */
const toRoom = (l: W3Lamp, eye: Vec3): number => {
  const c = l.light.clip as Rect;
  const dx = Math.max(c.minX - eye.x, 0, eye.x - c.maxX);
  const dz = Math.max(c.minZ - eye.z, 0, eye.z - c.maxZ);
  const dy = Math.max(l.bottom - eye.y, 0, eye.y - l.top);
  return Math.hypot(dx, dy, dz);
};

/** The lamps on for an eye: the `n` whose rooms are nearest, the list's order between equals. */
export const w3LampsFor = (eye: Vec3, n = W3_LAMPS_ON): readonly W3Lamp[] =>
  W3_LAMPS.map((l, i) => ({ l, i, d: toRoom(l, eye) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, n)
    .map((e) => e.l);
