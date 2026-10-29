import { METRO_STATION_IDS, type MetroRefusal, type MetroStationId, isMetroStationId, metroFare } from "@seki/core";
import type { MetroMapVm } from "@seki/ui";

export { metroFare };

/** The one line of the city (ADR-0035), its stops in order along the track. */
export const METRO_LINE = "Linia Kanjō";

export const METRO_STATION_NAMES: Readonly<Record<MetroStationId, string>> = {
  shinsekai: "Plac Litewski",
  kanal: "Brama Krakowska",
  targ: "Plac Zamkowy",
  doki: "Nabrzeże Bystrzycy",
};

/** The platform of a district (the simulation's district ids), for a kiosk that names no station. */
export const stationOfDistrict = (district: string | null): MetroStationId | null => {
  if (district === null) return null;
  if (district.startsWith("shinsekai")) return "shinsekai";
  return isMetroStationId(district) ? district : null;
};

/** Said at the kiosk while a contract is hot: the platform is watched (ADR-0032). */
export const METRO_GUARDED = "Ochrona pilnuje peronu. Zgub pościg, zanim wsiądziesz.";

/** Why the kiosk refused a ticket (`MetroRefused`, ADR-0034), as the toast says it. */
export const METRO_REFUSAL_TEXT: Readonly<Record<MetroRefusal, string>> = {
  riding: "Już jedziesz.",
  "not-at-kiosk": "Bilet kupisz tylko przy kiosku.",
  "same-station": "Jesteś na tej stacji.",
  watched: METRO_GUARDED,
  funds: "Za mało €$ na bilet.",
};

export const metroMapVm = (from: MetroStationId, guarded: boolean): MetroMapVm => ({
  line: METRO_LINE,
  from,
  stops: METRO_STATION_IDS.map((id) => ({ id, name: METRO_STATION_NAMES[id], fare: id === from ? 0 : metroFare(from, id), here: id === from })),
  refusal: guarded ? METRO_GUARDED : null,
});
