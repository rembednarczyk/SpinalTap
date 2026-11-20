import type { Vec3 } from "@seki/core";
import { type AlchemiaPiece, GREEN_SLOPE } from "@seki/sim";
import { type CityKitData, type GeometrySink, swatchUv } from "../city-kit-data";
import { LAWN } from "./storey-facade";

/*
 * The board's green slope down from the west wing's roof to the street (C2, 19.11): the
 * simulation keeps three green steps (solids), the engine draws them as one even slope of lawn
 * with a line of light along its profile on both sides and along its foot. Pure data, no Babylon.
 */

const S = GREEN_SLOPE;
/** The ground under the slope, as the wing's glass stands in it (`front.ts`). */
const FOOT = -3;
const LED_HIGH = 0.12;

/** Is a piece one of the steps the slope draws instead (their green, their lawns, their light)? */
export const ofGreenSlope = (p: AlchemiaPiece): boolean => {
  const b = p.box;
  return (p.kind === "green" || p.kind === "lawn" || p.kind === "led") && b.x0 >= S.x0 - 0.05 && b.x1 <= S.x1 + 0.05 && b.z0 >= S.z0 - 0.05 && b.z1 <= S.z1 + 0.05 && b.y1 <= S.top + 0.01;
};

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** The slope: its lawn, its sides and foot in green, the light along its profile and foot. */
export const greenSlope = (sink: GeometrySink, data: CityKitData): void => {
  const lawn = swatchUv(data, "paint");
  const led = swatchUv(data, "neon-cyan");
  const run = S.x1 - S.x0;
  const rise = S.top - S.foot;
  const len = Math.hypot(run, rise);
  // The lawn's normal: up and out to the west.
  const n = { x: -rise / len, y: run / len, z: 0 };
  // Corners wound as `band`'s: the face's normal is -(e1 × e2) of its first corner's two edges.
  sink.quad(v(S.x0, S.foot, S.z1), v(S.x0, S.foot, S.z0), v(S.x1, S.top, S.z0), v(S.x1, S.top, S.z1), n, lawn, LAWN);
  // Its sides down to the ground, and its foot.
  sink.quad(v(S.x1, FOOT, S.z0), v(S.x1, S.top, S.z0), v(S.x0, S.foot, S.z0), v(S.x0, FOOT, S.z0), { x: 0, y: 0, z: -1 }, lawn, LAWN);
  sink.quad(v(S.x0, FOOT, S.z1), v(S.x0, S.foot, S.z1), v(S.x1, S.top, S.z1), v(S.x1, FOOT, S.z1), { x: 0, y: 0, z: 1 }, lawn, LAWN);
  sink.quad(v(S.x0, FOOT, S.z0), v(S.x0, S.foot, S.z0), v(S.x0, S.foot, S.z1), v(S.x0, FOOT, S.z1), { x: -1, y: 0, z: 0 }, lawn, LAWN);
  // The light: a strip just under the lawn's edge on each side, along the slope, and along the foot.
  for (const [z, nz] of [
    [S.z0 - 0.02, -1],
    [S.z1 + 0.02, 1],
  ] as const) {
    const [a, b] = nz < 0 ? [S.x1, S.x0] : [S.x0, S.x1];
    const ya = a === S.x0 ? S.foot : S.top;
    const yb = b === S.x0 ? S.foot : S.top;
    sink.quad(v(a, ya - 0.06 - LED_HIGH, z), v(a, ya - 0.06, z), v(b, yb - 0.06, z), v(b, yb - 0.06 - LED_HIGH, z), { x: 0, y: 0, z: nz }, led);
  }
  sink.quad(v(S.x0 - 0.02, S.foot - 0.06 - LED_HIGH, S.z0), v(S.x0 - 0.02, S.foot - 0.06, S.z0), v(S.x0 - 0.02, S.foot - 0.06, S.z1), v(S.x0 - 0.02, S.foot - 0.06 - LED_HIGH, S.z1), { x: -1, y: 0, z: 0 }, led);
};
