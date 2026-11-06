/**
 * Added areas east of the Dworzec Autobusowy (ADR-0042), the tail of `ADDED_AREAS`: kept apart so
 * `corrections.ts` stays within ADR-0031's 500 lines. Drawn after the areas there.
 */
import type { AddedArea } from "./corrections.ts";
import type { Pt } from "./geometry.ts";

/**
 * The edge between the setts and the lawn east of the Dworzec's pavilions (T-185), west to east: from
 * T-170's corner at x 870 along the slab's south and east edges and the lawn's north edge to the
 * pavilion w458298769's north-west corner.
 */
const EAST_LAWN_EDGE: readonly Pt[] = [
  { x: 870.0, z: 363.19 },
  { x: 882.75, z: 364.0 },
  { x: 882.75, z: 369.75 },
  { x: 893.75, z: 369.75 },
  { x: 893.75, z: 367.1 },
  { x: 898.63, z: 366.51 },
];
const LAWN_EDGE_NODES: readonly (string | null)[] = [null, null, null, null, null, "w458298769"];

/**
 * The kerb between the setts and the asphalt east of the Dworzec's stands (T-185), from the
 * orthophoto (PZGiK), south to north: from the footway w227698409's node by the crossing round the
 * junction's arc, along Cerkiewna (the sidewalk's east edge) and round the stands' north-east corner
 * to the stall line that meets the asphalt w66323033's corner at x 901.69.
 */
const EAST_KERB: readonly Pt[] = [
  { x: 906.0, z: 348.0 },
  { x: 907.7, z: 350.0 },
  { x: 908.8, z: 352.0 },
  { x: 910.4, z: 356.0 },
  { x: 910.7, z: 358.0 },
  { x: 911.3, z: 362.0 },
  { x: 912.0, z: 365.0 },
  { x: 911.75, z: 368.25 },
  { x: 910.75, z: 370.0 },
  { x: 909.0, z: 372.0 },
  { x: 906.25, z: 375.0 },
  { x: 902.3, z: 379.6 },
];

export const DWORZEC_EAST_AREAS: readonly AddedArea[] = [
  {
    // The wedge between the sidewalk w1435832518 and the cycleway w1435832523 east of T-165, beige
    // setts with the bus stop's shelter w672635871 on the orthophoto (PZGiK), bare in OSM. Both ways
    // are drawn over it; it meets T-165/chodnik-tysiaclecia and T-173/chodnik-tysiaclecia-wschod on
    // their edges. Every corner is the map's node.
    id: "T-184/klin-przystanku",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      { x: 804.67, z: 360.04 },
      { x: 838.98, z: 355.26 },
      { x: 850.34, z: 355.9 },
      { x: 839.01, z: 360.04 },
      { x: 805.33, z: 364.6 },
    ],
    nodesOf: ["w1435832518", "w1435832518", "w1435832518", "w1435832523", "w1435832523"],
    reason: "beżowa kostka przystanku z wiatą między chodnikiem a drogą rowerową na wschód od Dworca na ortofoto PZGiK, w OSM tylko linie ścieżek",
    ref: "T-184",
  },
  {
    // The Dworzec's stands east of x 870 (T-170 ends there), setts on the orthophoto (PZGiK), bare in
    // OSM: from the pavilions' block (T-170's east side) north to the stands' asphalt w66323033, round
    // the kerb in its north-east corner and down Cerkiewna's kerb (past it T-185/wjazd-stanowisk-wschod)
    // to the crossing by the path w1435832524, with the sidewalk of the footway w227698409's bend:
    // below z 364.5 that is past the register's box, but the same pavement. The concrete slab by the pavilions is laid as setts; the
    // lawn between it and the pavilion w458298769 is T-185/trawnik-wschod, whose edge, off the nodes,
    // is from the orthophoto. Its corner at x 893.75 is the west edge of a roofed kiosk OSM lacks,
    // on the line of the pavilion's north wall.
    id: "T-185/plac-stanowisk-wschod",
    tags: { "area:highway": "pedestrian", surface: "paving_stones" },
    ring: [
      ...EAST_LAWN_EDGE,
      { x: 906.58, z: 365.54 },
      { x: 910.7, z: 365.08 },
      { x: 909.6, z: 358.39 },
      { x: 909.15, z: 356.12 },
      { x: 907.59, z: 352.04 },
      { x: 904.19, z: 347.29 },
      ...EAST_KERB,
      { x: 901.69, z: 383.75 },
      { x: 898.88, z: 380.53 },
      { x: 895.68, z: 383.61 },
      { x: 893.21, z: 381.28 },
      { x: 890.2, z: 384.41 },
      { x: 887.52, z: 381.78 },
      { x: 884.58, z: 384.77 },
      { x: 882.11, z: 382.44 },
      { x: 879.19, z: 385.39 },
      { x: 877.09, z: 383.29 },
      { x: 874.64, z: 385.76 },
      { x: 872.4, z: 383.7 },
      { x: 869.82, z: 386.47 },
      { x: 870.0, z: 375.23 },
    ],
    nodesOf: [
      ...LAWN_EDGE_NODES,
      "w458298769",
      ...Array<string>(5).fill("w227698409"),
      ...EAST_KERB.map(() => null),
      ...Array<string>(13).fill("w66323033"),
      null,
    ],
    reason: "kostka placu i peronu na wschód od stanowisk Dworca Autobusowego, do asfaltu stanowisk i ul. Cerkiewnej, na ortofoto PZGiK, w OSM tylko linie chodników",
    ref: "T-185",
  },
  {
    // Past T-185's east kerb up to Cerkiewna w739432830's axis (drawn over it): the stands' entry
    // between the kerb in the north-east corner and the asphalt w66323033's corner, which OSM's area
    // stops 6 m short of, and the strip between the kerb and the street's band down to the crossing by
    // the path w1435832524 (the junction's arc). Asphalt on the orthophoto (PZGiK), so a carriageway's
    // area, not setts (as T-170/wjazd-stanowisk). Off the nodes: the kerb.
    id: "T-185/wjazd-stanowisk-wschod",
    tags: { "area:highway": "service", surface: "asphalt" },
    ring: [
      { x: 904.19, z: 347.29 },
      { x: 913.63, z: 345.89 },
      { x: 915.61, z: 361.18 },
      { x: 916.99, z: 373.15 },
      { x: 913.36, z: 373.5 },
      { x: 908.0, z: 380.55 },
      { x: 901.69, z: 383.75 },
      ...[...EAST_KERB].reverse(),
    ],
    nodesOf: ["w227698409", ...Array<string>(3).fill("w739432830"), ...Array<string>(3).fill("w66323033"), ...EAST_KERB.map(() => null)],
    reason: "asfalt za krawężnikiem placu na wschód od stanowisk Dworca Autobusowego: wjazd w północno-wschodnim narożniku i pas przy ul. Cerkiewnej, na ortofoto PZGiK, w OSM bez obszaru",
    ref: "T-185",
  },
  {
    // The lawn between the slab by the pavilions, the pavilion w458298769 and the footway w227698409's
    // bend, green on the orthophoto (PZGiK): grass, as a bed of the map. The path w227698420 is drawn
    // over its south edge (0.5 m south of the path's axis at x 870, as T-170/trawnik-pawilonow's); the
    // bed south of the path stays bare.
    id: "T-185/trawnik-wschod",
    tags: { landuse: "flowerbed" },
    ring: [
      { x: 870.0, z: 360.96 },
      { x: 909.15, z: 356.12 },
      { x: 909.6, z: 358.39 },
      { x: 910.7, z: 365.08 },
      { x: 906.58, z: 365.54 },
      ...[...EAST_LAWN_EDGE].reverse(),
    ],
    nodesOf: [null, "w227698420", "w227698409", "w227698409", "w458298769", ...[...LAWN_EDGE_NODES].reverse()],
    reason: "trawnik między płytą przy pawilonach a pawilonem na wschód od stanowisk Dworca Autobusowego na ortofoto PZGiK, w OSM bez obszaru",
    ref: "T-185",
  },
];
