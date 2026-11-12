/**
 * Added areas round the clinic on Radziwiłłowska 13 and the Collegium on Radziwiłłowska 11 (T-245,
 * G-521), after `corrections-zn.ts`'s and laid the same way: OSM maps the buildings in the hospital's
 * and the university's grounds, a few lawns and the paths, and nothing between them.
 */
import type { AddedArea } from "./corrections.ts";
import { T243_AREAS } from "./corrections-ck.ts";
import { SETTS } from "./corrections-krakowskie.ts";
import { GRASS, ZN_AREAS, t245 } from "./corrections-zn.ts";

/**
 * The lawn north of the clinic on Radziwiłłowska 13 (orthophoto, PZGiK): from the strip w1011367940 to
 * the forecourt's edge, the paths w1011367932 and w1011367937 on their nodes.
 */
const CLINIC_LAWN: AddedArea = t245(
  "trawnik-klinika",
  GRASS,
  [
    { x: -90.91, z: 147.35 },
    { x: -90.51, z: 153.15 },
    { x: -78.75, z: 152.05 },
    { x: -78.04, z: 151.18 },
    { x: -77.35, z: 150.25 },
    { x: -76.34, z: 149.4 },
    { x: -75.35, z: 148.78 },
    { x: -74.1, z: 148.19 },
    { x: -72.73, z: 147.84 },
    { x: -71.64, z: 147.67 },
    { x: -70.39, z: 147.64 },
    { x: -69.14, z: 147.84 },
    { x: -67.68, z: 148.24 },
    { x: -66.3, z: 148.76 },
    { x: -65.04, z: 149.52 },
    { x: -63.76, z: 150.78 },
    { x: -59.84, z: 150.45 },
    { x: -60.41, z: 144.85 },
  ],
  "trawnik między północną ścianą kliniki przy Radziwiłłowskiej 13 a podjazdem na ortofoto PZGiK, w OSM goła ziemia",
  [...Array<null>(2).fill(null), "w1011367932", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367932", null],
);

/**
 * The clinic's forecourt: the turning loop w1022724910 (`highway=service` with `area=yes`, asphalt,
 * which the import does not draw, G-555) on its nodes, and the paving in the curve of the path
 * w1011367937 east to the service way w1011367931's axis. Setts, as T-243's asphalt yards.
 */
const CLINIC_DRIVE: AddedArea = t245(
  "podjazd-klinika",
  SETTS,
  [
    { x: -78.75, z: 152.05 },
    { x: -78.04, z: 151.18 },
    { x: -77.35, z: 150.25 },
    { x: -76.34, z: 149.4 },
    { x: -75.35, z: 148.78 },
    { x: -74.1, z: 148.19 },
    { x: -72.73, z: 147.84 },
    { x: -71.64, z: 147.67 },
    { x: -70.39, z: 147.64 },
    { x: -69.14, z: 147.84 },
    { x: -67.68, z: 148.24 },
    { x: -66.3, z: 148.76 },
    { x: -65.04, z: 149.52 },
    { x: -63.76, z: 150.78 },
    { x: -59.84, z: 150.45 },
    { x: -47.83, z: 149.44 },
    { x: -47.74, z: 151.5 },
    { x: -63.95, z: 152.96 },
    { x: -63.78, z: 154.94 },
    { x: -64.37, z: 155.71 },
    { x: -64.96, z: 156.4 },
    { x: -65.6, z: 157.0 },
    { x: -66.23, z: 157.55 },
    { x: -67.0, z: 158.08 },
    { x: -67.77, z: 158.52 },
    { x: -68.66, z: 158.96 },
    { x: -69.63, z: 159.35 },
    { x: -70.71, z: 159.38 },
    { x: -72.13, z: 159.44 },
    { x: -72.95, z: 159.35 },
    { x: -73.8, z: 159.07 },
    { x: -74.57, z: 158.77 },
    { x: -75.35, z: 158.38 },
    { x: -76.1, z: 157.98 },
    { x: -76.93, z: 157.36 },
    { x: -77.56, z: 156.83 },
    { x: -78.21, z: 156.14 },
    { x: -78.37, z: 154.2 },
    { x: -78.49, z: 152.57 },
  ],
  "kostka (w rzeczywistości asfalt) podjazdu przed kliniką: pętla w1022724910 (highway=service, area=yes, import jej nie rysuje, G-555) i nawierzchnia w łuku ścieżki w1011367937 do osi drogi serwisowej w1011367931",
  ["w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1011367937", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910", "w1022724910"],
);

/**
 * 3 Maja's east sidewalk by the clinic, from w232674453's axis to the strip w1011367940, on their nodes.
 * Setts: a lawn here lay on the sidewalk's light paving, its bollards and lamps (orthophoto, PZGiK, 2% green,
 * G-667); the green is in the strips west of the sidewalk and along w1011367940.
 */
const SIDEWALK_3MAJA_CLINIC: AddedArea = t245(
  "kostka-3-maja-klinika",
  SETTS,
  [
    { x: -93.32, z: 130.96 },
    { x: -91.75, z: 155.21 },
    { x: -94.08, z: 155.21 },
    { x: -94.5, z: 150.07 },
    { x: -94.6, z: 142.98 },
    { x: -95.13, z: 132.68 },
  ],
  "kostka chodnika 3 Maja od osi w232674453 do pasa trawy w1011367940 (wcześniej trawnik, G-667), w OSM goła ziemia",
  ["w1011367940", "w1011367940", null, "w232674453", "w232674453", "w232674453"],
);

/**
 * North of the Collegium on Radziwiłłowska 11: the yard between its wall and the lawns w1011367930 and
 * w1011367929 (on their nodes), round the bed `COLLEGIUM_NORTH_BED`, and the path between w1011367929
 * and the annex, to the car park w681172446.
 */
const COLLEGIUM_NORTH: AddedArea = t245(
  "kolegium-polnoc",
  SETTS,
  [
    { x: -28.48, z: 149.51 },
    { x: -26.42, z: 150.21 },
    { x: -24.88, z: 151.37 },
    { x: -22.48, z: 152.21 },
    { x: -21.38, z: 150.54 },
    { x: -13.39, z: 149.92 },
    { x: -11.97, z: 151.15 },
    { x: -11.11, z: 166.02 },
    { x: -9.88, z: 165.99 },
    { x: -8.88, z: 159.05 },
    { x: -4.68, z: 158.65 },
    { x: -5.22, z: 142.96 },
    { x: -13.0, z: 143.61 },
    { x: -13.0, z: 147.8 },
    { x: -21.0, z: 147.8 },
    { x: -21.0, z: 144.28 },
    { x: -27.93, z: 144.86 },
  ],
  "kostka dziedzińca na północ od Collegium przy Radziwiłłowskiej 11 i ścieżki między trawnikiem w1011367929 a skrzydłem, w OSM goła ziemia",
  ["w1011367930", "w1011367930", "w1011367930", "w1011367929", "w1011367929", "w1011367929", "w1011367929", "w1011367929", "w681172446", ...Array<null>(8).fill(null)],
);

/**
 * The bed against the Collegium's north wall (orthophoto, PZGiK), in the shadow of the building: a lawn.
 */
const COLLEGIUM_NORTH_BED: AddedArea = t245(
  "rabata-kolegium-polnoc",
  GRASS,
  [
    { x: -21.0, z: 144.28 },
    { x: -21.0, z: 147.8 },
    { x: -13.0, z: 147.8 },
    { x: -13.0, z: 143.61 },
  ],
  "rabata przy północnej ścianie Collegium na ortofoto PZGiK, w OSM goła ziemia",
);

/**
 * The Collegium's east yard between its wing, its annex, the church (Niecała 4) and Niecała 4, with the
 * service way w1283047066, up to the chunk's east edge: krakowskie-1-1 beyond keeps its ground.
 */
const COLLEGIUM_EAST: AddedArea = t245(
  "kolegium-wschod",
  SETTS,
  [
    { x: 20.0, z: 139.19 },
    { x: 5.86, z: 140.13 },
    { x: 7.46, z: 161.58 },
    { x: 11.07, z: 159.77 },
    { x: 9.5, z: 152.87 },
    { x: 16.62, z: 151.19 },
    { x: 20.0, z: 150.29 },
  ],
  "utwardzone podwórze między skrzydłami Collegium, kościołem i domem przy Niecałej 4, w OSM goła ziemia",
);

/**
 * The Collegium's south and west: the ramp and the paving along its walls to the sidewalk w232674453's
 * axis, round the beds w1011367948 (on its nodes) and `COLLEGIUM_SOUTH_BED`, and up the west wall to the
 * lawn w1011367930, up to the chunk's east edge.
 */
const COLLEGIUM_SOUTH: AddedArea = t245(
  "kolegium-poludnie",
  SETTS,
  [
    { x: -31.9, z: 136.0 },
    { x: -30.09, z: 143.16 },
    { x: -28.04, z: 143.2 },
    { x: -28.87, z: 130.56 },
    { x: -18.84, z: 129.74 },
    { x: -18.64, z: 131.33 },
    { x: 19.2, z: 128.67 },
    { x: 19.2, z: 127.36 },
    { x: 20.0, z: 127.28 },
    { x: 20.0, z: 126.0 },
    { x: 13.0, z: 126.0 },
    { x: 13.0, z: 123.0 },
    { x: 20.0, z: 123.0 },
    { x: 20.0, z: 121.19 },
    { x: 6.58, z: 122.03 },
    { x: 6.66, z: 124.31 },
    { x: 4.29, z: 125.32 },
    { x: -4.11, z: 126.04 },
    { x: -6.7, z: 125.17 },
    { x: -6.76, z: 122.39 },
    { x: -12.26, z: 122.59 },
    { x: -32.63, z: 123.54 },
    { x: -34.5, z: 123.63 },
    { x: -34.5, z: 136.72 },
  ],
  "kostka i rampa wzdłuż południowej i zachodniej ściany Collegium do osi chodnika w232674453, w OSM goła ziemia",
  ["w1011367930", "w1011367930", ...Array<null>(13).fill(null), "w1011367948", "w1011367948", "w1011367948", "w1011367948", null, "w232674453", "w232674453", ...Array<null>(2).fill(null)],
);

/**
 * The shrub bed east of the steps south of the Collegium (orthophoto, PZGiK), which OSM lacks.
 */
const COLLEGIUM_SOUTH_BED: AddedArea = t245(
  "rabata-kolegium-poludnie",
  GRASS,
  [
    { x: 13.0, z: 123.0 },
    { x: 20.0, z: 123.0 },
    { x: 20.0, z: 126.0 },
    { x: 13.0, z: 126.0 },
  ],
  "rabata z krzewami na wschód od schodów przed Collegium na ortofoto PZGiK, w OSM goła ziemia",
);

/** T-245's added areas in draw order: `corrections-zn.ts`'s, then this file's. */
export const T245_AREAS: readonly AddedArea[] = [...ZN_AREAS, CLINIC_LAWN, CLINIC_DRIVE, SIDEWALK_3MAJA_CLINIC, COLLEGIUM_NORTH, COLLEGIUM_NORTH_BED, COLLEGIUM_EAST, COLLEGIUM_SOUTH, COLLEGIUM_SOUTH_BED];

/** Krakowskie Przedmieście's added areas in draw order, the tail of `ADDED_AREAS`: T-243's, then T-245's. */
export const KRAKOWSKIE_ADDED_AREAS: readonly AddedArea[] = [...T243_AREAS, ...T245_AREAS];
