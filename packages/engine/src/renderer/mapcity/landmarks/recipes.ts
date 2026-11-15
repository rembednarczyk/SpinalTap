/**
 * Recipes of the landmarks drawn from their own geometry (ADR-0062): which OSM buildings and
 * parts a landmark is made of and the kit's elements on each. The outline, the heights and the
 * place always come from the map data; a recipe only adds detail within the solid (up to a
 * cornice's depth) and the Lublin 2077 layer. Pure data: a new landmark is a new entry here, and
 * the general recipes by kind (church, Orthodox church, public building, historic tenement, wall
 * and bastion, stage 7) compose the same elements.
 */

/** What a tier's walls are made of: the kit's swatches (`kit.ts`). */
export type Material = "brick" | "plaster" | "stone";

/** A row of blind niches with a pointed head (Gothic brickwork), plastered light inside. */
export interface BlindRow {
  /** Niches per wall, at most; fewer on a short wall (one per `pitch` metres). */
  readonly pitch: number;
  /** Bottom and top of the niches as fractions of the tier's wall height. */
  readonly from: number;
  readonly to: number;
}

/**
 * The top of a part: flat (a slab with a coping), battlements (merlons `merlon` metres tall every
 * `pitch` metres, within the data's height), a low skirt roof from the eaves up to the part
 * standing on it (`rise` metres, never more than the data's roof), or a helmet of revolution
 * `height` metres tall up to the data's peak: the rest of the data's roof under it is wall. `roof`
 * is the data's own roof in the shape it gives (`roof:shape`, ADR-0064) and its height, in tiles;
 * with `rise`, no higher than that (the importer's guessed height buried a part, G-117).
 */
export type Crown =
  | { readonly kind: "flat" }
  | { readonly kind: "crenel"; readonly merlon: number; readonly pitch: number }
  | { readonly kind: "skirt"; readonly rise: number; readonly inset: number }
  | { readonly kind: "helm"; readonly height: number; readonly profile: HelmProfile }
  | { readonly kind: "roof"; readonly rise?: number };

/**
 * A helmet as a profile of revolution: [radius, height] from the eaves up, the radius a fraction
 * of the part's inner radius and the height a fraction of the helmet's. The bell is `shell`, then
 * the open lantern (from, to) of `lanternRadius`, the onion up to `onion`, the spire with its ball
 * centred at `ball`, and from `mast` up Lublin 2077's mast, all as fractions of the height.
 */
export interface HelmProfile {
  readonly shell: readonly (readonly [number, number])[];
  readonly lantern: readonly [number, number];
  readonly lanternRadius: number;
  readonly onion: number;
  readonly ball: number;
  readonly mast: number;
}

/** The walls of one OSM building or part: material, plinth, blinds, pilasters, cornices, openings, clock. */
export interface Tier {
  readonly material: Material;
  /** A stone plinth up from the foot, metres over the ground floor (0 for none). */
  readonly plinth: number;
  readonly blinds: readonly BlindRow[];
  /** Pilasters at the corners of the outline (a plastered Baroque tier). */
  readonly pilasters: boolean;
  /** A cornice at the top of the walls; `base` a moulding at their foot too. */
  readonly cornice: boolean;
  readonly base: boolean;
  /** Arched openings, one per wall without a clock (a belfry or a lantern storey). */
  readonly openings: boolean;
  /** A clock face on the walls facing the two sides of the landmark. */
  readonly clock: boolean;
  /**
   * Metres over the tier's foot where its lower zone (the clocks) ends and the upper one starts
   * (the openings, round-headed on every wall), a string course between them; absent for one zone.
   */
  readonly split?: number;
  /** A gallery with a balustrade at the foot of the wall facing the new town, a door behind it. */
  readonly gallery?: boolean;
  /** Dark glazed headers (zendrówki) in diagonal bands across the brick. */
  readonly diaper?: boolean;
  /** Small windows per wall, at most (fewer on a short wall). */
  readonly windows?: number;
  /** Rows of small white panels, metres over the foot (off the openings and the buttresses). */
  readonly plaques?: readonly number[];
  /** Battered stone buttresses this high (metres over the foot) on the corner blocks of the new town's side. */
  readonly buttress?: number;
  /** A niche with a painting over the passage's mouth on the new town's side: bottom and top over the foot, width, metres. */
  readonly niche?: { readonly from: number; readonly to: number; readonly width: number };
  /** Lublin 2077's screen hangs on this tier's wall facing the new town (off the niche, T-034). */
  readonly screen?: boolean;
  /** OSM ids of the neighbouring tenements Lublin 2077's cables run to from this tier's wall facing the new town. */
  readonly cables?: readonly string[];
  /** The plaster's colour from the kit's swatches (OSM `building:colour`); absent: white. */
  readonly colour?: "beige" | "sand";
  /** The upper zone's colour over the split (a tower's copper-clad storey); absent: the tier's. */
  readonly upper?: "patina";
  /** A palace front (Nowy Ratusz): storeys of windows on every shown wall, a portico where the data has one. */
  readonly palace?: PalaceFront;
  /**
   * A classicist front (Merlini's Brama Grodzka, 1785): the walls rusticated up to a string course
   * over the passage's arch with a keystone in it, `rows` rows of up to `windows` framed windows
   * over it, the pilasters from the string course up, and on a gabled roof a raking cornice with
   * the front's face in the gable.
   */
  readonly front?: ClassicFront;
}

/**
 * What stands in a classicist front's gable: a round window, a cartouche over a tablet with the
 * front's `inscription`, or a round-headed window between two blind round-headed niches.
 */
export type GableFace = "oculus" | "cartouche" | "lunette";

/** A classicist front's storeys of windows over the arch and the faces of its gables, by side (absent: round windows). */
export interface ClassicFront {
  readonly rows: number;
  readonly windows: number;
  /** Metres between the window axes, at most (absent: 2.3). */
  readonly pitch?: number;
  readonly gables?: { readonly old: GableFace; readonly new: GableFace };
  /** The tablet's text under a cartouche (an in-world inscription, ADR-0056: a date in Roman numerals needs no translation). */
  readonly inscription?: string;
}

/** A window's head: square with a sill, round-headed in an arched panel, or square under a cornice (a pediment). */
export type WindowHead = "plain" | "arched" | "pediment";

/**
 * A palace front's storeys from the ground floor up: one row of windows a storey, `pitch` metres
 * apart at most on every shown wall, the ground floor rusticated up to a string course when
 * `rusticated` (and 1.2 times as tall as the others). Where the data has a portico (`porticoes.ts`
 * in the simulation) its wall gets a risalit over the portico's width, the windows in its bays.
 */
export interface PalaceFront {
  readonly rows: readonly WindowHead[];
  readonly rusticated: boolean;
  readonly pitch: number;
  /** Storeys the portico's columns span from the ground (a giant order), its balcony on the last one's top; absent: 1. */
  readonly giant?: number;
}

/** One OSM building or `building:part` of a landmark with its tier and crown. */
export interface PartRecipe {
  /** OSM id as in the map data (`r7224409`, `w617878341`). */
  readonly osm: string;
  readonly tier: Tier;
  readonly crown: Crown;
}

/**
 * Lublin 2077 on the landmark (ADR-0062): neon on the side towards the new town, a subdued layer
 * on the Old Town's side (ADR-0058: the Rynek and the Old Town sparingly), and a gang checkpoint
 * in a gate's passage. `newTown` is the unit direction (world x, z) the neon side faces.
 */
export interface Layer2077 {
  readonly newTown: { readonly x: number; readonly z: number };
  /** Neon of the new town's side and the thin warm lines of the Old Town's side. */
  readonly neon: string;
  readonly warm: string;
  /** A screen with its text (an in-world sign, ADR-0056) on the tier marked for it, off the niche over the arch. */
  readonly screen?: string;
  /** A checkpoint in the passage (ADR-0048, `hebi-bramowa`): a scanner in the vault, strips on the jambs. */
  readonly checkpoint: boolean;
  /** The data's name on the frieze of the portico (an in-world sign from the map, ADR-0056). */
  readonly nameplate?: boolean;
  /** Flags on masts over the portico, each as its stripes from the top down (colours). */
  readonly flags?: readonly (readonly string[])[];
  /** A plaque by the passage on the new town's side (the museum inside, G-051). */
  readonly plaque?: string;
  /**
   * The Old Town's subdued layer on every side (ADR-0058: the Rynek and the Old Town sparingly):
   * thin warm lines on the cornices, uplights at both mouths of the passage, no neon.
   */
  readonly subdued?: boolean;
}

export interface LandmarkRecipe {
  readonly key: string;
  readonly parts: readonly PartRecipe[];
  readonly layer: Layer2077;
}

const NO_BLINDS: readonly BlindRow[] = [];

/**
 * Brama Krakowska (r7224409 with its parts, G-049): the Gothic brick tower on a stone plinth over
 * the passage and the annex towards Krakowskie Przedmieście, the white Baroque octagon on the
 * tower and the copper helmet with a lantern (Merlini, 1782). Heights from the data: the annex
 * and the tower's foot to 7.1 m, the tower to 16.7 m and the peak at 29.5 m. The data's octagon
 * (to 19.9 m under a 9.6 m roof) is squat against the photograph (T-032): its walls go to 22.5 m,
 * a lower zone with the clocks and the west gallery to 20 m and an upper one with round-headed
 * windows, and the helmet is 7 m (bell, open lantern, onion, spire with a ball).
 */
const BRAMA_KRAKOWSKA: LandmarkRecipe = {
  key: "brama-krakowska",
  parts: [
    {
      osm: "r7224409",
      // The annex (T-033): brick with zendrówki, battlements over a row of white panels, the
      // stone buttresses on its west corner blocks (0.6 of its 10 m) and the painting's niche over
      // the arch, 1.1 x 2.1 m at 6.0-8.1 m (T-033).
      tier: { material: "brick", plinth: 0, blinds: NO_BLINDS, pilasters: false, cornice: false, base: false, openings: false, clock: false, diaper: true, plaques: [8.5, 5], buttress: 6, niche: { from: 6, to: 8.1, width: 1.1 } },
      crown: { kind: "crenel", merlon: 1, pitch: 1.6 },
    },
    {
      osm: "w617597407",
      // No white blind niches (T-033): zendrówki, a few small windows and the screen over the
      // battlements. Cables to the tenement north of the annex (T-034): the only one on the west
      // side within reach (Plac Łokietka is open, Jezuicka 3 lies south-east, under the annex).
      tier: { material: "brick", plinth: 0, blinds: NO_BLINDS, pilasters: false, cornice: true, base: false, openings: false, clock: false, diaper: true, windows: 3, screen: true, cables: ["w66286400"] },
      // The OSM roof (a 4.2 m dome) would bury the octagon (T-017): a low skirt round its foot instead.
      crown: { kind: "skirt", rise: 0.9, inset: 1.2 },
    },
    {
      osm: "w617878341",
      tier: { material: "plaster", plinth: 0, blinds: NO_BLINDS, pilasters: true, cornice: true, base: true, openings: true, clock: true, split: 3.3, gallery: true },
      crown: {
        kind: "helm",
        height: 7,
        profile: {
          // A broad Baroque bell: out over the cornice, swelling, drawn in to the lantern's foot.
          shell: [
            [1.06, 0],
            [1.03, 0.03],
            [0.95, 0.1],
            [0.8, 0.17],
            [0.58, 0.24],
            [0.38, 0.285],
            [0.27, 0.3],
          ],
          lantern: [0.3, 0.6],
          lanternRadius: 0.23,
          onion: 0.78,
          ball: 0.84,
          mast: 0.9,
        },
      },
    },
  ],
  layer: { newTown: { x: -0.96, z: -0.27 }, neon: "#ff2e88", warm: "#ffc98a", screen: "STARE MIASTO 旧市街", checkpoint: true, plaque: "Muzeum Historii Miasta Lublina" },
};

/**
 * Brama Grodzka (w232362876, ADR-0062 stage 2): the gate between the Old Town and the castle,
 * rebuilt by Merlini in 1785 as a plastered classicist gate house, beige (`building:colour`) under
 * a tiled gabled roof (`roof:shape=gabled`, `roof:material=roof_tiles`). The solid is the data's:
 * 19 x 8 m along Grodzka, the passage through its length, three storeys (`building:levels`) with
 * the walls to y -2.0 and the ridge 3.7 m over them. Its two fronts are the passage's ends, the
 * long walls stand against the tenements next door. The whole gate is in the Old Town: the
 * subdued layer on both fronts, the camera on the Old Town's (Grodzka's) front. After the
 * photographs (Commons): one storey of large windows (about 1 x 1.6 m) over the arch on both
 * fronts; in the gable over Grodzka a cartouche over a tablet with the year of the rebuilding
 * (MDCCLXXXV), in the gable towards the castle a round-headed window between two blind niches.
 * Three window axes about 2 m apart over the arch on each front (G-136: 1.9-2.0 m on the photographs,
 * and the castle's front shows only 5.65 m between its neighbours).
 */
const BRAMA_GRODZKA: LandmarkRecipe = {
  key: "brama-grodzka",
  parts: [
    {
      osm: "w232362876",
      tier: { material: "plaster", colour: "beige", plinth: 0, blinds: NO_BLINDS, pilasters: true, cornice: true, base: false, openings: false, clock: false, front: { rows: 1, windows: 3, pitch: 2, gables: { old: "cartouche", new: "lunette" }, inscription: "MDCCLXXXV" } },
      crown: { kind: "roof" },
    },
  ],
  // The outer front faces Podzamcze and the castle, the Old Town's front Grodzka up to Plac po Farze.
  layer: { newTown: { x: 0.75, z: 0.66 }, neon: "#ffc98a", warm: "#ffc98a", checkpoint: false, subdued: true },
};

/**
 * Nowy Ratusz, Plac Łokietka 1 (w66264120 with its parts, G-119, T-067), after the photographs of
 * the south front (Lublin360 2017, Street View 2025): a classicist town hall in sand plaster with
 * cream detail (`building:colour=yellow`) under a low red hipped roof (`roof:colour=red`). The
 * wings: a rusticated ground floor with square windows, round-headed windows in arched panels on
 * the first floor, square windows under cornices on the second, a crowning cornice. Over the plaza
 * a portico of four columns of a giant order with plain shafts (the simulation's `PORTICOES`),
 * through the ground and first floors, carries a balcony with a balustrade before the second's, steps the width of the portico (the data's three flights) between planters,
 * five flags over it. The risalit's block (w619138853, six storeys of the data) stands over the
 * wings' roof with round-headed windows and a cornice, no pediment (G-117: the importer's guessed
 * 7 m roof buried it, so the roof stays 3.5 m). On it the tower (w619138854): a storey in the
 * front's plaster with the clocks towards the plaza and the yards, over a string course a square
 * storey clad in copper with corner pilasters and round-headed openings, a copper helmet with a
 * lantern and a spire with a ball (`roof:colour=green`); its heights from GUGiK (body 30.5 m, peak
 * 38 m), the clock storey 4 m, the copper one 6 m. Krakowskie Przedmieście is the new town:
 * neon on the cornices facing the plaza, the clock's holo, Lublin 2077's mast over the ball.
 */
const NOWY_RATUSZ: LandmarkRecipe = {
  key: "nowy-ratusz",
  parts: [
    {
      osm: "w66264120",
      tier: { material: "plaster", colour: "sand", plinth: 0, blinds: NO_BLINDS, pilasters: false, cornice: true, base: false, openings: false, clock: false, palace: { rows: ["plain", "arched", "pediment"], rusticated: true, pitch: 3.4, giant: 2 } },
      crown: { kind: "roof", rise: 3.5 },
    },
    {
      osm: "w619138853",
      tier: { material: "plaster", colour: "sand", plinth: 0, blinds: NO_BLINDS, pilasters: true, cornice: true, base: false, openings: false, clock: false, palace: { rows: ["arched"], rusticated: false, pitch: 3.4 } },
      crown: { kind: "flat" },
    },
    {
      osm: "w619138854",
      tier: { material: "plaster", colour: "sand", upper: "patina", plinth: 0, blinds: NO_BLINDS, pilasters: true, cornice: true, base: false, openings: true, clock: true, split: 4 },
      crown: {
        kind: "helm",
        // The data's roof (7.5 m from NMPT and LoD2, `corrections-landmarks.ts`): the helmet with its
        // lantern and spire up to the peak.
        height: 7.5,
        profile: {
          // A bell upright at its foot to two fifths of the helmet (Street View 2025), the lantern,
          // a small onion and the spire with its ball over it.
          shell: [
            [0.95, 0],
            [0.95, 0.08],
            [0.9, 0.17],
            [0.78, 0.26],
            [0.58, 0.34],
            [0.38, 0.39],
            [0.3, 0.4],
          ],
          lantern: [0.4, 0.56],
          lanternRadius: 0.3,
          onion: 0.66,
          ball: 0.74,
          mast: 0.84,
        },
      },
    },
  ],
  // The front faces the plaza (south), its wall's outward normal.
  layer: {
    newTown: { x: 0.128, z: -0.992 },
    neon: "#5ce1ff",
    warm: "#ffc98a",
    checkpoint: false,
    nameplate: true,
    // Five over the balcony (the user's correction of the photograph); the colours read off it are
    // Poland's, the city's and the European Union's, their order is not confirmed.
    flags: [["#f4f4f0", "#d4213d"], ["#f2c230", "#d4213d"], ["#1f3f99"], ["#f2c230", "#d4213d"], ["#f4f4f0", "#d4213d"]],
  },
};

export const LANDMARK_RECIPES: readonly LandmarkRecipe[] = [BRAMA_KRAKOWSKA, BRAMA_GRODZKA, NOWY_RATUSZ];

/** Every text the landmarks write in the names atlas: screens, plaques and dated tablets. */
export const LANDMARK_TEXTS: readonly string[] = [
  ...new Set(LANDMARK_RECIPES.flatMap((r) => [r.layer.screen, r.layer.plaque, ...r.parts.map((p) => p.tier.front?.inscription)].flatMap((t) => (t ? [t] : [])))),
];

/** A neighbour a landmark's cables run to: its world outline and the world y of its top. */
export interface CableAnchor {
  readonly ring: readonly { readonly x: number; readonly z: number }[];
  readonly top: number;
}

/** A part of a landmark with the recipe it belongs to. */
export interface LandmarkPart {
  readonly recipe: LandmarkRecipe;
  readonly part: PartRecipe;
  /** World outlines of the recipe's parts lifted onto this one (from the map data): its walls go on up under them. */
  readonly above?: readonly (readonly { readonly x: number; readonly z: number }[])[];
  /** The tenements its cables run to (from the map data): world outline and top. */
  readonly cableTo?: readonly CableAnchor[];
  /** World outlines of the other buildings of the data next to it (not of its recipe): its fittings and windows keep out of them. */
  readonly nearby?: readonly (readonly { readonly x: number; readonly z: number }[])[];
}

/** Recipes by the OSM id of each of their buildings and parts. */
export const RECIPE_BY_OSM: ReadonlyMap<string, LandmarkPart> = new Map(LANDMARK_RECIPES.flatMap((recipe) => recipe.parts.map((part): [string, LandmarkPart] => [part.osm, { recipe, part }])));
