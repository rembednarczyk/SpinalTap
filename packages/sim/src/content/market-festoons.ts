import type { StreetPropItem } from "@seki/core";
import { BAZAR_STALLS, RUSKA_STALLS } from "./district-targ";
import { turnLocal } from "./lublin/furniture";
import { inBuilding } from "./lublin/places";
import { surfacesAt } from "./lublin/roads";
import { type FestoonSpan, PLAC_ZAMKOWY_FESTOONS, festoonAt } from "./plac-zamkowy-festoons";

/*
 * Festoons across the aisles of Podzamcze's night markets (decision of the user 24.11: garlands and strips of light as
 * in the rest of the game; Targ na Ruskiej and the Bazaar by the halls): a cable from a stall's front to the front of
 * the stall facing it across the aisle, between their posts' tops, strung with bulbs or now and then a neon strip.
 * The stalls' own festoons hang over their counters (`rd-targ-festoon`); these cross the aisles between them, as over
 * the aisles of an Asian night market. Drawn only (`festoon-signs.ts`). Pattern: a greedy matching of the stalls' fronts
 * facing each other, the nearest pairs first, each stall in one pair at most; each cable a catenary as the square's.
 */

/** The front's middle in a stall's frame (between its front posts) and how high the cable hangs there: over the canopy's peak, so it reads over the stalls. */
const FRONT = 0.72;
const HANG = 3.05;
const SAG = 0.3;
/** Across an aisle: the fronts this far apart, facing each other within some 45 degrees. */
const AISLE = { min: 2.5, max: 7 } as const;
const FACING = -0.7;

const frontOf = (s: StreetPropItem): { x: number; z: number; fx: number; fz: number } => {
  const d = turnLocal(s.yaw, 0, FRONT);
  const f = turnLocal(s.yaw, 0, 1);
  return { x: s.x + d.x, z: s.z + d.z, fx: f.x, fz: f.z };
};

/** Is the ground under a cable free of buildings and carriageways? */
const clear = (s: FestoonSpan): boolean => {
  for (let t = 0.1; t < 1; t += 0.2) {
    const p = festoonAt(s, t);
    if (inBuilding(p.x, p.z) || surfacesAt(p.x, p.z).includes("road")) return false;
  }
  return true;
};

/** The cables across a market's aisles: from front to facing front, the nearest pairs first, a stall in one at most. */
export const aisleFestoons = (stalls: readonly StreetPropItem[]): FestoonSpan[] => {
  const fronts = stalls.map(frontOf);
  const pairs: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < fronts.length; i++)
    for (let j = i + 1; j < fronts.length; j++) {
      const [a, b] = [fronts[i]!, fronts[j]!];
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d < AISLE.min || d > AISLE.max || a.fx * b.fx + a.fz * b.fz > FACING) continue;
      // Each faces the other: the line between them runs along their fronts' facing.
      if (((b.x - a.x) * a.fx + (b.z - a.z) * a.fz) / d < -FACING) continue;
      pairs.push({ i, j, d });
    }
  pairs.sort((p, q) => p.d - q.d || p.i - q.i || p.j - q.j);
  const used = new Set<number>();
  const out: FestoonSpan[] = [];
  for (const { i, j } of pairs) {
    if (used.has(i) || used.has(j)) continue;
    const [a, b] = [fronts[i]!, fronts[j]!];
    const span: FestoonSpan = {
      a: { x: a.x, y: stalls[i]!.y + HANG, z: a.z },
      b: { x: b.x, y: stalls[j]!.y + HANG, z: b.z },
      sag: SAG,
      style: out.length % 5 === 4 ? "strip" : "bulbs",
    };
    if (!clear(span)) continue;
    used.add(i);
    used.add(j);
    out.push(span);
  }
  return out;
};

export const RUSKA_FESTOONS: readonly FestoonSpan[] = aisleFestoons(RUSKA_STALLS);
export const BAZAR_FESTOONS: readonly FestoonSpan[] = aisleFestoons(BAZAR_STALLS);

/** Every festoon the renderer draws: Plac Zamkowy's from its lamp posts, the night markets' across their aisles. */
export const MARKET_FESTOONS: readonly FestoonSpan[] = [...PLAC_ZAMKOWY_FESTOONS, ...RUSKA_FESTOONS, ...BAZAR_FESTOONS];
