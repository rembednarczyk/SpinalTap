import { type Locale, METRO_STATION_IDS, type MetroStationId, metroFare, metroRideSeconds, metroStops } from "@seki/core";
import { CAPSULE_DOOR, DISTRICTS, METRO_PLANNED, METRO_STATIONS, METRO_TUNNEL, type MetroMapPoint, WORLD_CHUNKS, metroRoute, metroStation } from "@seki/sim";
import {
  type MapMetroEntranceVm,
  type MapMetroPlannedVm,
  type MapMetroStationVm,
  type MapMetroVm,
  type MapPolygon,
  type MetroMapVm,
  type MetroNearVm,
  type MetroPreviewVm,
  NEAR_MAX,
  NEAR_RADIUS,
  isMessageKey,
  translate,
} from "@seki/ui";

/**
 * The metro on the map (ADR-0071 stage 1): the line as a layer, built once from the simulation's
 * content, and the kiosk with the route and the preview of the chosen destination. The station
 * and entrance names are Lublin's; the UI translates everything else.
 */

const round = (v: number) => Math.round(v * 10) / 10;
const flat = (points: readonly MetroMapPoint[]): MapPolygon => points.flatMap((p) => [round(p.x), round(p.z)]);
const length = (points: readonly MetroMapPoint[]): number => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - (points[i] as MetroMapPoint).x, p.z - (points[i] as MetroMapPoint).z), 0);

/** Stage 1 keeps today's kiosks as the only entrance of each station (stage 2 moves them). */
const entrances = (id: MetroStationId): MapMetroEntranceVm[] => {
  const s = metroStation(id);
  return [{ label: "A", name: s.name, x: round(s.kiosk.x), z: round(s.kiosk.z) }];
};

const stationVm = (id: MetroStationId): MapMetroStationVm => {
  const s = metroStation(id);
  return { id, name: s.name, district: DISTRICTS[s.district].name, x: round(s.kiosk.x), z: round(s.kiosk.z), entrances: entrances(id) };
};

const plannedVm = (p: (typeof METRO_PLANNED)[number]): MapMetroPlannedVm => {
  const from = metroStation(p.from).kiosk;
  const path = [from, ...p.via, p.at];
  return { id: p.id, name: p.name, from: p.from, x: p.at.x, z: p.at.z, path: flat(path), distance: Math.round(length(path) / 10) * 10 };
};

/** The layer of the city map, the minimap and the kiosk. */
export const metroLayerVm = (): MapMetroVm => ({
  stations: METRO_STATION_IDS.map(stationVm),
  legs: METRO_TUNNEL.map((t) => flat([metroStation(t.from).kiosk, ...t.via, metroStation(t.to).kiosk])),
  planned: METRO_PLANNED.map(plannedVm),
});

/** Who hands out contracts (the minimap's fixers, ADR-0035), by their knot; people keep their names. */
const CONTRACT_GIVERS: Readonly<Record<string, string>> = { fixer: "Kaito", hana: "Hana", genzo: "Genzō" };

type NearPoint = Omit<MetroNearVm, "distance">;

/** What the map already knows of the city: the shops, the contract givers and the capsule room. */
const NEAR_POINTS: readonly NearPoint[] = [
  ...WORLD_CHUNKS.flatMap((c) =>
    c.actors.flatMap((a): NearPoint[] => {
      const i = "interactable" in a ? a.interactable : undefined;
      if (!i) return [];
      const { x, z } = a.spawn.position;
      const giver = CONTRACT_GIVERS[i.dialogueId];
      if (giver) return [{ kind: "contract", label: "metro.near.contract", name: giver, x, z }];
      if ((i.kind === "shop" || i.prompt.startsWith("prompt.shop.")) && isMessageKey(i.prompt)) return [{ kind: "shop", label: i.prompt, x, z }];
      return [];
    }),
  ),
  { kind: "hideout", label: "metro.near.hideout", x: CAPSULE_DOOR.at.x, z: CAPSULE_DOOR.at.z },
];

/** Up to four things within 150 m of the station, the nearest first. */
export const metroNear = (id: MetroStationId, points: readonly NearPoint[] = NEAR_POINTS): MetroNearVm[] => {
  const at = metroStation(id).kiosk;
  return points
    .map((p) => ({ ...p, x: round(p.x), z: round(p.z), distance: Math.hypot(p.x - at.x, p.z - at.z) }))
    .filter((p) => p.distance <= NEAR_RADIUS)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, NEAR_MAX)
    .map((p) => ({ ...p, distance: Math.round(p.distance / 10) * 10 }));
};

export const metroPreviewVm = (from: MetroStationId, to: MetroStationId): MetroPreviewVm => {
  const s = stationVm(to);
  return {
    id: to,
    name: s.name,
    district: s.district,
    entrances: s.entrances,
    x: s.x,
    z: s.z,
    near: metroNear(to),
    route: metroRoute(from, to),
    fare: metroFare(from, to),
    stops: metroStops(from, to),
    seconds: metroRideSeconds(from, to),
  };
};

/** Said at the kiosk while a contract is hot: the platform is watched (ADR-0032). */
export const METRO_GUARDED = "metro.guarded" as const;

/** The kiosk at `from`: every stop with its fare and time, and the chosen one's route and card. */
export const metroMapVm = (from: MetroStationId, guarded: boolean, locale: Locale, selected: MetroStationId | null = null): MetroMapVm => {
  const to = selected !== null && selected !== from ? selected : null;
  return {
    line: translate(locale, "metro.line"),
    from,
    stops: METRO_STATION_IDS.map((id) => ({
      id,
      name: metroStation(id).name,
      fare: id === from ? 0 : metroFare(from, id),
      stops: metroStops(from, id),
      seconds: id === from ? 0 : metroRideSeconds(from, id),
      here: id === from,
    })),
    selected: to,
    preview: to ? metroPreviewVm(from, to) : null,
    refusal: guarded ? translate(locale, METRO_GUARDED) : null,
  };
};

/** Every station's entrances, for the minimap's icons. */
export const METRO_ENTRANCES = METRO_STATIONS.flatMap((s) => entrances(s.id));
