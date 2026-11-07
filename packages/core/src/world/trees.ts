/**
 * The species and size of a street tree (ADR-0047, G-422, G-423): pieces of kind `tree` whose
 * variant holds both, so the importer that picks and sizes them, the renderer that draws them, the
 * simulation's trunks and the glitch scan read one layout. A tree with no species in OSM takes one
 * of the first `PLAIN_SPECIES` from its seed, in `variant % 3`; one tagged with a genus of its own
 * (the oaks and the black poplar of Plac Litewski) takes it from the tags (`withTreeSpecies`).
 */

/** Species, as the renderer's tree models (`TREE_SHAPE`). */
export const TREE_KIND = { lime: 0, maple: 1, chestnut: 2, oak: 3, poplar: 4 } as const;

/** How many species there are. */
export const TREE_SPECIES = 5;

/** The species a tree with no species in OSM takes from its seed: lime, maple, horse chestnut. */
export const PLAIN_SPECIES = 3;

/** Top of each species' crown over the foot at size 1 (m): lime, maple, horse chestnut, oak, poplar. */
export const TREE_TOP: readonly number[] = [9.7, 8.4, 8.6, 9.6, 11.8];

/** How far each species' crown reaches from the trunk at size 1, any way it is turned (m). */
export const TREE_CROWN: readonly number[] = [2.9, 3.5, 3.5, 4.6, 3.3];

/** The sizes a measured tree takes: about 6 to 21-29 m over the ground by species (the oaks of Plac Litewski), in 1% steps. */
export const TREE_SCALE = { min: 0.7, max: 2.5, step: 0.01 } as const;

/**
 * The variants of measured trees start here, one species triple per size step (`3 * step +
 * species`), still within the 16 bits of a piece's variant. A multiple of 3, so `variant % 3`
 * stays the species; a seed this high is moved under it by `PLAIN_SHIFT`.
 */
const MEASURED = 0xf000;
/** A multiple of 3 above bit 7: moving a seed down by it keeps its species and its bits 4 to 7. */
const PLAIN_SHIFT = 0x3000;
/**
 * The variants of the species no seed picks (oak, poplar) start here, past the measured ones
 * (`MEASURED + 3 * 180 + 2`), one pair per size step: every such tree has its size as a step.
 */
const TAGGED = 0xf400;
const RARE = TREE_SPECIES - PLAIN_SPECIES;

const fromStep = (k: number): number => Math.round((TREE_SCALE.min + k * TREE_SCALE.step) * 100) / 100;
const stepOf = (scale: number): number => Math.round((Math.min(TREE_SCALE.max, Math.max(TREE_SCALE.min, scale)) - TREE_SCALE.min) / TREE_SCALE.step);

/** The species of a tree's variant (`TREE_KIND`). */
export const treeSpecies = (variant: number): number => (variant >= TAGGED ? PLAIN_SPECIES + ((variant - TAGGED) % RARE) : variant % PLAIN_SPECIES);

/**
 * The size of a tree: a measured or tagged one's from its variant, else 0.8 to 1.25 from bits 4
 * to 7 of its seed (a tree with no source of its height keeps the old random spread).
 */
export const treeScale = (variant: number): number => {
  if (variant >= TAGGED) return fromStep(Math.floor((variant - TAGGED) / RARE));
  if (variant >= MEASURED) return fromStep(Math.floor((variant - MEASURED) / PLAIN_SPECIES));
  return 0.8 + 0.45 * (((variant >> 4) % 16) / 15);
};

/** The variant of a tree of a 16-bit `seed` with no measured height: the seed, under the measured ones, of the same species and size. */
export const plainTreeVariant = (seed: number): number => (seed >= MEASURED ? seed - PLAIN_SHIFT : seed);

/** The variant of a tree of `species` at size step `k`. */
const sized = (species: number, k: number): number => (species < PLAIN_SPECIES ? MEASURED + PLAIN_SPECIES * k + species : TAGGED + RARE * k + species - PLAIN_SPECIES);

/**
 * The variant of a tree of `seed` grown to `height` metres over its foot, clamped to `TREE_SCALE`:
 * of `species`, by default the seed's (`seed % 3`).
 */
export const measuredTreeVariant = (seed: number, height: number, species = seed % PLAIN_SPECIES): number =>
  sized(species, stepOf(height / (TREE_TOP[species] ?? TREE_TOP[0]!)));

/**
 * A tree's variant of the same size as `variant`, of `species`: the size as a step of `TREE_SCALE`
 * (each of the old spread of sizes is one), so a plain seed's bits of size need not survive.
 */
export const withTreeSpecies = (variant: number, species: number): number => sized(species, stepOf(treeScale(variant)));

/** Height of a tree's crown top over its foot (m). */
export const treeHeight = (variant: number): number => (TREE_TOP[treeSpecies(variant)] ?? TREE_TOP[0]!) * treeScale(variant);
