/**
 * Corrections of the cover where its classes read the photographs wrong and the photographs,
 * looked at flight by flight, show what is there (G-853): a sample of class `from` in `rect` takes
 * class `to`. Applied by `pnpm orto:build` after the classes are read (`build.ts`), so a rebuild
 * keeps them; each one names the flights it was checked on.
 */
import { type Rect } from "../../osm-import/src/geometry.ts";
import { COVER, type CoverClass } from "./classify.ts";
import { type Cover } from "./cover.ts";

export interface CoverFix {
  readonly district: string;
  readonly rect: Rect;
  readonly from: CoverClass;
  readonly to: CoverClass;
  readonly why: string;
}

export const COVER_FIXES: readonly CoverFix[] = [
  {
    district: "krakowskie",
    rect: { minX: 363, maxX: 384, minZ: -91, maxZ: -80 },
    from: COVER.green,
    to: COVER.paving,
    why: "Krakowskie Przedmieście by Brama Krakowska: the green copper roofs north of the deptak, leaning over its setts on 2025-04 (and 2023-09); 2024-06 shows the setts light up to the walls",
  },
];

/** The cover with its district's fixes applied (in place); how many samples changed. */
export const applyFixes = (cover: Cover, fixes: readonly CoverFix[] = COVER_FIXES): number => {
  const h = cover.header;
  let n = 0;
  for (const f of fixes) {
    if (f.district !== h.district) continue;
    const [c0, c1] = [Math.max(0, Math.floor((f.rect.minX - h.x0) / h.step)), Math.min(h.width, Math.ceil((f.rect.maxX - h.x0) / h.step))];
    const [r0, r1] = [Math.max(0, Math.floor((h.z1 - f.rect.maxZ) / h.step)), Math.min(h.height, Math.ceil((h.z1 - f.rect.minZ) / h.step))];
    for (let r = r0; r < r1; r++)
      for (let c = c0; c < c1; c++) {
        const k = r * h.width + c;
        if (cover.cls[k] !== f.from) continue;
        cover.cls[k] = f.to;
        n++;
      }
  }
  return n;
};
