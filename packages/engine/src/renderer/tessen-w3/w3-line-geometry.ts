import type { LineScreens, W3StationId } from "@seki/core";
import { W3_CRANE_BRIDGE, W3_LAYOUT, W3_VIRUS_TERMINAL, W3_Y } from "@seki/sim";

import { type CityKitData, GeometrySink } from "../city-kit-data";
import { KitPainter, type Tint, W3_PAINT } from "./w3-kit";
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
export const LINE_BOXES = { arm: 6, body: 6, bridge: 4, screens: 10 } as const;

const arm = (k: KitPainter, a: ArmPose, alarm: boolean): void => {
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
  k.box(bx - 0.1, bx + 0.1, top, top + 0.22, bz - 0.1, bz + 0.1, a.beacon ? (alarm ? "neon-red" : "neon-amber") : "trim");
};

/**
 * What a screen shows by the job (ADR-0082 stage 3): the line's teal read-out; during the upload
 * the calibration rewritten, amber over teal; with the virus in, violet over red. The blink's off
 * phase is the second swatch.
 */
const SCREEN_SWATCH: Readonly<Record<LineScreens, readonly [string, string]>> = {
  idle: ["win-teal", "win-teal"],
  upload: ["neon-amber", "win-teal"],
  infected: ["neon-violet", "neon-red"],
};

/**
 * The stations' screens on their desks towards the aisle and the calibration core's screen on its
 * desk in server room N, towards the door: a dark back and the lit face each, ten boxes.
 */
const screens = (k: KitPainter, pose: LinePose): void => {
  const pair = SCREEN_SWATCH[pose.screens];
  const face = pose.screenBlink ? pair[0] : pair[1];
  for (const [id, s] of Object.entries(W3_LAYOUT.STATIONS) as [W3StationId, { x: number; z: number }][]) {
    const toAisle = s.z < 418 ? 1 : -1;
    const z = s.z + toAisle * 0.1;
    if (pose.wrecks.includes(id)) {
      // Blown off its stand: face down on the desk, out (the same two boxes).
      k.box(s.x - 0.42, s.x + 0.28, W3_Y + 1.1, W3_Y + 1.18, z - 0.3, z + 0.15, "dark");
      k.box(s.x - 0.37, s.x + 0.23, W3_Y + 1.1, W3_Y + 1.105, z - 0.25, z + 0.1, "dark");
      continue;
    }
    k.box(s.x - 0.35, s.x + 0.35, W3_Y + 1.1, W3_Y + 1.55, z - 0.04, z + 0.04, "dark");
    k.box(s.x - 0.3, s.x + 0.3, W3_Y + 1.15, W3_Y + 1.5, z + toAisle * 0.045 - 0.005, z + toAisle * 0.045 + 0.005, face);
  }
  const c = W3_VIRUS_TERMINAL;
  k.box(c.x - 0.45, c.x + 0.45, W3_Y + 1.2, W3_Y + 1.8, 437.92, 438.0, "dark");
  k.box(c.x - 0.4, c.x + 0.4, W3_Y + 1.25, W3_Y + 1.75, 437.905, 437.915, face);
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

/** Soot over burnt metal and the floor round a blown station. */
const SOOT: Tint = [0.16, 0.145, 0.14];
const BURNT: Tint = [0.32, 0.27, 0.24];

/** Boxes of one wreck (tests: the topology grows by this many a blown station). */
export const WRECK_BOXES = 13;

/** Scattered pieces round a wreck: offset along the belt and towards the aisle (m), their size. */
const PIECES: readonly (readonly [number, number, number])[] = [
  [-1.3, 0.6, 0.22],
  [-0.7, 1.4, 0.14],
  [0.4, 1.8, 0.18],
  [1.1, 0.9, 0.26],
  [1.6, 1.5, 0.12],
  [-1.7, 1.7, 0.16],
];

/**
 * A station blown for good (ADR-0082 stage 3c): its desk charred over, the floor sooted towards the
 * aisle, two strips of its top torn up, its side panel on the floor, pieces round it, two embers
 * still glowing. Drawn from the stations' flags, so a load shows it as the blast left it.
 */
const wreck = (k: KitPainter, id: W3StationId): void => {
  const s = W3_LAYOUT.STATIONS[id];
  const toAisle = s.z < 418 ? 1 : -1;
  const edge = toAisle === 1 ? W3_LAYOUT.BELT_L1.maxZ : W3_LAYOUT.BELT_L2.minZ;
  const mid = edge + toAisle * 0.25;
  const y = W3_Y;
  const across = (a: number, b: number): [number, number] => [Math.min(edge + toAisle * a, edge + toAisle * b), Math.max(edge + toAisle * a, edge + toAisle * b)];
  const [f0, f1] = across(0.02, 2.4);
  k.box(s.x - 1.9, s.x + 1.9, y + 0.01, y + 0.02, f0, f1, "paint", SOOT);
  const [d0, d1] = across(-0.02, 0.52);
  k.box(s.x - 0.62, s.x + 0.62, y, y + 1.12, d0, d1, "paint", SOOT);
  k.beam({ x: s.x - 0.5, y: y + 1.1, z: mid }, { x: s.x + 0.2, y: y + 1.75, z: mid + toAisle * 0.45 }, 0.07, "paint", BURNT);
  k.beam({ x: s.x + 0.45, y: y + 1.1, z: mid - toAisle * 0.1 }, { x: s.x + 0.75, y: y + 1.5, z: mid + toAisle * 0.6 }, 0.05, "paint", BURNT);
  const [p0, p1] = across(0.7, 1.5);
  k.box(s.x + 0.8, s.x + 1.7, y + 0.02, y + 0.07, p0, p1, "paint", BURNT);
  for (const [dx, dz, size] of PIECES) {
    const z = edge + toAisle * dz;
    k.box(s.x + dx - size / 2, s.x + dx + size / 2, y + 0.02, y + 0.02 + size * 0.6, z - size / 2, z + size / 2, "paint", size > 0.17 ? BURNT : SOOT);
  }
  k.box(s.x - 0.2, s.x - 0.12, y + 1.12, y + 1.16, mid - 0.04, mid + 0.04, "neon-amber");
  k.box(s.x + 0.25, s.x + 0.31, y + 1.12, y + 1.15, mid + 0.05, mid + 0.11, "neon-red");
};

/** The line's moving parts in a pose, on the kit's texture; the wrecks after them (their own topology). */
export const lineGeometry = (data: CityKitData, pose: LinePose): GeometrySink => {
  const k = new KitPainter(new GeometrySink(), data);
  for (const a of pose.arms) arm(k, a, pose.alarm);
  for (const b of pose.bodies) body(k, b);
  bridge(k, pose.bridgeX);
  screens(k, pose);
  for (const w of pose.wrecks) wreck(k, w);
  return k.sink;
};
