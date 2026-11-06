import { METRO_STATION_IDS, type MetroStationId, type Vec3 } from "@seki/core";
import type { GroundCut } from "../world/ground";
import type { Rect } from "./builders";
import { type Pavilion, type PavilionSpot, pavilion, pavilionChunk } from "./metro-pavilion";

export { HALL_DEPTH, PAVILION, STAIRS } from "./metro-pavilion";

/** District ids as world-map.ts names them (kept local: world-map imports this table). */
type DistrictId = "shinsekai-7" | "kanal" | "targ" | "doki";

/**
 * The metro's stations (ADR-0034, moved into Lublin by ADR-0045, entrances by ADR-0071 stage 2):
 * one per district, each with one or two entrances. An entrance is a pavilion on the street with
 * stairs down to a hall 2.7 m lower and the ticket machine there (`metro-pavilion.ts`); a ride
 * ends in the hall of the destination's first entrance. Kept apart from the district tables (one
 * entry in world-map.ts hooks them up), like the devices of wave 1.
 */
export interface MetroEntranceDef extends Pavilion {
  readonly label: "A" | "B";
  /** Lublin's name of the place, the same in every language. */
  readonly name: string;
  readonly spot: PavilionSpot;
  /** The map chunk the pavilion stands in: its blocks stream in with it. */
  readonly chunk: string;
}

export interface MetroStationDef {
  readonly id: MetroStationId;
  readonly name: string;
  readonly district: DistrictId;
  /** The station on the map and the line: between its entrances, over the platform-to-be. */
  readonly node: { readonly x: number; readonly z: number };
  readonly entrances: readonly [MetroEntranceDef, ...MetroEntranceDef[]];
  /** Where a rider comes up (entrance A's hall), and the way they face. */
  readonly arrival: Vec3;
  readonly arrivalYaw: number;
}

/** The ticket can be bought this close to the machine (horizontally). */
export const KIOSK_REACH = 2.2;

const entrance = (label: "A" | "B", name: string, spot: PavilionSpot): MetroEntranceDef => ({ label, name, spot, chunk: pavilionChunk(spot.x, spot.z), ...pavilion(spot) });

const station = (id: MetroStationId, name: string, district: DistrictId, node: { x: number; z: number }, entrances: readonly [MetroEntranceDef, ...MetroEntranceDef[]]): MetroStationDef => ({
  id,
  name,
  district,
  node,
  entrances,
  arrival: entrances[0].arrival,
  arrivalYaw: entrances[0].arrivalYaw,
});

/**
 * The entrances of ADR-0071 variant A with the places of the topography curator's review (5.11),
 * moved where the drawn map asks for it (stage 2): each one's long side, its opening and why.
 */
export const METRO_STATIONS: readonly MetroStationDef[] = [
  // Plac Litewski: the square's east part, on the lawn south of the UMCS weather station (w633015047): the long side
  // east-west, so the station's garden keeps 1.5 m; the opening east, to the crossing of the square's paths.
  station("shinsekai", "Plac Litewski", "shinsekai-7", { x: 74, z: 16.9 }, [entrance("A", "Plac Litewski", { x: 74, z: 16.9, along: "x", opens: 1 })]),
  // Brama Krakowska: the node on Lubartowska's axis between its two entrances. A on Plac Łokietka west of the
  // carriageway as drawn (Królewska is 6.5 m wide there, x 440.3–446.8), along it, open north to the deptak;
  // B on the car park before Alchemia, 3 m off the archaeological site (w1559354344), open east to Lubartowska.
  station("kanal", "Brama Krakowska", "kanal", { x: 442, z: -40 }, [
    entrance("A", "Plac Łokietka", { x: 433, z: -107, along: "z", opens: 1 }),
    entrance("B", "Alchemia", { x: 428, z: 28, along: "x", opens: 1 }),
  ]),
  // Plac Zamkowy: the node on Aleja Tysiąclecia. A on the square's car park by the west houses, open north to
  // their pavement; B between the Dworzec Autobusowy and the avenue, open south to the avenue's path.
  station("targ", "Plac Zamkowy", "targ", { x: 740, z: 335 }, [
    entrance("A", "Plac Zamkowy", { x: 722, z: 286, along: "z", opens: 1 }),
    entrance("B", "Dworzec Autobusowy", { x: 754, z: 379, along: "z", opens: -1 }),
  ]),
  // Nabrzeże Bystrzycy: outside the Tessen yard, its back to the yard's south wall (the old kiosk stood in the
  // 2.8 m between that wall and the warehouse), open east to the yard's gate. The wall stands 0.2 m off its north
  // side (z 390.0): the eaves stop short of it there (T-160).
  station("doki", "Nabrzeże Bystrzycy", "doki", { x: 2527, z: 388 }, [entrance("A", "Nabrzeże", { x: 2527, z: 388, along: "x", opens: 1, wall: { side: 1, gap: 0.2 } })]),
];

export const metroStation = (id: MetroStationId): MetroStationDef => {
  const s = METRO_STATIONS.find((m) => m.id === id);
  if (!s) throw new Error(`no metro station ${id}`);
  return s;
};

/** Every entrance with its station. */
export const METRO_ENTRANCES: readonly (MetroEntranceDef & { readonly station: MetroStationId })[] = METRO_STATIONS.flatMap((s) => s.entrances.map((e) => ({ ...e, station: s.id })));

/** The pavilions' outlines: crowd routes, traffic and the map's furniture keep off them. */
export const METRO_FOOTPRINTS: readonly Rect[] = METRO_ENTRANCES.map((e) => e.outline);

/** The ground dug out under the pavilions' stairs and halls (`GroundField`, and the renderer's terrain and paving). */
export const METRO_CUTS: readonly GroundCut[] = METRO_ENTRANCES.map((e) => e.cut);

/** The station whose ticket machine is within reach of `p` (and on its level), or null. */
export const kioskAt = (p: Vec3, stations: readonly MetroStationDef[] = METRO_STATIONS): MetroStationDef | null =>
  stations.find((s) => s.entrances.some((e) => Math.hypot(p.x - e.machine.x, p.z - e.machine.z) <= KIOSK_REACH && Math.abs(p.y - e.machine.y) <= 1.6)) ?? null;

// ---- the line on the map (ADR-0071 stage 1) ----

/**
 * The metro line as the map draws it (ADR-0071 stage 1): the tunnel between the stations and the
 * stations the city may get later. Map data only, no geometry and no rules: the simulation never
 * reads it, so it changes neither the state hash nor the save. Points are world metres (x east,
 * z north), the stations themselves are the `node`s of `METRO_STATIONS`.
 */
export interface MetroMapPoint {
  readonly x: number;
  readonly z: number;
}

/** The tunnel between two neighbouring stations of the line, without the stations themselves. */
export interface MetroTunnelDef {
  readonly from: MetroStationId;
  readonly to: MetroStationId;
  readonly via: readonly MetroMapPoint[];
}

/**
 * The tunnel (ADR-0071, "Przebieg tunelu"): from Plac Litewski down its path to Krakowskie
 * Przedmieście, under the deptak to Plac Łokietka and north under Lubartowska to the station
 * between its two entrances (stage 2, T-149), on past Alchemia, down the valley of the
 * Czechówka under Aleja Tysiąclecia to Plac Zamkowy, then east under the avenue and
 * ul. Kalinowszczyzna, over the Bystrzyca by the Lutosławski bridge (w834402001) to Nabrzeże. It
 * keeps off the Old Town's hill with its cellars, off the castle hill and at least 39 m off the Old
 * Jewish Cemetery (w40049437, G-314). The points follow the streets of the map data (OSM) and the
 * topography curator's review of ADR-0071 (T-150).
 */
export const METRO_TUNNEL: readonly MetroTunnelDef[] = [
  { from: "shinsekai", to: "kanal", via: [{ x: 78, z: -15 }, { x: 88, z: -57 }, { x: 130, z: -55 }, { x: 156, z: -47 }, { x: 188, z: -54 }, { x: 240, z: -66 }, { x: 342, z: -89 }, { x: 443, z: -94 }] },
  {
    from: "kanal",
    to: "targ",
    via: [{ x: 442, z: -20 }, { x: 447, z: 16 }, { x: 460, z: 56 }, { x: 502, z: 160 }, { x: 550, z: 281 }, { x: 585, z: 362 }, { x: 680, z: 352 }],
  },
  {
    from: "targ",
    to: "doki",
    via: [
      { x: 743, z: 345 },
      { x: 904, z: 325 },
      { x: 1060, z: 300 },
      { x: 1250, z: 290 },
      { x: 1395, z: 270 },
      { x: 1580, z: 232 },
      { x: 1738, z: 386 },
      { x: 2084, z: 384 },
      { x: 2340, z: 428 },
      { x: 2386, z: 414 },
      { x: 2462, z: 420 },
    ],
  },
];

/**
 * A station the line may get (ADR-0071, "możliwe stacje"): dashed on the map, without a ticket,
 * "under construction". Not a `MetroStationId`, so neither the contract nor the save knows it;
 * it becomes a station with the ADR of its district.
 */
export interface MetroPlannedDef {
  readonly id: string;
  /** Lublin's own name, the same in every language. */
  readonly name: string;
  /** The working station the extension starts from. */
  readonly from: MetroStationId;
  readonly at: MetroMapPoint;
  /** The dashed line between `from` and `at`; empty for a station on the line itself (`onLine`). */
  readonly via: readonly MetroMapPoint[];
  /** A station on the tunnel between `from` and the next one: no branch, only its hollow ring. */
  readonly onLine?: true;
}

/** The possible stations of ADR-0071, with the places of the topography curator's review (T-151…T-153). */
export const METRO_PLANNED: readonly MetroPlannedDef[] = [
  // Ogród Saski: the line carried on west along Krakowskie and Aleje Racławickie, under the avenue on the park's south edge (G-315).
  { id: "ogrod-saski", name: "Ogród Saski", from: "shinsekai", at: { x: -630, z: -84 }, via: [{ x: 78, z: -15 }, { x: 50, z: -57 }, { x: 20, z: -59 }, { x: -242, z: -67 }, { x: -480, z: -88 }] },
  // Lublin Główny: Plac Dworcowy between the railway station and the Dworzec Metropolitalny, a branch south from the
  // station under Lubartowska to Plac Łokietka, then by Kozia and
  // Bernardyńska, clear of St Peter's church (G-315); schematic south of the imported city.
  {
    id: "lublin-glowny",
    name: "Lublin Główny",
    from: "kanal",
    at: { x: 590, z: -1840 },
    via: [{ x: 443, z: -94 }, { x: 440, z: -110 }, { x: 420, z: -128 }, { x: 390, z: -144 }, { x: 368, z: -170 }, { x: 380, z: -210 }, { x: 413, z: -256 }, { x: 492, z: -370 }, { x: 506, z: -389 }],
  },
  // Kalinowszczyzna: on the line in the gap of T-022, under ul. Kalinowszczyzna by the stops "Tatarska" (T-153).
  { id: "kalinowszczyzna", name: "Kalinowszczyzna", from: "targ", at: { x: 1738, z: 386 }, via: [], onLine: true },
];

/** The line's stations between `from` and `to` in the order of the ride, both ends included. */
export const metroRoute = (from: MetroStationId, to: MetroStationId): MetroStationId[] => {
  const a = METRO_STATION_IDS.indexOf(from);
  const b = METRO_STATION_IDS.indexOf(to);
  const step = b >= a ? 1 : -1;
  const out: MetroStationId[] = [];
  for (let i = a; i !== b + step; i += step) out.push(METRO_STATION_IDS[i] as MetroStationId);
  return out;
};
