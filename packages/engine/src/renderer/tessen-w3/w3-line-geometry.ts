import { W3_CRANE_BRIDGE, W3_LAYOUT, W3_Y } from "@seki/sim";
import { type CityKitData, GeometrySink } from "../city-kit-data";
import { KitPainter, W3_PAINT } from "./w3-kit";
import type { ArmPose, LinePose } from "./w3-line-anim";

/**
 * The line's moving parts as one mesh (ADR-0082 §4: "ruch linii", one draw call): the arms on
 * their bases, the bodies on the belts, the crane's bridge with its trolley and hook, the arms'
 * beacons. Every pose has the same boxes in the same order, so a frame only moves vertices and
 * swaps a beacon's swatch (`W3LineMesh`). Pure data, no Babylon.
 */

/** The upper arm's and the forearm's lengths, their section. */
const UPPER = 1.7;
const FORE = 1.5;
const LIMB = 0.32;

/** Boxes per arm, per body, of the bridge: the topology the mesh keeps (tests). */
export const LINE_BOXES = { arm: 6, body: 6, bridge: 4 } as const;

const arm = (k: KitPainter, a: ArmPose): void => {
  const top = W3_Y + W3_LAYOUT.ARM_BASE.height;
  const s = W3_LAYOUT.ARM_BASE.size / 2;
  // The turret on the base, the shoulder over it.
  k.box(a.x - 0.5, a.x + 0.5, top, top + 0.45, a.z - 0.5, a.z + 0.5, "paint", W3_PAINT.orange);
  const facing = (a.side === 1 ? 0 : Math.PI) + a.yaw;
  const f = { x: Math.sin(facing), z: Math.cos(facing) };
  const shoulder = { x: a.x, y: top + 0.7, z: a.z };
  const dir = (angle: number, len: number) => ({ x: f.x * Math.cos(angle) * len, y: Math.sin(angle) * len, z: f.z * Math.cos(angle) * len });
  const u = dir(a.shoulder, UPPER);
  const elbow = { x: shoulder.x + u.x, y: shoulder.y + u.y, z: shoulder.z + u.z };
  const w = dir(a.shoulder - a.elbow, FORE);
  const wrist = { x: elbow.x + w.x, y: elbow.y + w.y, z: elbow.z + w.z };
  k.beam({ x: a.x, y: top + 0.45, z: a.z }, shoulder, 0.5, "dark");
  k.beam(shoulder, elbow, LIMB, "paint", W3_PAINT.orange);
  k.beam(elbow, wrist, LIMB * 0.8, "paint", W3_PAINT.orange);
  const tip = { x: wrist.x + w.x * 0.15, y: wrist.y + w.y * 0.15 - 0.2, z: wrist.z + w.z * 0.15 };
  k.beam(wrist, tip, 0.18, "metal");
  // The beacon on the base's corner away from the aisle.
  const bx = a.x + s - 0.15;
  const bz = a.z - a.side * (s - 0.15);
  k.box(bx - 0.1, bx + 0.1, top, top + 0.22, bz - 0.1, bz + 0.1, a.beacon ? "neon-amber" : "trim");
};

const body = (k: KitPainter, b: { x: number; z: number }): void => {
  const y = W3_Y + W3_LAYOUT.BELT_H;
  k.box(b.x - 0.45, b.x + 0.45, y, y + 0.28, b.z - 0.45, b.z + 0.45, "paint", W3_PAINT.olive);
  for (const [dx, dz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    k.beam({ x: b.x + dx * 0.4, y: y + 0.2, z: b.z + dz * 0.4 }, { x: b.x + dx * 0.75, y: y + 0.22, z: b.z + dz * 0.75 }, 0.08, "metal");
  }
  k.box(b.x + 0.45, b.x + 0.5, y + 0.1, y + 0.18, b.z - 0.1, b.z + 0.1, "neon-red");
};

const bridge = (k: KitPainter, x: number): void => {
  const c = W3_CRANE_BRIDGE;
  const w = c.width / 2;
  k.box(x - w, x + w, W3_Y + c.bottom, W3_Y + c.top, c.minZ, c.maxZ, "paint", W3_PAINT.yellow);
  // The trolley over the aisle, its cable and hook block.
  const z = (W3_LAYOUT.AISLE.minZ + W3_LAYOUT.AISLE.maxZ) / 2;
  k.box(x - 0.9, x + 0.9, W3_Y + c.bottom - 0.7, W3_Y + c.bottom, z - 0.8, z + 0.8, "dark");
  k.box(x - 0.04, x + 0.04, W3_Y + c.bottom - 4.2, W3_Y + c.bottom - 0.7, z - 0.04, z + 0.04, "cable");
  k.box(x - 0.25, x + 0.25, W3_Y + c.bottom - 4.7, W3_Y + c.bottom - 4.2, z - 0.25, z + 0.25, "paint", W3_PAINT.yellow);
};

/** The line's moving parts in a pose, on the kit's texture. */
export const lineGeometry = (data: CityKitData, pose: LinePose): GeometrySink => {
  const k = new KitPainter(new GeometrySink(), data);
  for (const a of pose.arms) arm(k, a);
  for (const b of pose.bodies) body(k, b);
  bridge(k, pose.bridgeX);
  return k.sink;
};
