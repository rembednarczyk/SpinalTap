import type { Vec3 } from "@seki/core";
import { ARCADE_BAYS, ARCADE_FRONT, ARCADE_PIER, arcadePiers } from "@seki/sim";
import { type CityKitData, type GeometrySink, hexRgb, swatchUv } from "../city-kit-data";
import { neonText } from "./neon-letters";

/*
 * The pale house with arcades in the front's axis (C3, the board 1:1 of 19.11) on its faces: the
 * simulation gives its piers, its upper storey and its roof as boxes (`arcade-front.ts`), the
 * engine draws the round arches between the piers, the windows of the upper storey and ALCHEMIA in
 * warm letters over the middle arch, as on the board. Pure data, no Babylon.
 */

/** The house's plaster: the board's pale cream, a tint of the kit's paint. */
export const PLASTER = hexRgb("#e6d6b4");
/** Segments of an arch's half circle. */
const SEGMENTS = 8;

const A = ARCADE_FRONT;
const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** The arches between the piers: their heads up to the ceiling on the front and the back of the piers' depth, their soffits. */
const arches = (sink: GeometrySink, data: CityKitData): void => {
  const uv = swatchUv(data, "paint");
  const piers = arcadePiers();
  const zf = A.minZ;
  const zb = A.minZ + ARCADE_PIER.depth;
  for (let k = 0; k < ARCADE_BAYS; k++) {
    const x0 = piers[k]! + ARCADE_PIER.width;
    const x1 = piers[k + 1]!;
    const r = (x1 - x0) / 2;
    const c = x0 + r;
    const spring = A.ceiling - 0.25 - r;
    for (let i = 0; i < SEGMENTS; i++) {
      const [a0, a1] = [Math.PI - (Math.PI * i) / SEGMENTS, Math.PI - (Math.PI * (i + 1)) / SEGMENTS];
      const [xa, ya] = [c + r * Math.cos(a0), spring + r * Math.sin(a0)];
      const [xb, yb] = [c + r * Math.cos(a1), spring + r * Math.sin(a1)];
      // The head's front and back: from the curve up to the ceiling.
      sink.quad(v(xa, ya, zf), v(xb, yb, zf), v(xb, A.ceiling, zf), v(xa, A.ceiling, zf), { x: 0, y: 0, z: -1 }, uv, PLASTER);
      sink.quad(v(xb, yb, zb), v(xa, ya, zb), v(xa, A.ceiling, zb), v(xb, A.ceiling, zb), { x: 0, y: 0, z: 1 }, uv, PLASTER);
      // The soffit under the curve, across the piers' depth.
      sink.quad(v(xa, ya, zb), v(xb, yb, zb), v(xb, yb, zf), v(xa, ya, zf), { x: (xa + xb) / 2 - c, y: -((ya + yb) / 2 - spring), z: 0 }, uv, PLASTER);
    }
  }
};

/** The upper storey's windows: one over each arch on the front, two on each end; lit warm or dark by a hash, framed. */
const windows = (sink: GeometrySink, data: CityKitData): void => {
  const piers = arcadePiers();
  const y0 = A.ceiling + 1.0;
  const y1 = A.top - 0.3 - 0.75;
  const frame = swatchUv(data, "trim");
  const lit = swatchUv(data, "win-warm");
  const dark = swatchUv(data, "glass-dark");
  const pane = (x: number, z: number, w: number, ax: Vec3, n: Vec3, k: number) => {
    const half = w / 2;
    const at = (s: number, y: number, out: number): Vec3 => v(x + ax.x * s + n.x * out, y, z + ax.z * s + n.z * out);
    // The box's frame right-handed (its third axis along ±n: a box is the same either way).
    const third = { x: -ax.z, y: 0, z: ax.x };
    const axes = [ax, { x: 0, y: 1, z: 0 }, third] as const;
    // The frame a hand proud of the wall, the glass a hand in.
    sink.box(at(0, (y0 + y1) / 2, 0.02), axes, [half + 0.1, (y1 - y0) / 2 + 0.1, 0.04], frame);
    const glass = k % 3 === 1 ? dark : lit;
    sink.quad(at(-half, y0, 0.07), at(half, y0, 0.07), at(half, y1, 0.07), at(-half, y1, 0.07), n, glass);
    // A mullion and a transom: the board's divided windows.
    sink.box(at(0, (y0 + y1) / 2, 0.08), axes, [0.03, (y1 - y0) / 2, 0.02], frame);
    sink.box(at(0, y1 - (y1 - y0) * 0.3, 0.08), axes, [half, 0.03, 0.02], frame);
  };
  for (let k = 0; k < ARCADE_BAYS; k++) {
    const x = (piers[k]! + ARCADE_PIER.width + piers[k + 1]!) / 2;
    pane(x, A.minZ, 1.3, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, k);
  }
  for (const [x, nx] of [
    [A.minX, -1],
    [A.maxX, 1],
  ] as const) {
    for (const [i, z] of [A.minZ + 1.6, A.maxZ - 1.6].entries()) pane(x, z, 1.1, { x: 0, y: 0, z: nx }, { x: nx, y: 0, z: 0 }, i + (nx > 0 ? 1 : 0));
  }
};

/** ALCHEMIA in warm letters over the middle arch, under the windows, a hand proud of the wall. */
const lettering = (sink: GeometrySink, data: CityKitData): void => {
  const uv = swatchUv(data, "win-warm");
  const mid = (A.minX + A.maxX) / 2;
  const height = 0.5;
  const foot = A.ceiling + 0.25;
  for (const s of neonText("ALCHEMIA", height)) {
    // Read from the street (the south) left to right along +x, as the sign's on L3.
    const [xa, xb] = [mid + s.x0, mid + s.x1];
    sink.quad(v(xa, foot + s.y0, A.minZ - 0.04), v(xb, foot + s.y0, A.minZ - 0.04), v(xb, foot + s.y1, A.minZ - 0.04), v(xa, foot + s.y1, A.minZ - 0.04), { x: 0, y: 0, z: -1 }, uv);
  }
};

/** The house's arches, windows and letters (its boxes are drawn with Alchemia's pieces). */
export const arcadeFrontGeometry = (sink: GeometrySink, data: CityKitData): void => {
  arches(sink, data);
  windows(sink, data);
  lettering(sink, data);
};
