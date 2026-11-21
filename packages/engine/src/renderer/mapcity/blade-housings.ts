import { prng } from "../city-kit-data";
import type { FacadeFrame, Wall } from "./facade-frame";
import { hushedOnWall } from "./remembrance-clear";
import { clearSpotFrom } from "./sign-room";

/**
 * The blade signs' housings (ADR-0096 rule 5): a blade sign of the 2077 layer hangs in a body from
 * the packs, a Taiwanese signboard's frame with its arms and stay, a narrow one, or a LED sign's
 * case, and its light (the atlas's blade, `sign-plan.ts`) lies on the body's panel. The body comes
 * from `extra-props.glb` as a facade slot (`facade-props.ts`); its panel's place is measured here,
 * so the light needs no file and stands where the body will (before the file loads, the light alone).
 *
 * Frame: the housing's local frame as baked, its plane across the wall: z out of the wall from its
 * arms' plates (0) to `size.z`, y up from its bottom, x along the wall centred on the sign.
 */
export interface BladeHousing {
  /** The style of its model in `extra-props.glb`, and the facade slot's kind. */
  readonly kind: "blade-frame" | "blade-narrow" | "blade-led";
  /** The baked model's size (m): x the thickness, y the height, z the reach out of the wall. */
  readonly size: { readonly x: number; readonly y: number; readonly z: number };
  /** The panel: from `out0` to `out1` out of the wall, from `y0` to `y1` over the housing's bottom. */
  readonly panel: { readonly out0: number; readonly out1: number; readonly y0: number; readonly y1: number };
  /** How far each face of the light stands off the sign's middle: the panel's half thickness and a centimetre. */
  readonly face: number;
}

/** The housings, measured on the source models (`tools/city_extras.py`), the panel's share of the box times the baked size. */
export const BLADE_HOUSINGS: readonly BladeHousing[] = [
  // Taiwan style signboard, board 02: the frame on two arms, a brace from the wall under it, the panel 1:3.15 as the atlas's blade.
  { kind: "blade-frame", size: { x: 0.072, y: 3.585, z: 0.963 }, panel: { out0: 0.163, out1: 0.925, y0: 1.096, y1: 3.496 }, face: 0.046 },
  // Board 13: the narrow ladder frame, its stay up the wall over it.
  { kind: "blade-narrow", size: { x: 0.06, y: 4.336, z: 0.799 }, panel: { out0: 0.322, out1: 0.735, y0: 0.949, y1: 3.349 }, face: 0.04 },
  // The LED sign's case on two arms.
  { kind: "blade-led", size: { x: 0.111, y: 1.778, z: 1.289 }, panel: { out0: 0.639, out1: 1.25, y0: 0.039, y1: 1.738 }, face: 0.066 },
];

/** The housing of a blade sign, by its seed (the third of the sign's draws). */
export const bladeHousing = (seed: number): BladeHousing => BLADE_HOUSINGS[Math.floor(seed * 997) % BLADE_HOUSINGS.length]!;

/** Where the middle of a blade sign's panel hangs over the ground floor's top (m). */
export const BLADE_OVER_GROUND = 1.7;

/** One blade sign: on `wall` at `u`, the panel's middle at world `y`, its atlas cell, seed and tint index. */
export interface BladeSpot {
  readonly wall: Wall;
  readonly u: number;
  readonly y: number;
  readonly cell: number;
  readonly seed: number;
  readonly color: number;
  readonly housing: BladeHousing;
}

/** The housing's bottom (world y) for a blade whose panel's middle is at `y`. */
export const housingBottom = (h: BladeHousing, y: number): number => y - (h.panel.y0 + h.panel.y1) / 2;

/**
 * The blade on a wall after its draws: off the end where a neighbour stands out in front of the wall
 * (G-157), clear of the whole housing, or none; none by a place of remembrance (G-943).
 */
export const placeBlade = (f: FacadeFrame, w: Wall, draws: { end: number; color: number; cell: number; seed: number }): BladeSpot | null => {
  const housing = bladeHousing(draws.seed);
  const y = f.b.base + f.ground + BLADE_OVER_GROUND;
  const from = draws.end < 0.5 ? 0.9 : w.length - 0.9;
  const u = clearSpotFrom(f, w, from, w.length - from, 0.05, housing.size.z, housingBottom(housing, y));
  if (u === null || hushedOnWall(f.b.remembrance, w, u - housing.face, u + housing.face, 0.05, housing.size.z)) return null;
  return { wall: w, u, y, cell: draws.cell, seed: draws.seed, color: draws.color, housing };
};

/** Does the building carry the atlas's shop signs (`planBuildingSigns`)? */
export const hasShopSigns = (f: FacadeFrame): boolean => !f.b.bracketSigns && f.style.signs > 0 && !(f.b.doorways && f.b.doorways.length > 0) && !f.b.venues?.length;

/** The seed of a building's signs' stream (`planBuildingSigns`). */
export const signStream = (f: FacadeFrame): (() => number) => prng((f.b.look ^ 0x5191) >>> 0);
