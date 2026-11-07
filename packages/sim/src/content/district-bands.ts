import type { ContractKind, ContractSiteId, LevelBand } from "@seki/core";
import type { Rect } from "./builders";
import type { DistrictId } from "./world-map";

/**
 * The band of difficulty of each district (ADR-0059, stage 5): an enemy there is of the player's
 * level kept within it. Krakowskie (`shinsekai-7`) is where Seki wakes; Stare Miasto (`kanal`)
 * comes next, the market (`targ`: Podzamcze, and since ADR-0063 stage 6 the plot of Alchemia, see
 * `BAND_AREAS`) after it and the docks on the Bystrzyca (`doki`) last. The balance test of stage 8
 * (`test/balance.test.ts`) keeps them: the player leaves Krakowskie at about 9, Stare Miasto at 16
 * and the market at 23, a little above the tops of 14 and 20, where the jobs stop growing and slow
 * the pace; only the docks have enemies above 21.
 */
export const DISTRICT_BANDS: Readonly<Record<DistrictId, LevelBand>> = {
  "shinsekai-7": { min: 1, max: 8 },
  kanal: { min: 5, max: 14 },
  targ: { min: 10, max: 20 },
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
 * Alchemia by the investor's plan (ADR-0074 §9, the user's decision of 6.11: the whole complex,
 * the car park and the pavilion on its corner in the market's band): the plot from Świętoduska to
 * Lubartowska (x 379..456, z 30..140, the food hall, T1 with Hana's cart, T2 with the Hebi stash,
 * the lookout's post under the Arkady's arches and the bag before them) and the car park south of the hall with
 * Kurosawa and the cleaners by the lift's kiosk (x 379..441, z -16..30). The car park's piece stops
 * short of Lubartowska's footway, the stop "Brama Krakowska 01" (447; 16) and metro B's pavilion
 * stays in it, its hall under the street being the station's. A test checks every one of the
 * market's people and places inside and nobody else of Krakowskie's.
 */
export const BAND_AREAS: readonly BandArea[] = [
  { id: "alchemia-market", within: "shinsekai-7", area: { minX: 379, maxX: 456, minZ: 30, maxZ: 140 }, band: "targ" },
  { id: "alchemia-car-park", within: "shinsekai-7", area: { minX: 379, maxX: 441, minZ: -16, maxZ: 30 }, band: "targ" },
];

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

/**
 * Kinds of job whose level is not their site's but their giver's district's (the user's decision
 * of 7.11): a delivery fights nobody at Hana's stall, in the market's band, and is Kaito's job, so
 * it takes Krakowskie's band as his eliminations do.
 */
export const CONTRACT_KIND_BANDS: Readonly<Partial<Record<ContractKind, DistrictId>>> = { delivery: "shinsekai-7" };
