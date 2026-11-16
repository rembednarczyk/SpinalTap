/**
 * Heights of landmarks of the list (`landmark-ids.ts`) set from GUGiK LoD1 2024 and LoD2 2017
 * (ADR-0077 step 3, G-631, T-254), and their outlines where NMPT puts a wall elsewhere (G-874), a
 * tail of `TAG_CORRECTIONS`: kept apart so `corrections.ts` stays within ADR-0031's 500 lines. The
 * import keeps a landmark's height as reviewed, so a measured one comes in here, by hand.
 */
import type { TagCorrection } from "./corrections.ts";

export const LANDMARK_HEIGHT_CORRECTIONS: readonly TagCorrection[] = [
  {
    // Trybunał Koronny: `building:levels=3` gave 9.6 m walls with the eaves at y 10.5, under the
    // tenements of the Rynek round it (y 13.9-18.4). GUGiK LoD2 2017 has the eaves 16.4 m and the
    // ridge 20.9 m over the ground, LoD1 2024 measuredHeight 17.5 m. `height` runs over the 1.8 m
    // plinth to the ridge, hence 20.9 - 1.8; the roof is ridge - eaves.
    id: "w66264159",
    tags: { height: "19.1", "roof:height": "4.5" },
    reason: "Trybunał Koronny: okap 16,4 m i kalenica 20,9 m z LoD2, LoD1 17,5 m, wobec okapu 11,4 m z building:levels=3 niżej od kamienic Rynku",
    ref: "T-254",
  },
  {
    // Teatr im. Juliusza Osterwy: no height in OSM, so the district's default four storeys (16.3 m
    // over the foot). GUGiK LoD1 2024 measuredHeight 19.5 m; LoD2's eaves (5.3 m) are its low
    // annex, of no use for the body. Flat as before: `height` runs over the 2.7 m plinth.
    id: "w67508958",
    tags: { height: "16.8" },
    reason: "Teatr im. Juliusza Osterwy: 19,5 m z LoD1 wobec domyślnych 16,3 m",
    ref: "T-254",
  },
  {
    // Nowy Ratusz's tower (G-119, T-067): `building:levels=7.5` and no roof height gave walls to
    // 25 m and the importer's 3 m pyramid, a peak of 28 m. GUGiK NMPT over the tower: its body
    // 29.6-31.8 m, the spire 38.2 m; LoD2 2017 37.7 m. On the photograph (Street View 2025) the
    // clock storey is about 4 m, the copper one about 6 m, the helmet with its lantern and spire
    // about 7.5 m. `height` runs over the 1 m plinth to the spire's tip (38 m), the helmet is its roof.
    id: "w619138854",
    tags: { height: "37", "roof:height": "7.5" },
    reason: "Wieża Nowego Ratusza: korpus 30,5 m i szczyt 38 m z NMPT (29,6–31,8 i 38,2 m) i LoD2 (37,7 m) wobec 25 i 28 m z building:levels=7.5",
    ref: "T-067",
  },
  {
    // Zamek Lubelski's north wing (G-874): OSM's outline steps out 2.6-3.0 m north at x 904 and
    // back at x 942, so the wing stood on the asphalt of the road behind the castle. GUGiK NMPT
    // 0.5 m and the orthophoto 2023-09..2025-04 have one straight wall from (903.6; 258.6) to
    // (941.0; 253.8), the roof's edge at z 257.75/256.3/254.0 abreast of x 910/925/940: the
    // step's two nodes go, the wall runs between its ends.
    id: "w48500136",
    tags: {},
    drop: [
      { x: 903.9, z: 261.6 },
      { x: 941.5, z: 256.8 },
    ],
    reason: "Zamek Lubelski: skrzydło pn. prosto (903,6; 258,6)–(941,0; 253,8) jak krawędź dachu NMPT i ortofoto, bez uskoku OSM 2,6–3,0 m na północ",
    ref: "T-319",
  },
];
