import type { FrontFloor } from "./front-levels";
import type { Rectangle } from "./rounded";

/*
 * What a unit of Alchemia's gallery (ADR-0093 O2) and of its front (O5) is, as plain data: the
 * plans of both (`shops-plan.ts`, `front-shops.ts`) are lists of these.
 */

/** What a shop sells: its fittings, its light and its sign's colour in the engine. */
export type ShopTrade = "implants" | "electronics" | "clothing" | "pharmacy" | "arms" | "repair" | "pawn" | "tattoo" | "synth-food" | "vr" | "crypto" | "florist";

/**
 * Open, its shutter down (`shut`: a rolling shutter, or bars over its glass with `grille`), or
 * `vacant`: to let, its glass papered over, cartons on its floor.
 */
export type ShopState = "open" | "shut" | "grille" | "vacant";

/** Which side of its rectangle is its front, on the gallery. */
export type ShopFront = "n" | "s" | "e" | "w";

export interface ShopDef {
  readonly id: string;
  /** The gallery's floor, or one of the front's storeys (ADR-0093 O5, `front-levels.ts`). */
  readonly floor: "p0" | "p1" | "p2" | FrontFloor;
  readonly rect: Rectangle;
  readonly front: ShopFront;
  /** The part of the front on the gallery (`u` from-to), for a corner unit; the rest of that side is a partition. */
  readonly window?: { readonly u0: number; readonly u1: number };
  /** A corner unit's sales floor up to this `u`; past it, behind a partition with a door, its back room. */
  readonly sales?: number;
  readonly trade: ShopTrade;
  readonly state: ShopState;
  /** The sign over its front: a proper name in the world's language, the same in every language (ADR-0056). */
  readonly sign: string;
  readonly door?: "r";
  /** A partition across its back: its back is on no glass (a front's unit back to back with a café, short of a rounded corner, O5). */
  readonly back?: true;
  /** Its front on the street: the storey's glass before its shopfront, open at its door (L1's east wing, O5). */
  readonly street?: true;
}
