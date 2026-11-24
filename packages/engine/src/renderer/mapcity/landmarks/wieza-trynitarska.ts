import type { BlindRow, LandmarkRecipe } from "./recipe-types";

/**
 * Wieża Trynitarska (w66286371, T-349 stage K4, G-683, T-264, T-353), after the user's photograph
 * and GUGiK LoD2 and NMPT (`docs/plany/archikatedra-otoczenie.md` §3): the Jesuits' gate tower,
 * rebuilt neo-Gothic by Corazzi in 1819, in pale plaster over Gruella's passage; the square body to
 * its cornice at y 29.9 (NMPT's corners 25-27; the import holds a roof to half the height) with
 * pointed windows in pairs on two storeys, on each side a steep gable to 38.5 with a clock in it, slim pinnacles on the corners, and the tall octagonal copper spire to
 * 58.6 (LoD2's ridge) with its ball; over it Lublin 2077's mast and red obstruction light (the
 * card's antenna, T-143). The tower stands 4.9 m west of OSM's outline where LoD2 and NMPT have it,
 * its passage on its axis (`corrections-katedra.ts`). The Old Town's subdued layer.
 */

const NO_BLINDS: readonly BlindRow[] = [];

export const WIEZA_TRYNITARSKA: LandmarkRecipe = {
  key: "wieza-trynitarska",
  parts: [
    {
      osm: "w66286371",
      tier: {
        material: "plaster",
        colour: "pale",
        plinth: 1.2,
        blinds: NO_BLINDS,
        pilasters: true,
        cornice: true,
        base: true,
        openings: false,
        clock: false,
        towerWindows: [
          [9, 14.5],
          [17.5, 23.5],
        ],
      },
      crown: { kind: "spire", gable: 8.6, pinnacle: 0.9, base: 0.62, clock: true },
    },
  ],
  // The plaza's side (south, towards the cathedral's front): its normal.
  layer: { newTown: { x: 0.07, z: -1 }, neon: "#ffc98a", warm: "#ffc98a", checkpoint: false, subdued: true },
};
