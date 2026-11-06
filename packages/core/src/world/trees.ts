/**
 * The size of a street tree (ADR-0047, G-422): pieces of kind `tree` whose variant holds the
 * species in `variant % 3` and the size above it, so the importer that sizes them, the renderer
 * that draws them, the simulation's trunks and the glitch scan read one layout.
 */

/** Species, as the renderer's tree models (`TREE_SHAPE`). */
export const TREE_SPECIES = 3;

/** Top of each species' crown over the foot at size 1 (m): lime, maple, horse chestnut. */
export const TREE_TOP: readonly number[] = [9.7, 8.4, 8.6];

/** How far each species' crown reaches from the trunk at size 1, any way it is turned (m). */
export const TREE_CROWN: readonly number[] = [2.9, 3.5, 3.5];

/** The sizes a measured tree takes: about 6 to 21-24 m over the ground by species (the oaks of Plac Litewski), in 1% steps. */
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
 * The size of a tree: a measured one's from its variant, else 0.8 to 1.25 from bits 4 to 7 of
 * its seed (a tree with no source of its height keeps the old random spread).
 */
export const treeScale = (variant: number): number => {
  if (variant >= MEASURED) return Math.round((TREE_SCALE.min + Math.floor((variant - MEASURED) / TREE_SPECIES) * TREE_SCALE.step) * 100) / 100;
  return 0.8 + 0.45 * (((variant >> 4) % 16) / 15);
};

/** The variant of a tree of a 16-bit `seed` with no measured height: the seed, under the measured ones, of the same species and size. */
export const plainTreeVariant = (seed: number): number => (seed >= MEASURED ? seed - PLAIN_SHIFT : seed);

/** The variant of a tree of `seed` (its species in `seed % 3`) grown to `height` metres over its foot, clamped to `TREE_SCALE`. */
export const measuredTreeVariant = (seed: number, height: number): number => {
  const species = seed % TREE_SPECIES;
  const scale = height / (TREE_TOP[species] ?? TREE_TOP[0]!);
  const k = Math.round((Math.min(TREE_SCALE.max, Math.max(TREE_SCALE.min, scale)) - TREE_SCALE.min) / TREE_SCALE.step);
  return MEASURED + TREE_SPECIES * k + species;
};

/** Height of a tree's crown top over its foot (m). */
export const treeHeight = (variant: number): number => (TREE_TOP[variant % TREE_SPECIES] ?? TREE_TOP[0]!) * treeScale(variant);
