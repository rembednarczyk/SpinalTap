import type { Vec3 } from "@seki/core";
import type { AlchemiaBox } from "@seki/sim";
import { type CityKitData, type GeometrySink, swatchUv } from "../city-kit-data";

/**
 * The slabs of Alchemia's storeys with rounded corners (ADR-0074 B4, the board's soft edges): the
 * simulation keeps its boxes, the engine draws a slab as a prism of its outline with each corner a
 * quarter circle, and the strip of light along its edge follows the outline round the corners.
 * Pure data, no Babylon.
 */

/**
 * A corner's radius: at most this (the glass under a slab stands 0.3 m in from its edge, square:
 * a radius over 1 m would cut its corner), and at most a quarter of the slab's shorter side.
 */
const RADIUS = 1.0;
/** Segments of a quarter circle. */
const ARC = 4;
/** The strip of light: this far out of the slab's edge, this high, its foot this far over the slab's bottom. */
const LED_OUT = 0.04;
const LED_HIGH = 0.08;
const LED_FOOT = 0.06;

type P2 = { readonly x: number; readonly z: number };

/** The slab's outline, counter-clockwise seen from above, its corners rounded; `grow` moves it out. */
export const roundedOutline = (b: AlchemiaBox, grow = 0): P2[] => {
  const r = Math.min(RADIUS, (b.x1 - b.x0) / 4, (b.z1 - b.z0) / 4);
  const corners: readonly [number, number, number][] = [
    [b.x1 - r, b.z0 + r, -Math.PI / 2],
    [b.x1 - r, b.z1 - r, 0],
    [b.x0 + r, b.z1 - r, Math.PI / 2],
    [b.x0 + r, b.z0 + r, Math.PI],
  ];
  const out: P2[] = [];
  for (const [cx, cz, a0] of corners) {
    for (let k = 0; k <= ARC; k++) {
      const a = a0 + (Math.PI / 2) * (k / ARC);
      out.push({ x: cx + (r + grow) * Math.cos(a), z: cz + (r + grow) * Math.sin(a) });
    }
  }
  return out;
};

const at = (p: P2, y: number): Vec3 => ({ x: p.x, y, z: p.z });

/** A ring of quads round `pts` from y0 to y1, facing out. */
const band = (sink: GeometrySink, pts: readonly P2[], y0: number, y1: number, uv: readonly [number, number]): void => {
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    if (len < 1e-6) return;
    const n = { x: (q.z - p.z) / len, y: 0, z: -(q.x - p.x) / len };
    sink.quad(at(p, y0), at(q, y0), at(q, y1), at(p, y1), n, uv);
  });
};

/** A fan of the outline at y from its middle, facing `ny` (1 up, -1 down). */
const lid = (sink: GeometrySink, pts: readonly P2[], y: number, ny: number, uv: readonly [number, number]): void => {
  const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length };
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    sink.quad(at(c, y), at(p, y), at(q, y), at(q, y), { x: 0, y: ny, z: 0 }, uv);
  });
};

/** A slab with rounded corners in `swatch`, and the strip of light round it in `led` when given. */
export const roundedSlab = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, swatch: string, led: string | null): void => {
  const pts = roundedOutline(b);
  const uv = swatchUv(data, swatch);
  band(sink, pts, b.y0, b.y1, uv);
  lid(sink, pts, b.y1, 1, uv);
  lid(sink, pts, b.y0, -1, uv);
  if (led) band(sink, roundedOutline(b, LED_OUT), b.y0 + LED_FOOT, b.y0 + LED_FOOT + LED_HIGH, swatchUv(data, led));
};

/** Is `p` a thin piece of a slab's strip of light, the simulation's straight one the rounded slab replaces? */
export const ledOfSlab = (p: AlchemiaBox, slabs: readonly AlchemiaBox[]): boolean =>
  slabs.some((s) => Math.abs(p.y0 - (s.y0 + LED_FOOT)) < 1e-6 && p.x0 >= s.x0 - 0.1 && p.x1 <= s.x1 + 0.1 && p.z0 >= s.z0 - 0.1 && p.z1 <= s.z1 + 0.1);
