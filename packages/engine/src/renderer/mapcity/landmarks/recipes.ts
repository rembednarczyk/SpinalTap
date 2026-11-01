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
 * is the data's own roof in the shape it gives (`roof:shape`, ADR-0064) and its height, in tiles.
 */
export type Crown =
  | { readonly kind: "flat" }
  | { readonly kind: "crenel"; readonly merlon: number; readonly pitch: number }
  | { readonly kind: "skirt"; readonly rise: number; readonly inset: number }
  | { readonly kind: "helm"; readonly height: number; readonly profile: HelmProfile }
  | { readonly kind: "roof" };

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
  readonly colour?: "beige";
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
  readonly gables?: { readonly old: GableFace; readonly new: GableFace };
  /** The tablet's text under a cartouche (an in-world inscription, ADR-0056: a date in Roman numerals needs no translation). */
  readonly inscription?: string;
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
 * Two window axes on each front for now (the passage lies off the fronts' axis in the data, G-136).
 */
const BRAMA_GRODZKA: LandmarkRecipe = {
  key: "brama-grodzka",
  parts: [
    {
      osm: "w232362876",
      tier: { material: "plaster", colour: "beige", plinth: 0, blinds: NO_BLINDS, pilasters: true, cornice: true, base: false, openings: false, clock: false, front: { rows: 1, windows: 3, gables: { old: "cartouche", new: "lunette" }, inscription: "MDCCLXXXV" } },
      crown: { kind: "roof" },
    },
  ],
  // The outer front faces Podzamcze and the castle, the Old Town's front Grodzka up to Plac po Farze.
  layer: { newTown: { x: 0.75, z: 0.66 }, neon: "#ffc98a", warm: "#ffc98a", checkpoint: false, subdued: true },
};

export const LANDMARK_RECIPES: readonly LandmarkRecipe[] = [BRAMA_KRAKOWSKA, BRAMA_GRODZKA];

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
