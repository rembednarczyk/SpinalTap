import { ATRIUM, GALLERY, MALL_LEVELS, MALL_SLAB } from "./mall-plan";
import { type Piece, box, piece } from "./plan";

/*
 * The gallery's fittings under its slabs over the strips round the atrium on P1 and P2 (the user's
 * rule of 22.11, `docs/zasady-lokacji.md` §13: no light from nowhere): a row of recessed panels down
 * the middle of each strip, one every `PANEL_EVERY` metres, where the renderer's sodium lamps of the
 * strips hang (`alchemia-lights.ts`). Drawn only, flush with the slab's underside, over every head.
 */

/** A panel: its length along the strip, its width across (m). */
const PANEL = { length: 1.2, width: 0.3 } as const;
/** One every this many metres along a strip (m). */
export const PANEL_EVERY = 4;

/** The strips' middles and their spans: west and east along z, south and north along x. */
const STRIPS = [
  { along: "z", at: (GALLERY.x0 + ATRIUM.x0) / 2, from: GALLERY.z0, to: GALLERY.z1 },
  { along: "z", at: (ATRIUM.x1 + GALLERY.x1) / 2, from: GALLERY.z0, to: GALLERY.z1 },
  { along: "x", at: (GALLERY.z0 + ATRIUM.z0) / 2, from: ATRIUM.x0, to: ATRIUM.x1 },
  { along: "x", at: (ATRIUM.z1 + GALLERY.z1) / 2, from: ATRIUM.x0, to: ATRIUM.x1 },
] as const;

/** The ceilings over P1 and P2: the slab's underside of the storey over each. */
const CEILINGS = [MALL_LEVELS.p2 - MALL_SLAB, MALL_LEVELS.p3 - MALL_SLAB] as const;

const panels = (s: (typeof STRIPS)[number], top: number): Piece[] => {
  const n = Math.max(1, Math.round((s.to - s.from) / PANEL_EVERY));
  const step = (s.to - s.from) / n;
  return Array.from({ length: n }, (_, i) => {
    const m = s.from + step * (i + 0.5);
    const [a0, a1] = [m - PANEL.length / 2, m + PANEL.length / 2];
    const [w0, w1] = [s.at - PANEL.width / 2, s.at + PANEL.width / 2];
    const b = s.along === "z" ? box(w0, w1, a0, a1, top - 0.04, top - 0.01) : box(a0, a1, w0, w1, top - 0.04, top - 0.01);
    return piece(b, "ceiling-light", true, false);
  });
};

/** Every panel of the gallery's strips on P1 and P2. */
export const GALLERY_LIGHTS: readonly Piece[] = CEILINGS.flatMap((top) => STRIPS.flatMap((s) => panels(s, top)));
