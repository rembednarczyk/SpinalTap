/**
 * The Archikatedra's massing from GUGiK NMPT 0.5 m (the user's request of 24.11: the cathedral after
 * his photographs; `docs/plany/archikatedra.md`, T-349). OSM has the church w66286341 as one outline
 * with `building:levels=6` (walls to y 19.5 with the plinth) and three parts: the nave w617763433 and
 * the two turrets of the front w617763434/435 with domes. NMPT over it (world y): the chapels and the
 * vestibule round the nave about 13-15, the nave's eaves about 25 and its ridge 31, a screen front
 * between the turrets to 33 with a low pediment to 35, the turrets' bodies to 33-35 and their helmets
 * to 43, the sacristies and annexes on the east and south 7-9, and a portico 6 m deep before the
 * front with its terrace about 13-14 (the renderer's and the simulation's `PORTICOES`, not a part: it
 * is open). The turrets of the map stand 3.3-3.5 m east of NMPT's and LoD2's (as the Trinitarian
 * Tower's, T-264), the nave and the east end where NMPT has them. The pattern is OSM's Simple 3D
 * Buildings: the outline at its lowest storey, `building:part`s with their own heights over it.
 * Heights here count from the base over the 9.9 m plinth (y −9.6), so world y − 0.3.
 */
import type { AddedArea, TagCorrection } from "./corrections.ts";
import type { Pt } from "./geometry.ts";

const REF = "T-349";

/** The axis of the church: 6.3° from world x towards +z, through the outline's centre (634.2, −183.8). */
const AXIS = {
  x: 634.2,
  z: -183.8,
  cos: Math.cos((6.3 * Math.PI) / 180),
  sin: Math.sin((6.3 * Math.PI) / 180),
} as const;

/** A point u metres along the axis (east) and v across it (north), world metres to the centimetre. */
const at = (u: number, v: number): Pt => ({
  x: Math.round((AXIS.x + u * AXIS.cos - v * AXIS.sin) * 100) / 100,
  z: Math.round((AXIS.z + u * AXIS.sin + v * AXIS.cos) * 100) / 100,
});

/** The west front's jogs in OSM (0.5-0.6 m, 1.5-3.6 m wide): NMPT has one face there, the pilasters are the recipe's. */
const FRONT_JOGS: readonly Pt[] = [
  [602.0, -171.49],
  [602.31, -174.12],
  [601.67, -174.2],
  [601.87, -176.05],
  [602.52, -175.96],
  [602.7, -177.57],
  [602.06, -177.65],
  [602.29, -179.66],
  [602.94, -179.56],
  [603.12, -181.08],
  [602.56, -181.14],
  [602.8, -183.11],
  [603.33, -183.03],
  [603.52, -184.59],
  [603.73, -186.43],
  [603.14, -186.49],
  [603.35, -188.36],
  [603.93, -188.23],
  [604.13, -189.89],
  [603.59, -189.95],
  [603.81, -191.92],
  [604.37, -191.93],
  [604.53, -193.4],
  [603.96, -193.46],
  [604.21, -195.57],
  [604.78, -195.55],
].map(([x, z]) => ({ x: x!, z: z! }));

export const KATEDRA_CORRECTIONS: readonly TagCorrection[] = [
  {
    // The outline at the annexes' height: the sacristies east of the apse and the annexes on the
    // south, NMPT y 7-9 (walls to y 8.3), flat under the parts standing on it. Its west front one face.
    id: "w66286341",
    tags: { height: "8", "roof:shape": "flat", "roof:height": "0" },
    drop: FRONT_JOGS,
    reason:
      "Archikatedra: obrys na wysokości zakrystii i przybudówek (NMPT y 7–9) pod częściami z NMPT; front zachodni jedną ścianą bez uskoków 0,5–0,6 m",
    ref: REF,
  },
  {
    // The nave: NMPT eaves about y 25 (v 10.5 and −4.5 of the axis), ridge y 31 (v 2-4), the apse's
    // half cone down to the eaves from u 12 to 21. OSM: 9 storeys over the outline's 6 (walls to y 22.1, ridge 29.1).
    // Its outline stands 3.5 m east of NMPT's as the turrets' do: the apse's eaves end at u 21 (OSM 24.5),
    // the nave's west gable stands at u −26 behind the screen front (OSM −22.5).
    id: "w617763433",
    tags: { height: "31.2", "roof:height": "6.5" },
    shift: { x: -3.48, z: -0.38 },
    reason:
      "Archikatedra, nawa: okap y 25 i kalenica y 31,5 z NMPT wobec 22,1 i 29,1 z building:levels; obrys OSM 3,5 m na wschód od NMPT (absyda do u 21, nie 24,5)",
    ref: REF,
  },
  {
    // The north turret: NMPT body u −26..−20, v 10..16 of the axis (its middle (609.9; −172.9)), the
    // cornice y 33-35, the helmet's tip y 43 at (u −23, v 13); OSM's 3.5 m east and 0.2 m north of it; moved 3.3 m, so its middle stays in the cell of the church (x ≥ 610, the streaming's chunk).
    id: "w617763434",
    tags: { height: "42.7", "roof:height": "9.5", "roof:shape": "onion" },
    shift: { x: -3.3, z: -0.2 },
    reason:
      "Archikatedra, wieżyczka północna: korpus do y 33,5 i hełm do y 43 z NMPT wobec 29,3 i 32,3; obrys OSM 3,5 m na wschód od NMPT i LoD2",
    ref: REF,
  },
  {
    // The south turret: NMPT body u −26..−20, v −11..−5, the tip y 43 at (u −23, v −8); OSM's 3.4 m east and 1 m south.
    id: "w617763435",
    tags: { height: "42.7", "roof:height": "9.5", "roof:shape": "onion" },
    shift: { x: -3.43, z: 1.03 },
    reason:
      "Archikatedra, wieżyczka południowa: korpus do y 33,5 i hełm do y 43 z NMPT wobec 29,3 i 32,3; obrys OSM 3,4 m na wschód od NMPT i LoD2",
    ref: REF,
  },
];

const part = (
  name: string,
  ring: readonly Pt[],
  tags: Record<string, string>,
  reason: string,
): AddedArea => ({
  id: `${REF}/katedra-${name}`,
  tags: {
    "building:part": "yes",
    "building:colour": "lightgrey",
    "roof:colour": "green",
    ...tags,
  },
  ring,
  nodesOf: ring.map(() => null),
  reason,
  ref: REF,
});

/** The north-west and south-west corners of the outline (OSM nodes), the vestibule's ends behind the portico. */
const NW = { x: 601.82, z: -169.83 };
const SW = at(-30.45, -12.3);

export const KATEDRA_PARTS: readonly AddedArea[] = [
  // The chapels along both sides of the nave and the vestibule behind the portico, NMPT y 13-15 from
  // the front to u 11 (v −12.3..17.4): flat roofs to y 14 round the nave (the lean-tos and the
  // chapels' domes are the recipe's, ADR-0062).
  part(
    "korpus",
    [NW, SW, at(11, -12.3), at(11, 17.4)],
    { height: "13.7", "roof:shape": "flat" },
    "Archikatedra: kaplice i kruchta do y 14 z NMPT (13–15), w OSM bez części",
  ),
  // Under the nave's east end and the apse to u 21.5, as high as the chapels: the nave stands on one
  // level (the import lifts a part to the top under its middle), its walls run on down to y 14.
  part(
    "pod-nawa",
    [at(11, -6.8), at(21.5, -6.8), at(21.5, 10.4), at(11, 10.4)],
    { height: "13.7", "roof:shape": "flat" },
    "Archikatedra: prezbiterium pod nawą do y 14, w OSM bez części",
  ),
  // The presbytery's side rooms either side of it to the outline's step at u 19.4 and on to u 21.5, NMPT y 10-13.
  part(
    "prezbiterium-pn",
    [
      at(11, 10.4),
      at(21.5, 10.4),
      at(21.5, 15.1),
      at(19.35, 15.1),
      at(19.35, 17.35),
      at(11, 17.4),
    ],
    { height: "11.2", "roof:shape": "flat" },
    "Archikatedra: pomieszczenia przy prezbiterium od północy do y 11,5 z NMPT (10–13), w OSM bez części",
  ),
  part(
    "prezbiterium-pd",
    [at(11, -12.3), at(21.5, -12.3), at(21.5, -6.8), at(11, -6.8)],
    { height: "11.2", "roof:shape": "flat" },
    "Archikatedra: pomieszczenia przy prezbiterium od południa do y 11,5 z NMPT (10–13), w OSM bez części",
  ),
  // The screen front between the turrets, NMPT y 33-34 at u −26..−24 with its pediment to y 35.3 at
  // v 2-4 and 30-34 to u −22, 0.15 m proud of the nave's west gable and over its roof to u −21.4 (its middle in the cell of the church, x ≥ 610): a gable facing the plaza (ridge across the long side).
  part(
    "fronton",
    [at(-26.15, -5.3), at(-26.15, 9.6), at(-21.4, 9.6), at(-21.4, -5.3)],
    {
      height: "35",
      "roof:height": "2.3",
      "roof:shape": "gabled",
      "roof:orientation": "across",
    },
    "Archikatedra: górna kondygnacja fasady między wieżyczkami do y 33 z frontonem do y 35,3 z NMPT, w OSM bez części",
  ),
];
