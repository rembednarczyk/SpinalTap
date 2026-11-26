import type { GroundSurface } from "../../../packages/core/src";

/**
 * Which surface a sidewalk along a street with a carriageway has, by the district of Lublin it lies
 * in (the user's decision of 26.11: the district picks the surface, the stretch from junction to
 * junction keeps it). Lublin's streets: concrete slabs and blocks along the streets of the centre
 * and the districts round it (the game's `sidewalk`), the Old Town's sett and granite (`cobble`,
 * `square`). The squares, the deptak and the pedestrian streets are no street with a carriageway, so
 * no rule of this table reaches them; a forecourt past the strip by the kerb (`STRIP`) neither.
 */
export interface SidewalkRule {
  readonly expected: readonly GroundSurface[];
  readonly why: string;
}

export const SIDEWALK_RULES: Readonly<Record<string, SidewalkRule>> = {
  krakowskie: { expected: ["sidewalk"], why: "concrete slabs and blocks along the streets of Śródmieście" },
  "stare-miasto": { expected: ["cobble", "square"], why: "the Old Town's sett and granite slabs" },
  podzamcze: { expected: ["sidewalk"], why: "concrete slabs and blocks" },
  nabrzeze: { expected: ["sidewalk"], why: "concrete slabs and blocks" },
};

/** The rule for a chunk's district (its id without the cell: `krakowskie-2-0` is `krakowskie`); none for a district not in the table. */
export const ruleOf = (district: string | undefined): SidewalkRule | undefined => (district === undefined ? undefined : SIDEWALK_RULES[district]);
