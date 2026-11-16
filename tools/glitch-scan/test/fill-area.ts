import { triangulate } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { signedArea } from "../../osm-import/src/geometry.ts";
import { type ChunkFills } from "./fill-on-green";

/** The most the triangles of a piece may lay off its area (m²). */
export const FILL_AREA_TOLERANCE = 0.01;

/** The area the renderer's ear clipping lays for a ring (m²). */
export const laidArea = (ring: readonly { readonly x: number; readonly z: number }[]): number => {
  const t = triangulate(ring);
  let laid = 0;
  for (let k = 0; k + 2 < t.length; k += 3) {
    const [a, b, c] = [ring[t[k]!]!, ring[t[k + 1]!]!, ring[t[k + 2]!]!];
    laid += Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
  }
  return laid;
};

/**
 * `fill-area-mismatch` (G-764): a piece the bare ground rule laid whose triangles cover other than
 * its area by more than `FILL_AREA_TOLERANCE`: a ring touching itself, whose ear clipping lays
 * ground over the gap between its lobes. One finding a piece, at its first corner.
 */
export const fillAreaMismatch = (chunks: readonly ChunkFills[]): { readonly at: string; readonly what: string }[] =>
  chunks.flatMap((c) =>
    c.fills.flatMap((f) => {
      const ring = Array.from({ length: f.outline.length >> 1 }, (_, k) => ({ x: f.outline[2 * k]!, z: f.outline[2 * k + 1]! }));
      const [area, laid] = [Math.abs(signedArea(ring)), laidArea(ring)];
      if (Math.abs(laid - area) <= FILL_AREA_TOLERANCE) return [];
      const at = `${ring[0]!.x.toFixed(2)},${ring[0]!.z.toFixed(2)}`;
      return [{ at, what: `${c.id}: ${f.surface} laid ${laid.toFixed(2)} m² for ${area.toFixed(2)}` }];
    }),
  );
