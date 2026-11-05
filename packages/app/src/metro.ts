import { type Locale, METRO_STATION_IDS, type MetroRefusal, type MetroStationId, isMetroStationId, metroFare } from "@seki/core";
import { metroStation } from "@seki/sim";
import { type MessageKey, translate } from "@seki/ui";
import { METRO_GUARDED } from "./presenters/metro-map";

export { metroFare };
export { METRO_GUARDED, metroMapVm } from "./presenters/metro-map";

/** The one line of the city (ADR-0035), its stops in order along the track; the station names stay Polish (ADR-0056). */
export const metroLine = (locale: Locale): string => translate(locale, "metro.line");

/** Station names as the simulation's stations have them: Lublin's own, the same in every language. */
export const METRO_STATION_NAMES: Readonly<Record<MetroStationId, string>> = Object.fromEntries(METRO_STATION_IDS.map((id) => [id, metroStation(id).name])) as Record<MetroStationId, string>;

/** The platform of a district (the simulation's district ids), for a kiosk that names no station. */
export const stationOfDistrict = (district: string | null): MetroStationId | null => {
  if (district === null) return null;
  if (district.startsWith("shinsekai")) return "shinsekai";
  return isMetroStationId(district) ? district : null;
};

/** Why the kiosk refused a ticket (`MetroRefused`, ADR-0034), as the toast says it. */
const METRO_REFUSAL: Readonly<Record<MetroRefusal, MessageKey>> = {
  riding: "metro.refusal.riding",
  "not-at-kiosk": "metro.refusal.notAtKiosk",
  "same-station": "metro.refusal.sameStation",
  watched: METRO_GUARDED,
  funds: "metro.refusal.funds",
};

export const metroRefusalText = (locale: Locale, reason: MetroRefusal): string => translate(locale, METRO_REFUSAL[reason]);
