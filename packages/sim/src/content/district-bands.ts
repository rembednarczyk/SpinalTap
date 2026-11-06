import type { ContractSiteId, LevelBand } from "@seki/core";
import type { DistrictId } from "./world-map";

/**
 * The band of difficulty of each district (ADR-0059, stage 5): an enemy there is of the player's
 * level kept within it. Krakowskie (`shinsekai-7`) is where Seki wakes, and since ADR-0063
 * (stage 6) also holds the market in Alchemia; Stare Miasto (`kanal`) comes next, Podzamcze
 * (`targ`) after it and the docks on the Bystrzyca (`doki`) last. First guesses, to be tuned by the balance test of stage 8.
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
 * The district of each contract site, whose band gives the job its level (ADR-0059). A test
 * checks it against where the site's people stand.
 */
export const CONTRACT_SITE_DISTRICTS: Readonly<Record<ContractSiteId, DistrictId>> = {
  east_lot: "shinsekai-7",
  koi_back: "shinsekai-7",
  car_wash: "shinsekai-7",
  south_gate: "shinsekai-7",
  kanal_bridge: "kanal",
  // The market moved into Alchemia (ADR-0063, stage 6), in Krakowskie's district.
  hana_stall: "shinsekai-7",
  hebi_stash: "shinsekai-7",
  raid_north: "shinsekai-7",
  raid_east: "shinsekai-7",
  docks_escort: "doki",
  tessen_office: "doki",
  quay_terminal: "doki",
};
