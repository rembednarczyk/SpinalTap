import type { Vec3 } from "@seki/core";
import { PAVILION_TARP } from "@seki/sim";
import { type CityKitData, type GeometrySink, hexRgb, swatchUv } from "../city-kit-data";

/**
 * Ren's tarp over his camp on the pavilion's roof (`docs/lokacje/alchemia-pawilon-dach.md`), in Alchemia's outside mesh
 * (it is seen from the street): a blue polyethylene sheet tied by its four corners (`PAVILION_TARP`, the simulation's),
 * its south edge taut along the sign's board, its free edges and its middle sagging, darker and wet towards its low
 * north-east corner where the night's rain runs off (§15: wet only where the water comes from); both its faces, a steel
 * eyelet and a rope knot at each corner. Drawn only (§7: over a standing head). Pure data, no Babylon.
 */

/** Grid of the sheet: across (west to east) and along (south to north). */
const ACROSS = 6;
const ALONG = 8;
/** The sag of its middle, of its free north edge and of its free west and east edges (m). */
const SAG = { middle: 0.1, north: 0.05, side: 0.06 } as const;
const DRY = hexRgb("#2f62a3");
const WET = hexRgb("#1f416e");
const ROPE = hexRgb("#c9a86a");

type Tint = readonly [number, number, number];
const mix = (a: Tint, b: Tint, t: number): Tint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
const neg = (v: Vec3): Vec3 => ({ x: -v.x, y: -v.y, z: -v.z });

/** The sheet's point at (s across, t along): the corners' bilinear mean, sagging. */
export const tarpPoint = (s: number, t: number): Vec3 => {
  const [sw, se, ne, nw] = PAVILION_TARP;
  const p = lerp(lerp(sw, se, s), lerp(nw, ne, s), t);
  const sag = SAG.middle * 16 * s * (1 - s) * t * (1 - t) + SAG.north * 4 * s * (1 - s) * t * t + SAG.side * 4 * t * (1 - t);
  return { ...p, y: p.y - sag };
};

/** The tarp into Alchemia's outside sink. */
export const pavilionTarp = (sink: GeometrySink, data: CityKitData): void => {
  const paint = swatchUv(data, "paint");
  const [sw, , ne] = PAVILION_TARP;
  const [high, low] = [Math.max(sw.y, ne.y), Math.min(sw.y, ne.y)];
  for (let i = 0; i < ACROSS; i++) {
    for (let k = 0; k < ALONG; k++) {
      const a = tarpPoint(i / ACROSS, k / ALONG);
      const b = tarpPoint((i + 1) / ACROSS, k / ALONG);
      const c = tarpPoint((i + 1) / ACROSS, (k + 1) / ALONG);
      const d = tarpPoint(i / ACROSS, (k + 1) / ALONG);
      const up = unit(cross(sub(d, a), sub(b, a)));
      const n = up.y >= 0 ? up : neg(up);
      // The lower a quad hangs, the wetter: the water runs to the low corner.
      const y = (a.y + b.y + c.y + d.y) / 4;
      const tint = mix(DRY, WET, Math.max(0, Math.min(1, (high - y) / Math.max(0.01, high - low + SAG.middle))));
      sink.quad(a, b, c, d, n, paint, tint);
      sink.quad(a, b, c, d, neg(n), paint, mix(tint, WET, 0.4));
    }
  }
  const metal = swatchUv(data, "metal");
  PAVILION_TARP.forEach((p) => {
    sink.box({ x: p.x, y: p.y - 0.01, z: p.z }, [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }], [0.025, 0.012, 0.025], metal);
    // A knot and its tail hanging from the eyelet.
    sink.box({ x: p.x, y: p.y - 0.09, z: p.z }, [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }], [0.008, 0.07, 0.008], paint, ROPE);
  });
};
