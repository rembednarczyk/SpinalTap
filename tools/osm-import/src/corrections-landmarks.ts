/**
 * Heights of landmarks of the list (`landmark-ids.ts`) set from GUGiK LoD1 2024 and LoD2 2017
 * (ADR-0077 step 3, G-631, T-254), a tail of `TAG_CORRECTIONS`: kept apart so `corrections.ts`
 * stays within ADR-0031's 500 lines. The import keeps a landmark's height as reviewed, so a measured
 * one comes in here, by hand.
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
];
