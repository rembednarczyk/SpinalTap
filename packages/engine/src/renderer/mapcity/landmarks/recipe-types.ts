/**
 * The types of the landmarks' recipes (ADR-0062): the kit's elements on each OSM building and part
 * and Lublin 2077's layer. Apart from the recipes (`recipes.ts`) so each landmark can have its own file
 * (`archikatedra.ts`) without an import cycle.
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
 * Battlements with `attic` stand on an attic over the outer walls up to the data's peak, the roof
 * behind it (a skillion down to the courtyard's eaves) hidden, the courtyard's walls to the eaves.
 */
export type Crown =
  | { readonly kind: "flat" }
  | {
      readonly kind: "crenel";
      readonly merlon: number;
      readonly pitch: number;
      readonly attic?: true;
    }
  | { readonly kind: "skirt"; readonly rise: number; readonly inset: number }
  | {
      readonly kind: "helm";
      readonly height: number;
      readonly profile: HelmProfile;
    }
  | { readonly kind: "roof"; readonly rise?: number }
  | SpireCrown;

/**
 * A neo-Gothic tower's top (`spire.ts`): over the cornice a gable `gable` metres tall on each side
 * (a clock in it), pinnacles `pinnacle` metres in from the corners, an octagonal spire to the data's
 * peak, its foot `base` of the body's half side, as wide to `shoulder` metres over the cornice.
 */
export interface SpireCrown {
  readonly kind: "spire";
  readonly gable: number;
  readonly pinnacle: number;
  readonly base: number;
  /** Metres over the cornice the spire keeps (nearly) its foot's width to, its broach behind the gables, before it tapers. */
  readonly shoulder: number;
  readonly clock: boolean;
}

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
  /** A church's gilded cross from `mast` up instead of Lublin 2077's mast, and no LEDs on the helmet. */
  readonly cross?: true;
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
  readonly niche?: {
    readonly from: number;
    readonly to: number;
    readonly width: number;
  };
  /** Lublin 2077's screen hangs on this tier's wall facing the new town (off the niche, T-034). */
  readonly screen?: boolean;
  /** OSM ids of the neighbouring tenements Lublin 2077's cables run to from this tier's wall facing the new town. */
  readonly cables?: readonly string[];
  /** The plaster's colour from the kit's swatches (OSM `building:colour`); absent: white. */
  readonly colour?: "beige" | "sand" | "ivory" | "pale";
  /** A cornice on the walls' top only where no part of the recipe stands on them (the Archikatedra's annexes under its chapels). */
  readonly eaves?: true;
  /** The data's roof in dark sheet metal or copper under patina; absent: tiles. */
  readonly roofing?: "metal" | "patina";
  /** A portico of the simulation's `PORTICOES` before a wall, its terrace's floor at this world y (the Archikatedra). */
  readonly portico?: { readonly floor: number };
  /** Round-headed windows along the walls facing away from the plaza (`church-roof.ts`). */
  readonly sideWindows?: SideWindows;
  /** A church's roofscape over this part: dormers, ridge turret, chapels' domes (`church-roof.ts`). */
  readonly roofscape?: ChurchRoof;
  /** A tower's storeys of pointed windows in pairs on each side, [bottom, top] over the base (`spire.ts`). */
  readonly towerWindows?: readonly (readonly [number, number])[];
  /** A church's front in bays on the wall facing the plaza (`cathedral-front.ts`). */
  readonly westFront?: WestFront;
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
  /** A neo-Gothic castle's gate front (Zamek Lubelski): turrets, parapet, rose windows, portal, lancets. */
  readonly castle?: CastleFront;
}

/** A box of the plan (world x0, z0, x1, z1) where a castle's crown or courtyard eaves stand at their own world y. */
export interface CrownZone {
  readonly box: readonly [number, number, number, number];
  readonly crown?: number;
  readonly eaves?: number;
}

/**
 * A neo-Gothic castle's front on the wall with the passage's mouth on the Old Town's side, and
 * lancets on every wall. Heights over the passage's floor at that mouth (the storeys run level
 * round the building), the crowns over the attic's top (the data's peak), metres.
 */
export interface CastleFront {
  /** Octagonal turrets on the outline's short runs at both ends of the gate's wall, a dark metal spire with a small pennant on each. */
  readonly turret: {
    readonly radius: number;
    readonly rise: number;
    readonly merlon: number;
    readonly mast: number;
  };
  /** The risalit's parapet between the turrets: over the attic, its triangular merlons' height and pitch. */
  readonly parapet: {
    readonly rise: number;
    readonly merlon: number;
    readonly pitch: number;
  };
  /** Two rose windows over the portal: radius, centre over the floor, apart from the axis. */
  readonly rose: {
    readonly r: number;
    readonly at: number;
    readonly off: number;
  };
  /** The pointed portal framing the passage's mouth: outer width and apex over the floor. */
  readonly portal: { readonly width: number; readonly apex: number };
  /**
   * Rows of lancets, [sill, head] over the floor, in bays `pitch` metres apart at most; `courtyard`
   * rows on the courtyard's walls only; a row fits under the wall's top or is left out.
   */
  readonly lancets: {
    readonly rows: readonly (readonly [number, number])[];
    readonly courtyard: readonly (readonly [number, number])[];
    readonly pitch: number;
    readonly width: number;
  };
  /** Over the outer walls' lancets: a round window of radius `r` at `oculus` over the floor in each bay, a frieze of arcades `frieze` tall under the battlements, `pitch` apart. */
  readonly upper: {
    readonly oculus: number;
    readonly r: number;
    readonly frieze: number;
    readonly pitch: number;
  };
  /**
   * Octagonal pinnacles of `radius` on the corners NMPT shows them, world x, z and the helm's tip
   * (world y): the shaft `shaft` metres over the battlements, a dark pointed helm over it.
   */
  readonly pinnacle: {
    readonly radius: number;
    readonly shaft: number;
    readonly at: readonly {
      readonly x: number;
      readonly z: number;
      readonly top: number;
    }[];
  };
  /**
   * The surface model's crown where it is not the data's peak: in each box (world x0, z0, x1, z1)
   * the outer walls' battlements to `crown` and the courtyard's walls to `eaves` (world y).
   */
  readonly crowns: readonly CrownZone[];
  /** The museum's sign on the portal's tympanum (an in-world sign, ADR-0056). */
  readonly sign: string;
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
  /**
   * Lublin 2077's technology on the old stone of a subdued landmark (the user's choice of 25.11,
   * after the Trinitarian Tower's mast and lit clocks): thin lines in this colour where the
   * building has an instrument (a helmet's ribs, a disc in a pediment), red obstruction lights on
   * its tops, a camera over its door. The warm lines on the cornices stay the Old Town's.
   */
  readonly tech?: string;
  /** A museum's gate in the passage (the tower's, `docs/lokacje/plac-katedralny.md`): the checkpoint's scanner arch in `tech`. */
  readonly gate?: boolean;
}

export interface LandmarkRecipe {
  readonly key: string;
  readonly parts: readonly PartRecipe[];
  readonly layer: Layer2077;
}

/** A round-headed opening of a church's front: its middle's offset from the axis along the wall, width and world y of its bottom and top. */
export interface FrontOpening {
  readonly at: number;
  readonly width: number;
  readonly y0: number;
  readonly y1: number;
}

/**
 * A church's front in bays (the Archikatedra, T-349 stage K2): pilasters, windows and doors by their
 * offsets (m) from where the axis through `axis` (a point on it, world) meets the wall, the sun in
 * the pediment's tympanum, a frieze band at a world y.
 */
export interface WestFront {
  readonly axis: { readonly x: number; readonly z: number };
  readonly pilasters?: readonly number[];
  readonly windows?: readonly FrontOpening[];
  readonly doors?: readonly FrontOpening[];
  readonly sun?: true;
  readonly frieze?: number;
}

/** Round-headed windows `pitch` metres apart, `width` wide, from world y0 to y1. */
export interface SideWindows {
  readonly pitch: number;
  readonly width: number;
  readonly y0: number;
  readonly y1: number;
  /** One window on the middle of each wall shorter than the pitch with room for it: an apse's facets (the photograph in the snow). */
  readonly facets?: boolean;
}

/**
 * A church's roofscape in world metres: dormers (their front's middle at x, z facing fx, fz, from
 * y0 to y1), a ridge turret (its foot at y, its cross's foot at top) and the chapels' domes (a drum
 * of radius r from y, `drum` tall, the lantern's cross at top).
 */
export interface ChurchRoof {
  readonly dormers: readonly { readonly x: number; readonly z: number; readonly fx: number; readonly fz: number; readonly y0: number; readonly y1: number }[];
  readonly turret?: { readonly x: number; readonly z: number; readonly y: number; readonly top: number };
  readonly domes: readonly { readonly x: number; readonly z: number; readonly y: number; readonly r: number; readonly drum: number; readonly top: number }[];
}
