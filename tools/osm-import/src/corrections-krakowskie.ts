/**
 * Added areas in the yards and by the walls of the public and commercial buildings of Krakowskie
 * Przedmieście between Plac Litewski, Peowiaków and the Centrum Kultury (T-243, G-513), the tail of
 * `ADDED_AREAS`: kept apart so `corrections.ts` stays within ADR-0031's 500 lines.
 *
 * OSM maps no surface there: the yards behind the frontages are bare land between the buildings,
 * the service ways into them lines, and the strips between the walls and the footways' bands
 * nothing at all. No import rule lays them right: `landuse=commercial` here runs over the lawns of
 * Plac Lecha Kaczyńskiego, and a band round the walls would stop halfway across a yard. So one area
 * per yard or strip, its corners 0.3-0.7 m inside the walls round it (the building is drawn over the
 * paving, so no crack opens along a wall however the chunk simplifies it) and on the axes of the
 * footways and the streets beside it (their bands are drawn over it). Where the area meets a lawn,
 * a square or a car park of the map it runs along their edges on their nodes.
 */
import type { AddedArea } from "./corrections.ts";
import type { Pt } from "./geometry.ts";

/**
 * Setts (`square`), the yards too: the game reads `road` as a carriageway, where the import stands
 * no tree or ticket machine and sends no passer-by, and these yards are walked through. Whether a
 * yard is asphalt or setts on the ground is the orthophoto's to say (T-243).
 */
export const SETTS = { "area:highway": "pedestrian", surface: "paving_stones" } as const;

/** An added area of T-243: corners off the map's nodes unless `nodesOf` names the ways. */
export const yard = (name: string, tags: AddedArea["tags"], ring: readonly Pt[], reason: string, nodesOf?: readonly (string | null)[]): AddedArea => ({
  id: `T-243/${name}`,
  tags,
  ring,
  nodesOf: nodesOf ?? ring.map(() => null),
  reason,
  ref: "T-243",
});

/**
 * The yard of the block between Krakowskie Przedmieście 50, the Sąd Okręgowy, Kościuszki 3 and 5,
 * the town hall's offices on Peowiaków 13 and the houses on Kołłątaja: the parking aisle w343899805
 * loops round w69672547 in it, the ways w343899804 and w343899807 run in under the town hall and the
 * court. West to east along KP 50's back, down the court's west wall, round the light well of
 * Kościuszki 3 and down w69672566's west wall to the garages, round the strip behind the garages
 * under w69672573's north wall, west along the town hall's north walls to Aurum, and back up the
 * east walls of w69672545 and w69672554. The garages and w69672547 stand in it.
 */
const BLOCK_KP50: AddedArea = yard(
  "podworze-kp50",
  SETTS,
  [
    { x: -53.3, z: -86.0 },
    { x: -46.2, z: -86.0 },
    { x: -32.6, z: -84.9 },
    { x: -27.5, z: -84.6 },
    { x: -14.0, z: -83.7 },
    { x: -12.9, z: -90.5 },
    { x: -10.5, z: -122.7 },
    { x: -6.5, z: -122.6 },
    { x: 1.0, z: -122.7 },
    { x: 3.4, z: -120.2 },
    { x: 5.0, z: -121.6 },
    { x: 2.6, z: -133.0 },
    { x: 2.9, z: -136.2 },
    { x: 1.0, z: -136.5 },
    { x: -1.0, z: -133.3 },
    { x: -8.7, z: -132.2 },
    { x: -8.3, z: -127.0 },
    { x: -14.0, z: -125.9 },
    { x: -19.9, z: -156.0 },
    { x: -13.0, z: -158.1 },
    { x: -12.6, z: -159.4 },
    { x: -13.8, z: -164.9 },
    { x: -27.6, z: -161.6 },
    { x: -41.4, z: -157.6 },
    { x: -50.6, z: -155.5 },
    { x: -51.0, z: -153.0 },
    { x: -69.9, z: -148.6 },
    { x: -71.3, z: -148.2 },
    { x: -70.6, z: -145.6 },
    { x: -61.9, z: -147.0 },
    { x: -58.2, z: -123.9 },
    { x: -59.4, z: -122.6 },
    { x: -54.4, z: -97.6 },
    { x: -55.4, z: -96.1 },
    { x: -53.1, z: -87.4 },
  ],
  "utwardzone podwórze kwartału KP 50 – Sąd Okręgowy – Peowiaków 13 z pętlą parkingową w343899805, w OSM bez obszaru",
);

/** The yard of Krakowskie Przedmieście 39 behind the gate of the service way w1306444451, closed by the houses on all sides. */
const YARD_KP39: AddedArea = yard(
  "podworze-kp39",
  SETTS,
  [
    { x: -177.3, z: -33.2 },
    { x: -160.8, z: -33.2 },
    { x: -160.8, z: -8.8 },
    { x: -177.3, z: -8.8 },
  ],
  "utwardzone podwórze KP 39 za bramą z drogą serwisową w1306444451, w OSM bez obszaru",
);

/** The yard of Krakowskie Przedmieście 41 west of its wing, along the service way w1306444443, open to the chunk's west edge. */
const YARD_KP41: AddedArea = yard(
  "podworze-kp41",
  SETTS,
  [
    { x: -201.0, z: -33.4 },
    { x: -186.6, z: -33.1 },
    { x: -186.6, z: -29.8 },
    { x: -188.4, z: -27.5 },
    { x: -188.5, z: -22.0 },
    { x: -189.8, z: -21.8 },
    { x: -189.6, z: -3.0 },
    { x: -190.6, z: -3.0 },
    { x: -198.2, z: -3.6 },
    { x: -198.2, z: -10.5 },
    { x: -201.0, z: -10.5 },
  ],
  "utwardzone podwórze KP 41 z drogą serwisową w1306444443, w OSM bez obszaru",
);

/** The yard of the bank on Krakowskie Przedmieście 37, in its outline's U and north between it and 3 Maja 2, with the driveway w757848899 in it, up to its mouth between the two. */
const YARD_KP37: AddedArea = yard(
  "podworze-kp37",
  SETTS,
  [
    { x: -149.2, z: -26.8 },
    { x: -131.9, z: -26.8 },
    { x: -130.6, z: -10.0 },
    { x: -130.6, z: 16.9 },
    { x: -142.2, z: 16.9 },
    { x: -146.5, z: 14.6 },
    { x: -146.6, z: -16.1 },
    { x: -149.2, z: -16.1 },
  ],
  "utwardzone podwórze banku KP 37 z podjazdem w757848899, w OSM bez obszaru",
);

/**
 * The pavement along the south frontage of Krakowskie Przedmieście from the chunk's west edge to
 * Kołłątaja (KP 60, 58 and the Grand Hotel Lublinianka) and down the hotel's east wall to the
 * crossing w507416910: from the walls to the axes of the sidewalks w174600669 and w444111340 on the
 * north, and to the axis of Kołłątaja w335831606 on the east, so the setts meet its kerb.
 */
const FRONT_KP56: AddedArea = yard(
  "chodnik-kp56-60",
  SETTS,
  [
    { x: -201.0, z: -74.25 },
    { x: -144.85, z: -71.57 },
    { x: -128.45, z: -70.45 },
    { x: -109.16, z: -70.11 },
    { x: -105.15, z: -71.25 },
    { x: -100.31, z: -71.65 },
    { x: -100.49, z: -79.18 },
    { x: -105.52, z: -118.52 },
    { x: -107.88, z: -137.71 },
    { x: -113.78, z: -137.13 },
    { x: -116.3, z: -137.6 },
    { x: -114.0, z: -118.5 },
    { x: -112.9, z: -109.4 },
    { x: -112.0, z: -101.2 },
    { x: -111.4, z: -93.4 },
    { x: -110.3, z: -85.4 },
    { x: -109.1, z: -78.0 },
    { x: -109.0, z: -77.0 },
    { x: -111.0, z: -75.4 },
    { x: -136.1, z: -76.0 },
    { x: -150.4, z: -76.6 },
    { x: -176.2, z: -77.6 },
    { x: -181.0, z: -78.0 },
    { x: -198.4, z: -78.4 },
    { x: -201.0, z: -78.4 },
  ],
  "kostka chodnika od fasad KP 56–60 do osi chodników w174600669 i w444111340 oraz do osi ul. Kołłątaja, w OSM chodniki (linie) kończą się 1–4 m przed fasadami",
  [null, "w174600669", "w174600669", "w444111340", "w444111340", "w335831606", "w335831606", "w335831606", "w335831606", "w288178956", ...Array<null>(15).fill(null)],
);

/**
 * The pavement along the north frontage of KP 54, 52 and 50 between the walls and Plac Litewski
 * r10460232 (its edge on its nodes), round KP 54's corner and down its west wall over the
 * arcade's footway w720933804 to the axis of Kołłątaja, and down KP 50's east wall to the steps
 * w503077033.
 */
const FRONT_KP50: AddedArea = yard(
  "chodnik-kp50-54",
  SETTS,
  [
    { x: -100.31, z: -71.65 },
    { x: -93.09, z: -72.15 },
    { x: -93.13, z: -74.03 },
    { x: -91.45, z: -73.81 },
    { x: -81.29, z: -72.47 },
    { x: 2.87, z: -68.62 },
    { x: 3.01, z: -71.0 },
    { x: -0.3, z: -71.0 },
    { x: -24.9, z: -70.9 },
    { x: -60.4, z: -73.5 },
    { x: -80.8, z: -73.9 },
    { x: -88.2, z: -74.7 },
    { x: -90.5, z: -75.1 },
    { x: -92.3, z: -75.9 },
    { x: -93.8, z: -78.0 },
    { x: -95.9, z: -95.9 },
    { x: -96.52, z: -96.07 },
    { x: -97.57, z: -96.51 },
    { x: -102.19, z: -92.5 },
    { x: -100.49, z: -79.18 },
  ],
  "kostka chodnika od fasad KP 50–54 do krawędzi Placu Litewskiego i do osi ul. Kołłątaja, w OSM 0,3–3 m gołej ziemi przed fasadami",
  ["w335831606", "w757848425", "w757848425", "w757848425", "w757848425", "w757848425", ...Array<null>(10).fill(null), "w288178955", "w288178955", null, "w335831606"],
);

/** The strip between KP 50's east wall and the spike of Plac Czechowicza's square w505211283, south of the steps w503077033. */
const SIDE_KP50: AddedArea = yard(
  "chodnik-kp50-wschod",
  SETTS,
  [
    { x: 0.82, z: -88.28 },
    { x: 3.71, z: -82.66 },
    { x: 3.21, z: -74.4 },
    { x: -0.2, z: -74.4 },
    { x: 0.5, z: -82.9 },
    { x: 0.3, z: -84.0 },
  ],
  "kostka między wschodnią ścianą KP 50 a placem w505211283, w OSM goła ziemia",
  ["w505211283", "w505211283", null, null, null, null],
);

/** The yard behind KP 52 and 54, closed by them, Kołłątaja 2 w678986045 and the U of w678986044. */
const YARD_KP52: AddedArea = yard(
  "podworze-kp52",
  SETTS,
  [
    { x: -83.9, z: -95.0 },
    { x: -76.5, z: -92.8 },
    { x: -72.0, z: -90.5 },
    { x: -70.1, z: -88.9 },
    { x: -68.0, z: -91.5 },
    { x: -67.4, z: -92.6 },
    { x: -70.3, z: -107.0 },
    { x: -66.5, z: -109.0 },
    { x: -66.9, z: -111.1 },
    { x: -86.3, z: -109.5 },
    { x: -85.3, z: -100.6 },
    { x: -85.0, z: -99.6 },
    { x: -84.8, z: -95.6 },
  ],
  "podwórze za KP 52 i 54 zamknięte budynkami, w OSM bez obszaru",
);

/**
 * The pavement along the north frontage of Krakowskie Przedmieście from the chunk's west edge to 3
 * Maja (KP 41, 39 and the bank, 37) and up the bank's east wall to the driveway w757848898: from
 * the walls over the sidewalks w174600674, w444111339 and w444111338 to the axes of the street
 * w154962958 and of 3 Maja w40050974, round the shrub beds w995053496 and w995053495 on their nodes.
 */
const FRONT_KP37: AddedArea = yard(
  "chodnik-kp37-41",
  SETTS,
  [
    { x: -201.0, z: -63.97 },
    { x: -196.9, z: -63.71 },
    { x: -193.19, z: -56.77 },
    { x: -194.61, z: -54.53 },
    { x: -172.18, z: -53.07 },
    { x: -170.59, z: -55.42 },
    { x: -167.57, z: -61.85 },
    { x: -164.19, z: -54.9 },
    { x: -165.59, z: -52.72 },
    { x: -142.91, z: -51.24 },
    { x: -141.29, z: -53.71 },
    { x: -128.76, z: -59.39 },
    { x: -103.87, z: -57.68 },
    { x: -106.73, z: -44.94 },
    { x: -109.63, z: -23.62 },
    { x: -110.68, z: -13.15 },
    { x: -118.76, z: -13.16 },
    { x: -121.4, z: -13.2 },
    { x: -122.4, z: -42.5 },
    { x: -125.6, z: -46.1 },
    { x: -155.6, z: -46.2 },
    { x: -181.9, z: -47.0 },
    { x: -187.0, z: -47.1 },
    { x: -187.6, z: -45.4 },
    { x: -194.0, z: -45.6 },
    { x: -194.8, z: -47.5 },
    { x: -201.0, z: -47.6 },
  ],
  "kostka chodnika od fasad KP 37–41 do jezdni Krakowskiego Przedmieścia i ul. 3 Maja, w OSM chodniki (linie) kończą się 0,5–2 m przed fasadami i przed klombami",
  [
    null,
    "w154962958",
    "w995053496",
    "w995053496",
    "w995053496",
    "w995053496",
    "w154962958",
    "w995053495",
    "w995053495",
    "w995053495",
    "w995053495",
    "w154962958",
    "w40050974",
    "w40050974",
    "w40050974",
    "w40050974",
    "w757848898",
    ...Array<null>(10).fill(null),
  ],
);

/**
 * The pavement along the north frontage of Peowiaków from Aurum to Peowiaków 11 (the town hall's
 * offices on 13 between): from the walls to the axis of the footway w288178955, on to T-221's piece
 * at w69672557's corner.
 */
const FRONT_RATUSZ: AddedArea = yard(
  "chodnik-peowiakow-13",
  SETTS,
  [
    { x: -17.98, z: -180.35 },
    { x: -20.6, z: -179.54 },
    { x: -48.82, z: -170.67 },
    { x: -77.45, z: -163.66 },
    { x: -81.87, z: -162.59 },
    { x: -81.8, z: -159.9 },
    { x: -73.6, z: -161.9 },
    { x: -73.2, z: -162.6 },
    { x: -54.0, z: -166.9 },
    { x: -43.5, z: -168.4 },
    { x: -42.9, z: -169.9 },
    { x: -17.6, z: -177.7 },
    { x: -17.39, z: -178.45 },
  ],
  "kostka chodnika ul. Peowiaków od fasad Aurum, Urzędu Miasta (nr 13) i nr 11 do osi chodnika w288178955, w OSM chodnik (linia) kończy się 0,5–1 m przed fasadami",
  [null, "w288178955", "w288178955", "w288178955", "w288178955", ...Array<null>(7).fill(null), "w69672557"],
);

/** The added areas of this file, in draw order. */
export const KRAKOWSKIE_AREAS: readonly AddedArea[] = [
  BLOCK_KP50,
  YARD_KP39,
  YARD_KP41,
  YARD_KP37,
  FRONT_KP56,
  FRONT_KP50,
  SIDE_KP50,
  YARD_KP52,
  FRONT_KP37,
  FRONT_RATUSZ,
];
