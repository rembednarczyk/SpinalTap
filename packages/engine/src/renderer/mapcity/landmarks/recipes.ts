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
 * The top of a part: flat (a slab with a coping), a low skirt roof from the eaves up to the part
 * standing on it (`rise` metres, never more than the data's roof), or a helmet of revolution
 * filling the data's roof.
 */
export type Crown = { readonly kind: "flat" } | { readonly kind: "skirt"; readonly rise: number; readonly inset: number } | { readonly kind: "helm"; readonly profile: HelmProfile };

/**
 * A helmet as a profile of revolution: [radius, height] from the eaves up, the radius a fraction
 * of the part's inner radius and the height a fraction of the data's roof. `lantern` is the open
 * lantern (from, to) and `mast` where the spire turns into Lublin 2077's mast, both as fractions.
 */
export interface HelmProfile {
  readonly shell: readonly (readonly [number, number])[];
  readonly lantern: readonly [number, number];
  readonly lanternRadius: number;
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
  /** A screen over the passage's mouth on the new town's side, with its text (an in-world sign, ADR-0056). */
  readonly screen?: string;
  /** A checkpoint in the passage (ADR-0048, `hebi-bramowa`): a scanner in the vault, strips on the jambs. */
  readonly checkpoint: boolean;
  /** A plaque by the passage on the new town's side (the museum inside, G-051). */
  readonly plaque?: string;
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
 * tower and the helmet with a lantern (Merlini, 1782). Heights from the data: the annex and the
 * tower's foot to 7.1 m, the tower to 16.7 m, the octagon to 19.9 m and its helmet 9.6 m.
 */
const BRAMA_KRAKOWSKA: LandmarkRecipe = {
  key: "brama-krakowska",
  parts: [
    {
      osm: "r7224409",
      tier: { material: "brick", plinth: 1.1, blinds: [{ pitch: 2.6, from: 0.38, to: 0.86 }], pilasters: false, cornice: true, base: false, openings: false, clock: false },
      crown: { kind: "flat" },
    },
    {
      osm: "w617597407",
      tier: {
        material: "brick",
        plinth: 0,
        blinds: [
          { pitch: 2.2, from: 0.08, to: 0.46 },
          { pitch: 2.2, from: 0.54, to: 0.9 },
        ],
        pilasters: false,
        cornice: true,
        base: false,
        openings: false,
        clock: false,
      },
      // The OSM roof (a 4.2 m dome) would bury the octagon (T-017): a low skirt round its foot instead.
      crown: { kind: "skirt", rise: 0.9, inset: 1.2 },
    },
    {
      osm: "w617878341",
      tier: { material: "plaster", plinth: 0, blinds: NO_BLINDS, pilasters: true, cornice: true, base: true, openings: true, clock: true },
      crown: {
        kind: "helm",
        profile: {
          // A Baroque bell: out over the cornice, swelling, drawn in to the lantern's neck.
          shell: [
            [1.06, 0],
            [1.02, 0.04],
            [0.94, 0.12],
            [0.76, 0.22],
            [0.5, 0.3],
            [0.34, 0.34],
          ],
          lantern: [0.34, 0.5],
          lanternRadius: 0.3,
          mast: 0.8,
        },
      },
    },
  ],
  layer: { newTown: { x: -0.96, z: -0.27 }, neon: "#ff2e88", warm: "#ffc98a", screen: "STARE MIASTO 旧市街", checkpoint: true, plaque: "Muzeum Historii Miasta Lublina" },
};

export const LANDMARK_RECIPES: readonly LandmarkRecipe[] = [BRAMA_KRAKOWSKA];

/** A part of a landmark with the recipe it belongs to. */
export interface LandmarkPart {
  readonly recipe: LandmarkRecipe;
  readonly part: PartRecipe;
}

/** Recipes by the OSM id of each of their buildings and parts. */
export const RECIPE_BY_OSM: ReadonlyMap<string, LandmarkPart> = new Map(LANDMARK_RECIPES.flatMap((recipe) => recipe.parts.map((part): [string, LandmarkPart] => [part.osm, { recipe, part }])));
