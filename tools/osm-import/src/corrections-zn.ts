/**
 * Added areas in the yards and on the pavements of the block north of Krakowskie Przedmieście
 * between Żołnierzy Niepodległej, 3 Maja and Cicha (T-245, G-521, the cell `krakowskie-0-1`), the tail
 * of `ADDED_AREAS` after T-243's and laid the same way; kept apart so no file goes over ADR-0031's
 * 500 lines.
 *
 * OSM maps no surface there: the yards are bare land between the buildings, the driveways and the
 * footways lines. As in T-243, one area per yard or strip, its corners 0.3-0.7 m inside the walls
 * round it (the building is drawn over the paving) and on the axes of the streets and footways beside
 * it (their bands are drawn over it); where it meets a lawn, a square or another added area it runs
 * on their nodes or their edges. Where the orthophoto (PZGiK) shows trees or a lawn the map lacks,
 * the area is a lawn.
 */
import type { AddedArea } from "./corrections.ts";
import { SETTS } from "./corrections-krakowskie.ts";
import type { Pt } from "./geometry.ts";

/** A lawn the map lacks: drawn under the paths and the paving round it. */
export const GRASS = { landuse: "grass" } as const;

/** An added area of T-245: corners off the map's nodes unless `nodesOf` names the ways. */
export const t245 = (name: string, tags: AddedArea["tags"], ring: readonly Pt[], reason: string, nodesOf?: readonly (string | null)[]): AddedArea => ({
  id: `T-245/${name}`,
  tags,
  ring,
  nodesOf: nodesOf ?? ring.map(() => null),
  reason,
  ref: "T-245",
});

/**
 * The grounds of Litevski Art Residence (Żołnierzy Niepodległej 4) round its west, north and east walls:
 * the driveway w181172336 to its garage on the west (to x -197, where `LITEVSKI_GREEN` begins), the
 * forecourt to the footway w233257773's axis and the passage with the driveway w181172345 to Żołnierzy
 * Niepodległej 2. South of the line of its south wall `ZN2_SOUTH` takes over.
 */
const YARD_LITEVSKI: AddedArea = t245(
  "podworze-litevski",
  SETTS,
  [
    { x: -197.0, z: 51.29 },
    { x: -193.63, z: 51.01 },
    { x: -164.12, z: 49.4 },
    { x: -158.52, z: 49.01 },
    { x: -158.4, z: 31.43 },
    { x: -166.7, z: 30.89 },
    { x: -166.8, z: 45.62 },
    { x: -191.31, z: 41.97 },
    { x: -191.39, z: 34.49 },
    { x: -187.91, z: 34.39 },
    { x: -187.79, z: 27.1 },
    { x: -191.29, z: 27.1 },
    { x: -191.11, z: 14.5 },
    { x: -194.5, z: 14.5 },
    { x: -194.5, z: 27.0 },
    { x: -197.0, z: 27.0 },
  ],
  "kostka podjazdu i dziedzińca wokół Litevski Art Residence (Żołnierzy Niepodległej 4) do osi chodnika w233257773, w OSM goła ziemia",
  [null, "w233257773", "w233257773", ...Array<null>(13).fill(null)],
);

/**
 * The green west of Litevski Art Residence (orthophoto, PZGiK): the strip of grass and shrubs along the
 * chunk's west edge from the footway w233257773's axis to the trees south-west of the building, west of
 * its garage ramp, and the trees on to Żołnierzy Niepodległej 6's north wall.
 */
const LITEVSKI_GREEN: AddedArea = t245(
  "zielen-litevski",
  GRASS,
  [
    { x: -201.0, z: 5.23 },
    { x: -201.0, z: 51.61 },
    { x: -197.0, z: 51.29 },
    { x: -197.0, z: 27.0 },
    { x: -194.5, z: 27.0 },
    { x: -194.5, z: 14.5 },
    { x: -192.0, z: 14.5 },
    { x: -192.0, z: 5.53 },
  ],
  "pas trawy z krzewami i drzewa na zachód i południowy zachód od Litevski Art Residence do ściany Żołnierzy Niepodległej 6 na ortofoto PZGiK, w OSM goła ziemia",
);

/**
 * The strip south of Litevski Art Residence along KP 39b and Żołnierzy Niepodległej 6 east of the trees
 * (`LITEVSKI_GREEN`, x -192), round the notch in 39b's north wall, and the yard between Żołnierzy
 * Niepodległej 2, the bank's wing (KP 37) and 3 Maja 2, up to T-243's KP 37 yard on its corners.
 */
const ZN2_SOUTH: AddedArea = t245(
  "podworze-zn2-poludnie",
  SETTS,
  [
    { x: -192.0, z: 14.5 },
    { x: -166.6, z: 14.5 },
    { x: -166.7, z: 30.89 },
    { x: -152.32, z: 31.83 },
    { x: -151.92, z: 21.02 },
    { x: -142.7, z: 20.8 },
    { x: -142.2, z: 16.9 },
    { x: -146.49, z: 14.61 },
    { x: -154.2, z: 14.69 },
    { x: -154.27, z: 6.92 },
    { x: -160.6, z: 6.72 },
    { x: -160.6, z: 2.22 },
    { x: -175.18, z: 1.58 },
    { x: -175.38, z: 5.99 },
    { x: -186.89, z: 5.7 },
    { x: -192.0, z: 5.53 },
  ],
  "utwardzony pas na południe od Litevski Art Residence i podwórze między Żołnierzy Niepodległej 2, KP 39b i bankiem KP 37 do podwórza T-243/podworze-kp37, w OSM goła ziemia",
);

/**
 * East of Żołnierzy Niepodległej 2 up to the footway w1380056200: the café's terrace w1380056201 round
 * the lawn w1380056202 (on its nodes; north of the lawn `ZN2_EAST_MIDDLE` takes over), and the strip
 * along the east walls of 3 Maja 2 and the bank to the sidewalk w444111338's axis, down to T-243's
 * pavement `chodnik-kp37-41` (0.06 m north of its drawn edge, which the import rounds and straightens).
 */
const ZN2_EAST_SOUTH: AddedArea = t245(
  "zn2-wschod-poludnie",
  SETTS,
  [
    { x: -142.7, z: 20.8 },
    { x: -143.61, z: 32.24 },
    { x: -130.62, z: 32.16 },
    { x: -130.57, z: 26.6 },
    { x: -122.75, z: 26.65 },
    { x: -122.71, z: 21.67 },
    { x: -120.65, z: 21.64 },
    { x: -120.46, z: 32.1 },
    { x: -118.29, z: 32.1 },
    { x: -118.76, z: -13.1 },
    { x: -121.49, z: -13.2 },
    { x: -121.4, z: -10.39 },
    { x: -121.2, z: 20.1 },
  ],
  "kostka ogródka kawiarni w1380056201 wokół trawnika w1380056202 i pas wzdłuż wschodnich ścian 3 Maja 2 i KP 37 do osi chodnika w444111338, w OSM bez nawierzchni",
  [...Array<null>(3).fill(null), "w1380056202", "w1380056202", "w1380056202", "w1380056202", "w1380056200", "w1380056200", ...Array<null>(4).fill(null)],
);

/**
 * North of the footway w1380056200: from the east and north walls of Żołnierzy Niepodległej 2 to the
 * line of the lawn w1380056205's west edge and to the footway w233257773's axis.
 */
const ZN2_EAST_WEST: AddedArea = t245(
  "zn2-wschod-zachod",
  SETTS,
  [
    { x: -143.61, z: 32.24 },
    { x: -144.08, z: 45.23 },
    { x: -158.5, z: 46.07 },
    { x: -158.52, z: 49.01 },
    { x: -131.97, z: 47.18 },
    { x: -131.91, z: 32.17 },
  ],
  "kostka dziedzińca na wschód i północ od Żołnierzy Niepodległej 2 do osi chodników w1380056200 i w233257773, w OSM goła ziemia",
);

/**
 * Between the lawns w1380056205 and w1380056204, round both on their nodes: north of w1380056202, under
 * w1380056205 to the footway w1380056200, up to the axes of the footway w233257773 and the sidewalk
 * w444111330. Each lawn is a bay of one area, so no area has a hole.
 */
const ZN2_EAST_MIDDLE: AddedArea = t245(
  "zn2-wschod-srodek",
  SETTS,
  [
    { x: -130.6, z: 30.18 },
    { x: -124.69, z: 30.17 },
    { x: -124.75, z: 39.33 },
    { x: -122.4, z: 40.92 },
    { x: -120.32, z: 38.7 },
    { x: -118.22, z: 38.35 },
    { x: -118.22, z: 42.29 },
    { x: -120.42, z: 44.27 },
    { x: -122.83, z: 46.54 },
    { x: -126.22, z: 46.78 },
    { x: -131.97, z: 47.18 },
    { x: -131.96, z: 45.2 },
    { x: -126.2, z: 44.96 },
    { x: -124.17, z: 42.8 },
    { x: -128.04, z: 40.56 },
    { x: -128.04, z: 33.91 },
    { x: -131.92, z: 33.97 },
    { x: -131.91, z: 32.17 },
    { x: -130.62, z: 32.16 },
  ],
  "kostka między trawnikami w1380056205 i w1380056204 do osi chodników przy Żołnierzy Niepodległej i 3 Maja, w OSM goła ziemia",
  ["w1380056202", null, "w1380056204", "w1380056204", "w1380056204", "w444111330", "w444111330", "w444111330", "w444111330", "w233257773", null, "w1380056205", "w1380056205", "w1380056205", "w1380056205", "w1380056205", "w1380056205", ...Array<null>(2).fill(null)],
);

/**
 * East of the lawn w1380056204 and under it, to the sidewalk w444111338's axis.
 */
const ZN2_EAST_LAWN: AddedArea = t245(
  "zn2-wschod-trawnik",
  SETTS,
  [
    { x: -124.69, z: 30.17 },
    { x: -120.5, z: 30.17 },
    { x: -120.46, z: 32.1 },
    { x: -118.29, z: 32.1 },
    { x: -118.22, z: 38.35 },
    { x: -120.32, z: 38.7 },
    { x: -120.43, z: 33.68 },
    { x: -124.71, z: 33.68 },
  ],
  "kostka na wschód i południe od trawnika w1380056204 do osi chodnika w444111338, w OSM goła ziemia",
  [null, "w1380056202", "w1380056200", "w1380056200", "w444111338", "w1380056204", "w1380056204", "w1380056204"],
);

/**
 * The pavement before Żołnierzy Niepodległej 1 and 3 and 3 Maja 6, 8 and 10: from the walls to the axes
 * of Żołnierzy Niepodległej w107667221 and of 3 Maja's west carriageway w235323974 (their bands and the
 * footways w233249209 and w444111331 drawn over it), from x -171 (west of it the street's band reaches
 * the footway) round the corner to the line of 3 Maja 10's north wall.
 */
const FRONT_ZN_3MAJA: AddedArea = t245(
  "chodnik-zn-3-maja",
  SETTS,
  [
    { x: -171.0, z: 54.58 },
    { x: -171.0, z: 62.39 },
    { x: -165.26, z: 61.9 },
    { x: -149.37, z: 60.7 },
    { x: -122.18, z: 59.51 },
    { x: -119.9, z: 61.53 },
    { x: -119.9, z: 63.86 },
    { x: -121.49, z: 65.16 },
    { x: -121.61, z: 69.98 },
    { x: -120.4, z: 70.69 },
    { x: -120.4, z: 73.78 },
    { x: -121.39, z: 74.67 },
    { x: -121.8, z: 90.3 },
    { x: -121.6, z: 113.02 },
    { x: -119.6, z: 135.78 },
    { x: -108.55, z: 134.05 },
    { x: -109.77, z: 115.66 },
    { x: -110.88, z: 91.37 },
    { x: -112.01, z: 67.01 },
    { x: -111.4, z: 57.94 },
    { x: -109.24, z: 49.72 },
    { x: -122.47, z: 50.68 },
    { x: -164.14, z: 54.07 },
  ],
  "kostka chodnika od fasad Żołnierzy Niepodległej 1–3 i 3 Maja 6–10 do osi jezdni Żołnierzy Niepodległej i 3 Maja, w OSM chodniki (linie) z gołą ziemią po obu stronach",
  [...Array<null>(16).fill(null), "w235323974", "w235323974", "w235323974", "w235323974", "w107667221", "w107667221", "w107667221"],
);

/**
 * The sidewalk at the bus stop on 3 Maja's east side, from the street's axis w757848901 (its band drawn
 * over it) to Plac Litewski's west edge on its nodes, between z -16 and the crossing w444111329.
 */
const STOP_3MAJA: AddedArea = t245(
  "chodnik-3-maja-przystanek",
  SETTS,
  [
    { x: -102.28, z: -16.0 },
    { x: -101.94, z: 15.49 },
    { x: -101.94, z: 23.43 },
    { x: -104.1, z: 32.98 },
    { x: -104.6, z: 38.83 },
    { x: -110.02, z: 38.56 },
    { x: -110.98, z: 18.1 },
    { x: -111.04, z: 1.19 },
    { x: -111.16, z: -5.1 },
    { x: -110.74, z: -12.59 },
    { x: -110.68, z: -13.15 },
    { x: -110.39, z: -16.0 },
  ],
  "kostka chodnika przy przystanku na wschodniej stronie 3 Maja od osi jezdni do krawędzi Placu Litewskiego, w OSM goła ziemia",
  ["w549693324", "w549693324", "w549693324", "w549693324", "w444111329", "w757848901", "w757848901", "w757848901", "w757848901", "w757848901", "w757848901", null],
);

/**
 * The yards of the block of Żołnierzy Niepodległej 1 and 3, the school w185132729, 3 Maja 6-10 and
 * Cicha 4: the yard inside Żołnierzy Niepodległej 3, the school's car park, the yard round w233249202
 * and the courtyard of 3 Maja 6, and the gate to Cicha (to its axis) between Cicha 4 and 3 Maja 10. The
 * light wells of 3 Maja 8 and 10 stay out (roofed or hidden on the orthophoto).
 */
const BLOCK_ZN3: AddedArea = t245(
  "podworze-zn3",
  SETTS,
  [
    { x: -170.94, z: 94.81 },
    { x: -174.71, z: 95.48 },
    { x: -175.93, z: 94.79 },
    { x: -176.89, z: 84.63 },
    { x: -176.0, z: 80.68 },
    { x: -173.95, z: 80.57 },
    { x: -174.18, z: 78.23 },
    { x: -173.43, z: 77.1 },
    { x: -174.94, z: 75.89 },
    { x: -179.8, z: 76.12 },
    { x: -179.8, z: 76.73 },
    { x: -184.24, z: 77.04 },
    { x: -184.15, z: 78.11 },
    { x: -187.76, z: 78.19 },
    { x: -188.16, z: 77.7 },
    { x: -191.86, z: 77.7 },
    { x: -191.96, z: 76.87 },
    { x: -199.02, z: 77.33 },
    { x: -198.88, z: 81.36 },
    { x: -197.27, z: 81.16 },
    { x: -196.93, z: 87.2 },
    { x: -197.84, z: 87.2 },
    { x: -197.21, z: 95.74 },
    { x: -198.98, z: 97.92 },
    { x: -187.67, z: 97.33 },
    { x: -186.73, z: 113.7 },
    { x: -187.92, z: 113.7 },
    { x: -187.67, z: 118.83 },
    { x: -170.65, z: 117.92 },
    { x: -169.95, z: 125.17 },
    { x: -156.12, z: 123.26 },
    { x: -152.45, z: 147.45 },
    { x: -146.12, z: 146.63 },
    { x: -148.1, z: 127.56 },
    { x: -148.8, z: 111.89 },
    { x: -148.41, z: 90.04 },
    { x: -137.54, z: 90.84 },
    { x: -137.24, z: 86.77 },
    { x: -135.22, z: 87.08 },
    { x: -134.69, z: 74.6 },
    { x: -136.3, z: 72.99 },
    { x: -140.57, z: 73.23 },
    { x: -140.67, z: 74.82 },
    { x: -143.7, z: 74.97 },
    { x: -143.7, z: 73.57 },
    { x: -148.03, z: 73.8 },
    { x: -153.9, z: 74.24 },
    { x: -153.9, z: 75.72 },
    { x: -157.33, z: 75.88 },
    { x: -157.43, z: 74.26 },
    { x: -160.86, z: 74.52 },
    { x: -162.79, z: 76.97 },
    { x: -161.94, z: 77.69 },
    { x: -163.27, z: 85.02 },
    { x: -161.5, z: 85.7 },
    { x: -162.39, z: 89.09 },
    { x: -163.6, z: 95.06 },
    { x: -162.92, z: 108.44 },
    { x: -170.03, z: 109.06 },
  ],
  "utwardzone podwórza kwartału Żołnierzy Niepodległej 1–3, szkoły, 3 Maja 6–10 i Cichej 4 z bramą do ul. Cichej, w OSM bez obszaru",
);

/**
 * The green west and north of the school w185132729 (orthophoto, PZGiK): the trees in its north-west
 * corner and the shrubs between the footway w80139555 and Cicha 4's west wall.
 */
const SCHOOL_GREEN: AddedArea = t245(
  "zielen-szkola",
  GRASS,
  [
    { x: -188.32, z: 125.25 },
    { x: -193.63, z: 125.57 },
    { x: -194.23, z: 114.39 },
    { x: -201.0, z: 114.59 },
    { x: -201.0, z: 131.0 },
    { x: -193.1, z: 131.0 },
    { x: -188.42, z: 147.5 },
    { x: -185.16, z: 144.38 },
  ],
  "zieleń pod drzewami na zachód od szkoły i krzewy między chodnikiem w80139555 a Cichą 4 na ortofoto PZGiK, w OSM goła ziemia",
  [...Array<null>(6).fill(null), "w80139555", null],
);

/**
 * The lane of Cicha north of the school (orthophoto, PZGiK: paving with cars parked on it) between the
 * east walls of Cicha 6 and 8, cut at the map's edge (G-556), and `SCHOOL_GREEN`'s strip, to the
 * carriageway of Cicha and the map's edge z = 160.
 */
const CICHA_LANE: AddedArea = t245(
  "pas-cichej",
  SETTS,
  [
    { x: -198.6, z: 131.0 },
    { x: -193.1, z: 131.0 },
    { x: -188.42, z: 147.5 },
    { x: -191.0, z: 151.0 },
    { x: -191.0, z: 160.0 },
    { x: -200.0, z: 160.0 },
    { x: -199.6, z: 159.6 },
    { x: -196.6, z: 159.1 },
    { x: -198.9, z: 138.8 },
    { x: -196.9, z: 138.0 },
  ],
  "kostka pasa Cichej z parkującymi autami między ścianami Cichej 6 i 8 a zielenią przy szkole, do jezdni Cichej i brzegu mapy, na ortofoto PZGiK; w OSM bez obszaru (G-556)",
);

/** The added areas of this file, in draw order. */
export const ZN_AREAS: readonly AddedArea[] = [
  YARD_LITEVSKI,
  LITEVSKI_GREEN,
  ZN2_SOUTH,
  ZN2_EAST_SOUTH,
  ZN2_EAST_WEST,
  ZN2_EAST_MIDDLE,
  ZN2_EAST_LAWN,
  FRONT_ZN_3MAJA,
  STOP_3MAJA,
  BLOCK_ZN3,
  SCHOOL_GREEN,
  CICHA_LANE,
];
