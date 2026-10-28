import { METRO_STATION_IDS, type MetroStationId } from "@seki/core";
import type { MetroMapVm } from "@seki/ui";

/** The one line of the city (ADR-0035), its stops in order along the track. */
export const METRO_LINE = "Linia Kanjō";

export const METRO_STATION_NAMES: Readonly<Record<MetroStationId, string>> = {
  shinsekai: "Shinsekai 7",
  kanal: "Ulica Kanałowa",
  targ: "Targ pod estakadą",
  doki: "Doki Tessen",
};

/**
 * Ticket price between two platforms: a flat fare and a little per stop.
 * TODO(core): take the fares from the metro content once the simulation has them (ADR-0032).
 */
export const METRO_BASE_FARE = 15;
export const METRO_FARE_PER_STOP = 10;

export const metroFare = (from: MetroStationId, to: MetroStationId): number => {
  if (from === to) return 0;
  const stops = Math.abs(METRO_STATION_IDS.indexOf(from) - METRO_STATION_IDS.indexOf(to));
  return METRO_BASE_FARE + METRO_FARE_PER_STOP * stops;
};

/** The platform of a district (the simulation's district ids). */
export const stationOfDistrict = (district: string | null): MetroStationId | null => {
  if (district === null) return null;
  if (district.startsWith("shinsekai")) return "shinsekai";
  return (METRO_STATION_IDS as readonly string[]).includes(district) ? (district as MetroStationId) : null;
};

/**
 * Kiosks are ink-free: an interaction whose dialogue id is `metro_kiosk` (the station from the
 * district) or `metro_kiosk_<station>` opens the line map instead of a conversation (ADR-0035).
 */
export const METRO_KIOSK = "metro_kiosk";

export const kioskStation = (dialogueId: string, district: string | null): MetroStationId | null => {
  if (dialogueId === METRO_KIOSK) return stationOfDistrict(district);
  if (!dialogueId.startsWith(`${METRO_KIOSK}_`)) return null;
  const id = dialogueId.slice(METRO_KIOSK.length + 1);
  return (METRO_STATION_IDS as readonly string[]).includes(id) ? (id as MetroStationId) : null;
};

/** Said at the kiosk while a contract is hot: the platform is watched (ADR-0032). */
export const METRO_GUARDED = "Ochrona pilnuje peronu. Zgub pościg, zanim wsiądziesz.";

export const metroMapVm = (from: MetroStationId, guarded: boolean): MetroMapVm => ({
  line: METRO_LINE,
  from,
  stops: METRO_STATION_IDS.map((id) => ({ id, name: METRO_STATION_NAMES[id], fare: metroFare(from, id), here: id === from })),
  refusal: guarded ? METRO_GUARDED : null,
});
