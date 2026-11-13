/**
 * The bell towers the renderer raises on Lublin's churches (G-215, T-121), from the data and not
 * from the outline's shape. The rule they replace stood one or two towers at every church's west
 * end with walls 1.7 times its own: four churches without a tower got one (the Capuchins, St
 * Peter's, St Adalbert's, Niecała 4), the Holy Spirit two where it has one at its south-west
 * corner, and the Transfiguration a tower 13 m too tall. A church not listed here takes none: it
 * has no tower, or the map has its tower as a building or a part of its own (St Josaphat's, St
 * Nicholas's, the Brigittines', the Archikatedra, G-212, G-049), or its tower waits for its part
 * (the Bernardines', G-214).
 *
 * Both towers are in GUGiK LoD2 (2011) as a helmet's facets meeting over a small square, the
 * only such spikes over the churches the rule crowned, and in NMPT GUGiK 0.5 m. Plans, cornices
 * and tips are NMPT's (T-121), the plans checked against LoD2's apex; LoD2 puts eaves low (its
 * Holy Spirit's helmet starts 1 m under NMPT's cornice). LoD2's heights over its ground are put
 * into world y by the game's ground at the church (LoD2 ground less 195.9 m at both).
 */

/**
 * A church's bell tower: the middle and half the side of its square plan (world metres), the
 * world y of its cornice and of its helmet's tip, and the helmet's shape where the data shows it
 * (a baroque helmet or a cupola, else a spire; absent: chosen by the church's look).
 */
export interface BellTower {
  readonly x: number;
  readonly z: number;
  readonly half: number;
  readonly top: number;
  readonly tip: number;
  readonly helmet?: boolean;
}

/** The churches with a tower of the renderer's, by OSM id. */
export const BELL_TOWERS: ReadonlyMap<string, readonly BellTower[]> = new Map([
  // Holy Spirit (Krakowskie Przedmieście): one slender tower at the south-west corner, NMPT x
  // 369..374.5, z -84..-79, its plan's rim (the cornice) at a median y 18.1 (p25-p75 17.6-18.5),
  // a baroque helmet with a lantern to y 26.5; LoD2 helmet 17.6..27.0 over its ground 195.4 at
  // (371.4, -83.1), its facets over x 368.5..374.7, z -85.8..-79.6. The middle sits in the corner
  // of the map's outline, NMPT's plan moved 0.7 m onto it.
  ["w66264126", [{ x: 371.6, z: -82.7, half: 2.75, top: 18.1, tip: 26.5, helmet: true }]],
  // Transfiguration (Ruska): the belfry over the west entrance, NMPT x 979.7..986.2, z
  // 427.7..434.3, cornice y 1.4, a cupola with a lantern to y 6.5; LoD2 cornice 18.8 and apex 23.4
  // over its ground 178.5 at (983.1, 430.9).
  ["w66264148", [{ x: 983.0, z: 431.0, half: 3.25, top: 1.4, tip: 6.5, helmet: true }]],
]);
