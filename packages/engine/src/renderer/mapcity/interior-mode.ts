import type { Mesh } from "../../babylon";
import type { Box2 } from "./polygon";

/**
 * The interior mode of the map city (ADR-0082 §3.8): with the eye inside a closed hall (W-3's) the
 * city's meshes clear of a box round it go off, so the frustum looking down the hall does not
 * draw the streets behind its walls; the yards round it stay, seen through its open doors. Applied
 * after the levels of detail each frame, so leaving the hall puts everything back on the next.
 */

/** Do two boxes overlap? */
export const meets = (a: Box2, b: Box2): boolean => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

/** Something of the city with its box and its meshes. */
export interface Boxed {
  readonly bounds: Box2;
  readonly meshes: readonly (Mesh | null)[];
}

/** Turns off the meshes of every piece clear of `keep`; returns how many pieces went off. */
export const closeOff = (pieces: Iterable<Boxed>, keep: Box2): number => {
  let off = 0;
  for (const p of pieces) {
    if (meets(p.bounds, keep)) continue;
    off++;
    for (const m of p.meshes) m?.setEnabled(false);
  }
  return off;
};
