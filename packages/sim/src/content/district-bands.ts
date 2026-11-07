import type { ContractSiteId, LevelBand } from "@seki/core";
import type { Rect } from "./builders";
import type { DistrictId } from "./world-map";

/**
 * The band of difficulty of each district (ADR-0059, stage 5): an enemy there is of the player's
 * level kept within it. Krakowskie (`shinsekai-7`) is where Seki wakes; Stare Miasto (`kanal`)
 * comes next, the market (`targ`: Podzamcze, and since ADR-0063 stage 6 the plot of Alchemia, see
 * `BAND_AREAS`) after it and the docks on the Bystrzyca (`doki`) last. The tops of Stare Miasto and
 * the market come from the balance test of stage 8 (`test/balance.test.ts`): the player leaves
 * Krakowskie at about 11, Stare Miasto at 19 and the market at 28, so 14 and 20 left the city
 * behind her (now 19 and 28). The floors stay where the user set them.
 */
export const DISTRICT_BANDS: Readonly<Record<DistrictId, LevelBand>> = {
  "shinsekai-7": { min: 1, max: 8 },
  kanal: { min: 5, max: 19 },
  targ: { min: 10, max: 28 },
  doki: { min: 16, max: 30 },
};

/** The band of a district; none outside every district (the player's own level holds there). */
export const bandOf = (district: DistrictId | null): LevelBand | null => (district ? DISTRICT_BANDS[district] : null);

/**
 * A piece of a district holding another district's band. The market moved into Alchemia
 * (ADR-0063, stage 6), on Krakowskie's ground, and keeps the market's band there (the user's
 * decision of 6.11): its people, its stashes and the sites of its jobs and raids.
 */
export interface BandArea {
  readonly id: string;
  /** The district the area lies in; elsewhere it does not hold. */
  readonly within: DistrictId;
  readonly area: Rect;
  /** The district whose band holds in the area. */
  readonly band: DistrictId;
}

/**
 * The plot of Alchemia on Plac Ofiar Getta with the market (`alchemia-market.ts`): the hall and
 * its five stalls, the square with Hana's cart, Kurosawa and the cleaners, the hollow of the Hebi
 * stash, the lookout's post on the way in from Lubartowska and the bag behind the ruin. A test
 * checks every one of them inside it and nobody else of Krakowskie's.
 */
export const BAND_AREAS: readonly BandArea[] = [{ id: "alchemia-market", within: "shinsekai-7", area: { minX: 400, maxX: 456, minZ: 32, maxZ: 124 }, band: "targ" }];

/** The district whose band holds at `p` in `district`: an area's of `BAND_AREAS`, or the district's own. */
export const bandDistrictAt = (district: DistrictId | null, p: { readonly x: number; readonly z: number }): DistrictId | null => {
  for (const a of BAND_AREAS) {
    if (a.within === district && p.x >= a.area.minX && p.x <= a.area.maxX && p.z >= a.area.minZ && p.z <= a.area.maxZ) return a.band;
  }
  return district;
};

/** The band at `p` in `district` (see `bandDistrictAt`); none outside every district. */
export const bandAt = (district: DistrictId | null, p: { readonly x: number; readonly z: number }): LevelBand | null => bandOf(bandDistrictAt(district, p));

/**
 * The band of each contract site, by the district it is named for, which gives the job its level
 * (ADR-0059). A test checks it against the band where the site's people stand.
 */
export const CONTRACT_SITE_BANDS: Readonly<Record<ContractSiteId, DistrictId>> = {
  east_lot: "shinsekai-7",
  koi_back: "shinsekai-7",
  car_wash: "shinsekai-7",
  south_gate: "shinsekai-7",
  kanal_bridge: "kanal",
  // The market in Alchemia (ADR-0063, stage 6): on Krakowskie's ground, in the market's band.
  hana_stall: "targ",
  hebi_stash: "targ",
  raid_north: "targ",
  raid_east: "targ",
  docks_escort: "doki",
  tessen_office: "doki",
  quay_terminal: "doki",
};
