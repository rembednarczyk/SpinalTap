import type { AlchemiaBox } from "@seki/sim";

/**
 * The strips of light along Alchemia's storeys' slabs: the simulation keeps straight ones, the
 * engine draws its own along the slabs' rounded outlines (B4; `storey-facade.ts`) and drops these.
 */

/** The simulation's strip's foot over its slab's bottom. */
const LED_FOOT = 0.06;

/** Is `p` a thin piece of a slab's strip of light, the simulation's straight one the rounded slab replaces? */
export const ledOfSlab = (p: AlchemiaBox, slabs: readonly AlchemiaBox[]): boolean =>
  slabs.some((s) => Math.abs(p.y0 - (s.y0 + LED_FOOT)) < 1e-6 && p.x0 >= s.x0 - 0.1 && p.x1 <= s.x1 + 0.1 && p.z0 >= s.z0 - 0.1 && p.z1 <= s.z1 + 0.1);
