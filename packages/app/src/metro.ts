import { type Locale, METRO_STATION_IDS, type MetroRefusal, type MetroStationId, isMetroStationId, metroFare } from "@seki/core";
import { type MessageKey, type MetroMapVm, translate } from "@seki/ui";

export { metroFare };

/** The one line of the city (ADR-0035), its stops in order along the track; the station names stay Polish (ADR-0056). */
export const metroLine = (locale: Locale): string => translate(locale, "metro.line");

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
export const METRO_GUARDED: MessageKey = "metro.guarded";

/** Why the kiosk refused a ticket (`MetroRefused`, ADR-0034), as the toast says it. */
const METRO_REFUSAL: Readonly<Record<MetroRefusal, MessageKey>> = {
  riding: "metro.refusal.riding",
  "not-at-kiosk": "metro.refusal.notAtKiosk",
  "same-station": "metro.refusal.sameStation",
  watched: METRO_GUARDED,
  funds: "metro.refusal.funds",
};

export const metroRefusalText = (locale: Locale, reason: MetroRefusal): string => translate(locale, METRO_REFUSAL[reason]);

export const metroMapVm = (from: MetroStationId, guarded: boolean, locale: Locale): MetroMapVm => ({
  line: metroLine(locale),
  from,
  stops: METRO_STATION_IDS.map((id) => ({ id, name: METRO_STATION_NAMES[id], fare: id === from ? 0 : metroFare(from, id), here: id === from })),
  refusal: guarded ? translate(locale, METRO_GUARDED) : null,
});
