import { type Piece, box, outlined, piece } from "./plan";
import { ALL_CORNERS, type Corners, type Rectangle, cornerRadius, roundedOutline } from "./rounded";

/*
 * A storey of Alchemia's front (ADR-0074 B1, C1): glass up to a slab with its overhang and a strip
 * of light along its edge, the outer corners rounded. The green tiers A and B that first used it
 * (15.11) gave way to the gallery round its atrium (ADR-0093 O1, `mall.ts`); the front keeps it.
 */

/** A slab's thickness at a storey's top, its overhang past the glass. */
export const SLAB = 0.3;
export const OVER = 0.3;

export type Area = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

/** A storey's slab: its glass's outline grown by the overhang. */
export const slabOf = (r: Area): Rectangle => ({ x0: r.minX - OVER, x1: r.maxX + OVER, z0: r.minZ - OVER, z1: r.maxZ + OVER });

/** The light along a slab's edge: four thin strips just outside it, under its top. */
const ledRing = (r: Area, y: number, over: number): Piece[] => {
  const [x0, x1, z0, z1] = [r.minX - over - 0.04, r.maxX + over + 0.04, r.minZ - over - 0.04, r.maxZ + over + 0.04];
  const [y0, y1] = [y + 0.06, y + 0.14];
  return [
    piece(box(x0, x1, z0, z0 + 0.04, y0, y1), "led", false, false),
    piece(box(x0, x1, z1 - 0.04, z1, y0, y1), "led", false, false),
    piece(box(x0, x0 + 0.04, z0, z1, y0, y1), "led", false, false),
    piece(box(x1 - 0.04, x1, z0, z1, y0, y1), "led", false, false),
  ];
};

/**
 * A slab over glass: the glass up to it, the slab with its overhang, a strip of light along its
 * edge; its `corners` rounded (19.11), the glass's concentric with the slab's.
 */
export const storey = (r: Area, bottom: number, top: number, corners: Corners = ALL_CORNERS, radius = cornerRadius(slabOf(r))): Piece[] => {
  const s = top - SLAB;
  const slab = slabOf(r);
  return [
    outlined(roundedOutline(slab, -OVER, corners, undefined, radius), bottom - 0.05, s, "glass"),
    outlined(roundedOutline(slab, 0, corners, undefined, radius), s, top, "roof"),
    ...ledRing(r, s, OVER),
  ];
};
