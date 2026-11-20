import type { Vec3 } from "@seki/core";
import { FRONT_VENUE_SIGNS, type VenueSign } from "@seki/sim";
import { type CityKitData, type GeometrySink, swatchUv } from "../city-kit-data";
import { neonText, neonWidth } from "./neon-letters";

/*
 * The names of the front's café, bar and grill (ADR-0093 O5) in neon tubes over their counters, as the
 * gallery's shops' on their fascias (`shop-geometry.ts`): proper names, no text for the player, in the
 * inside mesh (no mesh or draw call of their own). Pure data, no Babylon.
 */

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

/** One sign: its letters as high as its band allows and no wider than its span, centred, read left to right by one facing it. */
const sign = (sink: GeometrySink, data: CityKitData, s: VenueSign): void => {
  const span = s.a1 - s.a0;
  const height = Math.min(s.y1 - s.y0, (span - 0.2) / Math.max(0.1, neonWidth(s.text, 1)));
  const mid = (s.a0 + s.a1) / 2;
  const foot = (s.y0 + s.y1) / 2 - height / 2;
  const uv = swatchUv(data, s.color);
  // Right of a reader facing the sign: along +x for one facing -z (the sign facing +z), and so on.
  const right = s.axis === "x" ? -s.out : s.out;
  for (const k of neonText(s.text, height)) {
    const [a0, a1] = [mid + right * k.x0, mid + right * k.x1].sort((p, q) => p - q) as [number, number];
    const c = (a0 + a1) / 2;
    const half = (a1 - a0) / 2;
    const depth = s.at + s.out * 0.03;
    const at = s.axis === "x" ? { x: c, y: foot + (k.y0 + k.y1) / 2, z: depth } : { x: depth, y: foot + (k.y0 + k.y1) / 2, z: c };
    const halves: [number, number, number] = s.axis === "x" ? [half, (k.y1 - k.y0) / 2, 0.025] : [0.025, (k.y1 - k.y0) / 2, half];
    sink.box(at, [X, Y, Z], halves, uv);
  }
};

/** Every venue's name on the front. */
export const venueSigns = (sink: GeometrySink, data: CityKitData, signs: readonly VenueSign[] = FRONT_VENUE_SIGNS): void => {
  for (const s of signs) sign(sink, data, s);
};
