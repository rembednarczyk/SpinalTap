import type { Vec3 } from "@seki/core";
import { W3_CHAMBER, W3_CHAMBER_TOP, W3_HALL_TOP, W3_Y } from "@seki/sim";
import { type KitPainter, type Tint, W3_PAINT } from "./w3-kit";

/**
 * Tessen's combat drones standing as props (ADR-0082 stage 4, pictures 01 and 02): no AI, no
 * solid, baked in the hall's meshes. Three on landing frames on the halls' roofs (the outer mesh,
 * seen from the river over the parapets), two finished in the test chamber's corners and one
 * tethered over its launch pad (the inside mesh). Pure data.
 */

/** A drone's span across its rotors and its height (m). */
export const W3_DRONE = { span: 2.4, height: 0.75 } as const;
/** Boxes of one drone (tests: the bake's size). */
export const W3_DRONE_BOXES = 19;

export interface W3DroneSpot {
  /** Its feet's middle (world). */
  readonly at: Vec3;
  /** Its nose's heading about the vertical (rad, 0 north). */
  readonly yaw: number;
}

/** The landing frames on the roofs: deck 3 m square this high over the roof, over the 1.2 m parapet. */
export const W3_PAD = { size: 3, height: 1.3 } as const;

/** Where the frames stand: two on the assembly hall's roof, one on the test chamber's by its east edge. */
export const W3_ROOF_PADS: readonly Vec3[] = [
  { x: 2521, y: W3_Y + W3_HALL_TOP, z: 411 },
  { x: 2537, y: W3_Y + W3_HALL_TOP, z: 425 },
  { x: 2566, y: W3_Y + W3_CHAMBER_TOP, z: 425 },
];

/** The chamber's floor drones in its east corners, clear of the gates (z 414..422) and the pad; the tethered one over the pad. */
export const W3_CHAMBER_DRONES: readonly W3DroneSpot[] = [
  { at: { x: W3_CHAMBER.maxX - 3.2, y: W3_Y, z: W3_CHAMBER.minZ + 3.2 }, yaw: -2.4 },
  { at: { x: W3_CHAMBER.maxX - 3.2, y: W3_Y, z: W3_CHAMBER.maxZ - 3.2 }, yaw: -0.8 },
];
/** The test drone over the launch pad (2553..2567, 411..425), held by four tethers. */
export const W3_TEST_DRONE: W3DroneSpot = { at: { x: 2560, y: W3_Y + 2.4, z: 418 }, yaw: -Math.PI / 2 };

/** A combat drone: an olive hull with its sensor head, four arms to guarded rotors, legs, lights. */
export const paintDrone = (k: KitPainter, d: W3DroneSpot): void => {
  const c = Math.cos(d.yaw);
  const s = Math.sin(d.yaw);
  // Local (right, up, forward) to world: forward is the heading.
  const w = (x: number, y: number, z: number): Vec3 => ({ x: d.at.x + x * c + z * s, y: d.at.y + y, z: d.at.z - x * s + z * c });
  const part = (x: number, y: number, z: number, hx: number, hy: number, hz: number, swatch: string, tint?: Tint): void => k.turned(w(x, y, z), d.yaw, hx, hy, hz, swatch, tint);
  const r = W3_DRONE.span / 2 - 0.35;
  // The hull and its armour plate, the sensor head on the nose with its red eye, the weapon pod under it.
  part(0, 0.5, 0, 0.45, 0.2, 0.6, "paint", W3_PAINT.olive);
  part(0, 0.74, -0.05, 0.3, 0.04, 0.35, "paint", W3_PAINT.graphite);
  part(0, 0.46, 0.72, 0.18, 0.14, 0.13, "dark");
  part(0, 0.46, 0.86, 0.06, 0.04, 0.01, "neon-red");
  part(0, 0.24, 0.45, 0.12, 0.06, 0.35, "dark");
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    // The arm out to its rotor, the rotor's guard, the leg under the arm.
    k.beam(w(sx * 0.35, 0.55, sz * 0.4), w(sx * r, 0.62, sz * r), 0.12, "paint", W3_PAINT.graphite);
    part(sx * r, 0.66, sz * r, 0.32, 0.04, 0.32, "trim");
    k.beam(w(sx * 0.42, 0.35, sz * 0.45), w(sx * 0.62, 0, sz * 0.7), 0.07, "metal");
  }
  // Navigation lights: red to port, green to starboard.
  part(-r, 0.73, 0, 0.05, 0.03, 0.05, "neon-red");
  part(r, 0.73, 0, 0.05, 0.03, 0.05, "neon-green");
};

/** A landing frame on a roof: four legs, the deck, its yellow edge, the drone on it. */
export const paintPad = (k: KitPainter, at: Vec3, yaw: number): void => {
  const h = W3_PAD.size / 2;
  const top = at.y + W3_PAD.height;
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    k.box(at.x + sx * (h - 0.3) - 0.1, at.x + sx * (h - 0.3) + 0.1, at.y, top - 0.15, at.z + sz * (h - 0.3) - 0.1, at.z + sz * (h - 0.3) + 0.1, "metal");
  }
  k.box(at.x - h, at.x + h, top - 0.15, top, at.z - h, at.z + h, "paint", W3_PAINT.graphite);
  k.box(at.x - h - 0.02, at.x + h + 0.02, top - 0.12, top - 0.03, at.z - h - 0.02, at.z + h + 0.02, "paint", W3_PAINT.yellow);
  paintDrone(k, { at: { x: at.x, y: top, z: at.z }, yaw });
};
