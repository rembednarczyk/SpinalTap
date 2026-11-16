import type { Vec3 } from "@seki/core";
import { type CityKitData, type GeometrySink, swatchUv } from "../city-kit-data";

/**
 * Painting W-3's inside on the city kit's texture (ADR-0082 §4): boxes in its swatches, the
 * tinted ones (`paint`) in the colours of picture 04: graphite, olive, orange, red, yellow stripes.
 */

export type Tint = readonly [number, number, number];

const rgb = (hex: string): Tint => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];

/** The tinted paint's colours (multiplied into the kit's `paint` swatch, a light grey). */
export const W3_PAINT = {
  graphite: rgb("#5c616c"),
  wall: rgb("#8a8f99"),
  olive: rgb("#6d7550"),
  floor: rgb("#606a5c"),
  orange: rgb("#e07a2a"),
  red: rgb("#b8322a"),
  yellow: rgb("#f0c020"),
  white: rgb("#ffffff"),
} as const;

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

/** Paints boxes on one sink with the kit's swatches. */
export class KitPainter {
  private readonly uvs = new Map<string, readonly [number, number]>();

  constructor(
    readonly sink: GeometrySink,
    private readonly data: CityKitData,
  ) {}

  uv(swatch: string): readonly [number, number] {
    let uv = this.uvs.get(swatch);
    if (!uv) {
      uv = swatchUv(this.data, swatch);
      this.uvs.set(swatch, uv);
    }
    return uv;
  }

  /** An axis-aligned box over world ranges. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, swatch: string, tint: Tint = W3_PAINT.white): void {
    this.sink.box({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 }, [X, Y, Z], [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], this.uv(swatch), tint);
  }

  /** A beam of square section `thick` from `a` to `b`. */
  beam(a: Vec3, b: Vec3, thick: number, swatch: string, tint: Tint = W3_PAINT.white): void {
    const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const len = Math.hypot(d.x, d.y, d.z) || 1e-4;
    const u = { x: d.x / len, y: d.y / len, z: d.z / len };
    // Across: horizontal and square to the beam (the x axis for a vertical one).
    const h = Math.hypot(u.z, u.x);
    const s = h < 1e-4 ? X : { x: u.z / h, y: 0, z: -u.x / h };
    const w = { x: u.y * s.z - u.z * s.y, y: u.z * s.x - u.x * s.z, z: u.x * s.y - u.y * s.x };
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
    this.sink.box(c, [u, s, w], [len / 2, thick / 2, thick / 2], this.uv(swatch), tint);
  }
}
