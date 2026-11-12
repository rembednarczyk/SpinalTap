/**
 * The kerbs the orthophoto (PZGiK) places otherwise than the import's rule (T-247, G-570). Along a
 * street the map gives no width, a gap of a metre and more between its carriageway and the paving
 * beside it is taken for asphalt the estimate left out (`kerbFills`): parking lanes and bus bays,
 * mostly. Where the gap is a lawn, or the estimate is the asphalt's true width and the gap a
 * pavement, the map is corrected here: a lawn the map lacks (the march to the paving stops at it),
 * or the width measured on the photograph (the street's width is then no estimate).
 */
import type { AddedArea, TagCorrection } from "./corrections.ts";
import { DEPTAKI_CORRECTIONS } from "./corrections-deptaki.ts";
import { KRAKOWSKIE_ADDED_AREAS } from "./corrections-radziwillowska.ts";
import type { Pt } from "./geometry.ts";

/** An added area of T-247: corners off the map's nodes. */
const t247 = (name: string, tags: AddedArea["tags"], ring: readonly Pt[], reason: string): AddedArea => ({
  id: `T-247/${name}`,
  tags,
  ring,
  nodesOf: ring.map(() => null),
  reason,
  ref: "T-247",
});

const pts = (xz: readonly (readonly [number, number])[]): Pt[] => xz.map(([x, z]) => ({ x, z }));

/**
 * The verge between Andersa's northbound carriageway w231037230 and its sidewalk on the east, from
 * the junction at z 345 to the one at z 413: 1.6-2.5 m of grass on the photograph, no area in the
 * map. 0.4 m under the carriageway's band and 0.5 m under the sidewalk's, both drawn over it.
 */
const ANDERSA_VERGE: AddedArea = t247(
  "trawnik-andersa",
  { landuse: "grass" },
  pts([
    [2391.45, 345.22],
    [2387.74, 352.33],
    [2385.82, 357.48],
    [2384.31, 363.64],
    [2383.7, 370.61],
    [2384.61, 381.07],
    [2390.81, 413.57],
    [2393.61, 413.4],
    [2387.79, 384.21],
    [2386.2, 371.28],
    [2386.99, 363.39],
    [2389.07, 355.16],
    [2392.14, 348.53],
    [2394.02, 345.67],
  ]),
  "pas trawy 1,6–2,5 m między jezdnią Andersa w231037230 a chodnikiem na ortofoto PZGiK, w OSM bez obszaru; reguła G-570 kładła tu asfalt",
);

/**
 * The strip of grass before the garden centre's greenhouses along the parking aisle w1561106064
 * (x 2672-2697): 0.8-1.2 m between the bands, 0.3 m under each.
 */
const AISLE_VERGE: AddedArea = t247(
  "trawnik-w1561106064",
  { landuse: "grass" },
  pts([
    [2672.99, 289.38],
    [2673.79, 289.1],
    [2678.76, 289.6],
    [2680.05, 289.86],
    [2685.93, 293.65],
    [2687.11, 294.54],
    [2694.91, 300.73],
    [2696.66, 298.54],
    [2688.05, 293.34],
    [2679.05, 287.94],
    [2674.67, 285.91],
    [2671.88, 286.1],
  ]),
  "pas trawy przed szklarniami przy alejce parkingu w1561106064 na ortofoto PZGiK, w OSM bez obszaru; import kładł tu chodnik",
);

/** The tail of `ADDED_AREAS` in draw order: Krakowskie Przedmieście's (T-243, T-245), then T-247's lawns. */
export const ADDED_AREAS_TAIL: readonly AddedArea[] = [...KRAKOWSKIE_ADDED_AREAS, ANDERSA_VERGE, AISLE_VERGE];

/** T-247's widths. */
const KERB_WIDTHS: readonly TagCorrection[] = [
  {
    // Królewska by the car park on Plac Zamkowy's side (x 540-590): the zebra and the centre line
    // give 6.5-7 m of asphalt, its north kerb 0.3 m off the estimate's edge; north of it 2.6 m of
    // paving with the lamp posts and the trees (G-570). The width the estimate gives, so the
    // carriageway, its lanes and markings stay as they were and the gap is laid as a pavement.
    id: "w66829063",
    tags: { width: "6.5" },
    reason: "Królewska: 6,5–7 m asfaltu na ortofoto PZGiK (zebra, oś), krawężnik 0,3 m od szacunku z lanes=2; pas 2,6 m na północ to chodnik z latarniami",
    ref: "T-247",
  },
];

/** The tail of `TAG_CORRECTIONS`: the pedestrian streets' widths (T-199), then T-247's. */
export const TAG_CORRECTIONS_TAIL: readonly TagCorrection[] = [...DEPTAKI_CORRECTIONS, ...KERB_WIDTHS];
