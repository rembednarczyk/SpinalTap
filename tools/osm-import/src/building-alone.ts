import { type Area } from "./features.ts";
import { type Pt, ringBounds, signedArea } from "./geometry.ts";

/** Below this footprint (m²) a building standing on its own is a pavilion, a kiosk or a shed. */
export const SMALL_ALONE_AREA = 50;
/** Closer than this (m) to another outline, a building is part of a row, not on its own. */
const TOUCH = 1;

const segDist = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
};

const near = (a: readonly Pt[], b: readonly Pt[]): boolean =>
  a.some((p) => b.some((q, i) => segDist(p, q, b[(i + 1) % b.length]!) < TOUCH)) || b.some((p) => a.some((q, i) => segDist(p, q, a[(i + 1) % a.length]!) < TOUCH));

/**
 * The small buildings that stand on their own (G-127): under `SMALL_ALONE_AREA` and no other
 * outline within `TOUCH`. A round pavilion on a square is one; a narrow house in a row is not.
 */
export const smallAlone = (buildings: readonly Area[]): Set<string> => {
  const boxes = buildings.map((b) => ringBounds(b.ring));
  const out = new Set<string>();
  buildings.forEach((b, i) => {
    if (Math.abs(signedArea(b.ring)) >= SMALL_ALONE_AREA) return;
    const box = boxes[i]!;
    const touches = buildings.some((o, j) => {
      if (j === i) return false;
      const ob = boxes[j]!;
      if (ob.minX > box.maxX + TOUCH || ob.maxX < box.minX - TOUCH || ob.minZ > box.maxZ + TOUCH || ob.maxZ < box.minZ - TOUCH) return false;
      return near(b.ring, o.ring);
    });
    if (!touches) out.add(b.id);
  });
  return out;
};
