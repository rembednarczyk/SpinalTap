/**
 * Added areas round the Centrum Kultury on Peowiaków 12 (T-243, G-513), the tail of `ADDED_AREAS`
 * after `corrections-krakowskie.ts`'s and laid the same way: kept apart so neither file goes over
 * ADR-0031's 500 lines. The building stands in `landuse=commercial` w1550442710 with no surface
 * between its walls and the lawns, paths and car park round it.
 */
import type { AddedArea } from "./corrections.ts";
import { KRAKOWSKIE_AREAS, SETTS, yard } from "./corrections-krakowskie.ts";

/**
 * The lawn of Plac Lecha Kaczyńskiego w67884913 up to the Centrum Kultury's main west wall, as on
 * the orthophoto (PZGiK), where the park's edge stops 2-4 m short of it: from the edge (on its
 * nodes) to the wall, south to the corner of the west wing.
 */
const CK_WEST_LAWN: AddedArea = yard(
  "ck-zachod-trawnik",
  { landuse: "grass" },
  [
    { x: -150.73, z: -188.55 },
    { x: -160.15, z: -213.55 },
    { x: -158.0, z: -221.0 },
    { x: -157.0, z: -222.0 },
    { x: -150.0, z: -205.0 },
    { x: -147.5, z: -198.0 },
    { x: -149.64, z: -189.58 },
  ],
  "trawnik Placu Lecha Kaczyńskiego do zachodniej ściany głównego gmachu Centrum Kultury na ortofoto PZGiK, w OSM park kończy się 2–4 m przed ścianą",
  ["w67884913", "w67884913", null, null, null, null, "w67884882"],
);

/**
 * The paving round the Centrum Kultury's west wing between its walls, Plac Lecha Kaczyńskiego
 * w67884913 (its edge on its nodes) and the car park w356947938 by the wing's south wall; east of
 * the wing's north-east corner the lawn `CK_WEST_LAWN` meets it.
 */
const CK_WEST: AddedArea = yard(
  "ck-zachod",
  SETTS,
  [
    { x: -160.15, z: -213.55 },
    { x: -188.74, z: -203.62 },
    { x: -191.39, z: -204.61 },
    { x: -195.08, z: -214.83 },
    { x: -167.28, z: -224.95 },
    { x: -166.11, z: -221.89 },
    { x: -160.36, z: -223.75 },
    { x: -157.0, z: -222.0 },
    { x: -158.0, z: -221.0 },
  ],
  "kostka wokół zachodniego skrzydła Centrum Kultury między ścianami a Placem Lecha Kaczyńskiego i parkingiem w356947938, w OSM goła ziemia w obszarze landuse=commercial",
  ["w67884913", "w67884913", "w67884913", "w67884913", null, "w356947938", "w356947938", null, null],
);

/**
 * The paving along the Centrum Kultury's south wall over the path w1550442735 to the lawns
 * w890775822 and w890775823 and west of them, round the recycling shed w1150964903, to the service
 * way w316906582's axis, and in the slit between the wall and the car park w356947938: the lawns'
 * and the car park's edges on their nodes.
 */
const CK_SOUTH: AddedArea = yard(
  "ck-poludnie",
  SETTS,
  [
    { x: -146.19, z: -268.99 },
    { x: -145.5, z: -266.47 },
    { x: -158.04, z: -261.56 },
    { x: -160.54, z: -260.7 },
    { x: -168.81, z: -257.41 },
    { x: -169.33, z: -257.61 },
    { x: -171.21, z: -262.65 },
    { x: -169.7, z: -263.3 },
    { x: -172.1, z: -269.4 },
    { x: -172.2, z: -271.0 },
    { x: -183.59, z: -271.0 },
    { x: -181.12, z: -258.54 },
    { x: -181.15, z: -255.29 },
    { x: -182.12, z: -252.13 },
    { x: -185.0, z: -250.21 },
    { x: -183.89, z: -244.09 },
    { x: -172.87, z: -247.8 },
    { x: -170.72, z: -242.0 },
    { x: -167.74, z: -243.2 },
    { x: -160.36, z: -223.75 },
    { x: -159.2, z: -224.0 },
    { x: -166.8, z: -244.6 },
    { x: -169.9, z: -244.2 },
    { x: -172.4, z: -251.6 },
    { x: -138.5, z: -264.6 },
    { x: -126.0, z: -269.4 },
    { x: -126.0, z: -271.0 },
    { x: -146.6, z: -271.0 },
  ],
  "kostka wzdłuż południowej ściany Centrum Kultury do trawników w890775822 i w890775823 i drogi serwisowej w316906582, z wiatą śmietnikową w1150964903, i w szczelinie przy parkingu w356947938, w OSM goła ziemia w obszarze landuse=commercial",
  [
    "w890775822",
    "w890775822",
    "w890775822",
    "w890775823",
    "w890775823",
    "w890775823",
    "w890775823",
    "w890775823",
    "w890775823",
    null,
    null,
    "w316906582",
    "w316906582",
    "w316906582",
    "w316906582",
    "w356947938",
    "w356947938",
    "w356947938",
    "w356947938",
    "w356947938",
    ...Array<null>(8).fill(null),
  ],
);

/**
 * The way in to the car park w356947938 west of the Centrum Kultury: between the car park, the lobe
 * of Plac Lecha Kaczyńskiego w67884913 and the service way w316906582's axis, with the driveway
 * w356947940 and the sidewalk w479182656 over it; the car park's and the park's edges on their nodes.
 */
const CK_DRIVE: AddedArea = yard(
  "ck-podjazd",
  SETTS,
  [
    { x: -193.82, z: -237.61 },
    { x: -188.35, z: -239.17 },
    { x: -183.0, z: -240.7 },
    { x: -183.89, z: -244.09 },
    { x: -185.0, z: -250.21 },
    { x: -190.96, z: -248.75 },
    { x: -196.38, z: -247.67 },
    { x: -196.04, z: -245.12 },
    { x: -195.36, z: -242.03 },
  ],
  "utwardzony wjazd na parking w356947938 przy Centrum Kultury między parkingiem, Placem Lecha Kaczyńskiego i drogą serwisową w316906582, w OSM goła ziemia",
  ["w356947938", "w356947938", "w356947938", "w356947938", "w316906582", "w316906582", "w316906582", "w67884913", "w67884913"],
);

/** The pavement along the Centrum Kultury's east wall on Zesłańców Sybiru, from the wall to the axis of the footway w814972380. */
const CK_EAST: AddedArea = yard(
  "ck-wschod",
  SETTS,
  [
    { x: -107.14, z: -270.5 },
    { x: -106.43, z: -268.61 },
    { x: -86.54, z: -217.53 },
    { x: -85.64, z: -212.19 },
    { x: -87.05, z: -213.56 },
    { x: -88.4, z: -214.5 },
    { x: -90.5, z: -221.3 },
    { x: -93.3, z: -221.6 },
    { x: -110.2, z: -265.6 },
    { x: -107.6, z: -266.3 },
    { x: -109.2, z: -270.5 },
  ],
  "kostka chodnika ul. Zesłańców Sybiru od wschodniej ściany Centrum Kultury do osi chodnika w814972380, w OSM chodnik (linia) kończy się 2–3 m przed ścianą",
  [null, "w814972380", "w814972380", "w814972380", "w67884882", ...Array<null>(6).fill(null)],
);

/**
 * The kerb strip between the sidewalk w293369595 and Zesłańców Sybiru w347398147 by the Centrum
 * Kultury's north-east corner, north of the lawn w890775820: from the sidewalk's axis to the street's.
 */
const CK_KERB: AddedArea = yard(
  "ck-kraweznik",
  SETTS,
  [
    { x: -86.54, z: -217.53 },
    { x: -85.69, z: -217.79 },
    { x: -85.09, z: -217.98 },
    { x: -79.92, z: -216.62 },
    { x: -79.9, z: -214.27 },
    { x: -79.98, z: -211.93 },
    { x: -80.65, z: -207.08 },
    { x: -86.39, z: -206.75 },
    { x: -85.9, z: -210.32 },
    { x: -85.64, z: -212.19 },
  ],
  "kostka między chodnikiem w293369595 a jezdnią ul. Zesłańców Sybiru przy północno-wschodnim narożniku Centrum Kultury, w OSM goła ziemia",
  ["w814972380", "w890775820", "w890775820", "w347398147", "w347398147", "w347398147", "w347398147", "w293369595", "w293369595", "w293369595"],
);

/**
 * The paving south of the lawns w890775822 and w890775823 by the Centrum Kultury, from their south
 * edges (on their nodes) to the service ways w444262951 and w1296360216 at the chunk's south edge.
 */
const CK_SOUTH_EDGE: AddedArea = yard(
  "ck-poludnie-skraj",
  SETTS,
  [
    { x: -146.19, z: -268.99 },
    { x: -161.76, z: -269.32 },
    { x: -163.59, z: -269.15 },
    { x: -163.91, z: -269.4 },
    { x: -164.45, z: -269.48 },
    { x: -171.86, z: -269.6 },
    { x: -172.1, z: -269.4 },
    { x: -172.2, z: -271.0 },
    { x: -172.2, z: -273.13 },
    { x: -163.97, z: -272.88 },
    { x: -152.07, z: -272.53 },
    { x: -146.6, z: -272.5 },
    { x: -146.6, z: -271.0 },
  ],
  "kostka między trawnikami w890775822 i w890775823 a drogą serwisową w444262951 na południe od Centrum Kultury, w OSM goła ziemia",
  ["w890775822", "w890775822", "w890775823", "w890775823", "w890775823", "w890775823", "w890775823", null, null, "w444262951", "w444262951", null, null],
);

/**
 * The lawn's margin round w890775815 west of the Centrum Kultury's car park, as far as the service
 * way w316906582's axis on the east and north and the paths w1454141173 and w891741224 on the west
 * and south: the lawn on its nodes, laid as lawn too.
 */
const CK_LAWN: AddedArea = yard(
  "ck-trawnik",
  { landuse: "grass" },
  [
    { x: -183.59, z: -271.0 },
    { x: -181.12, z: -258.54 },
    { x: -181.15, z: -255.29 },
    { x: -182.12, z: -252.13 },
    { x: -185.0, z: -250.21 },
    { x: -190.96, z: -248.75 },
    { x: -196.38, z: -247.67 },
    { x: -198.64, z: -247.23 },
    { x: -200.13, z: -255.09 },
    { x: -199.91, z: -260.1 },
    { x: -189.86, z: -271.0 },
    { x: -188.56, z: -271.0 },
    { x: -197.73, z: -260.77 },
    { x: -195.71, z: -250.49 },
    { x: -191.17, z: -251.47 },
    { x: -189.67, z: -251.84 },
    { x: -187.56, z: -252.63 },
    { x: -185.97, z: -253.9 },
    { x: -184.85, z: -255.07 },
    { x: -184.29, z: -256.52 },
    { x: -184.38, z: -258.2 },
    { x: -186.79, z: -271.0 },
  ],
  "trawnik wokół w890775815 do osi drogi serwisowej w316906582 i ścieżek w1454141173 i w891741224, w OSM goła ziemia między nimi",
  [
    null,
    "w316906582",
    "w316906582",
    "w316906582",
    "w316906582",
    "w316906582",
    "w316906582",
    "w316906582",
    "w1454141173",
    "w891741224",
    null,
    null,
    "w890775815",
    "w890775815",
    "w890775815",
    "w890775815",
    "w890775815",
    "w890775815",
    "w890775815",
    "w890775815",
    "w890775815",
    null,
  ],
);

/** T-243's added areas in draw order: Krakowskie Przedmieście's, then this file's. */
export const T243_AREAS: readonly AddedArea[] = [...KRAKOWSKIE_AREAS, CK_WEST_LAWN, CK_WEST, CK_SOUTH, CK_DRIVE, CK_EAST, CK_KERB, CK_SOUTH_EDGE, CK_LAWN];
