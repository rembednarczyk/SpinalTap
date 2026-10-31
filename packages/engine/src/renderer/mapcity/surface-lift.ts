import type { GroundSurface } from "@seki/core";
import { SURFACE_LIFT } from "./ground-plan";
import { type P2, pointInRing } from "./polygon";

/** What `surfaceLiftAt` needs of a ground piece: its surface, outline, and whether it lies on a bridge's deck. */
export interface LiftGround {
  readonly surface: GroundSurface;
  readonly ring: readonly P2[];
  readonly deck?: unknown;
}

/**
 * How far the picture lifts feet at (x, y, z) above the terrain (ADR-0045): a character the
 * simulation keeps on the terrain stands on the surface drawn there (a sidewalk 16 cm up, a
 * square 8 cm), a bridge's deck included (ADR-0053). Feet under a bridge stand on the way there,
 * not on the deck over them (G-062). Feet off the ground (stairs, decks, floors) are left alone.
 */
export const surfaceLiftAt = (x: number, y: number, z: number, deck: number | null, terrain: () => number | null, grounds: Iterable<LiftGround | undefined>): number => {
  const onDeck = deck !== null && Math.abs(y - deck) <= 0.3;
  const ground = onDeck ? deck : terrain();
  if (ground === null || Math.abs(y - ground) > 0.3) return 0;
  let lift = 0;
  for (const g of grounds) if (g && (onDeck || !g.deck) && SURFACE_LIFT[g.surface] > lift && pointInRing({ x, z }, g.ring)) lift = SURFACE_LIFT[g.surface];
  return lift;
};
