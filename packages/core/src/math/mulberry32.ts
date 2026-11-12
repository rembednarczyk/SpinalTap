/**
 * mulberry32 (Tommy Ettinger): a tiny, fast seeded PRNG with 32 bits of state. The one copy in
 * the project: the simulation's `SeededRandom` steps it on a saveable state, presentation code
 * (city looks, crowd, music) takes a closure over a seed. Same seed, same stream, everywhere.
 */

/** Advances the 32-bit state by one step (Weyl increment). */
export const mulberry32Advance = (state: number): number => (state + 0x6d2b79f5) >>> 0;

/** The number in [0, 1) for a state that has just been advanced. */
export const mulberry32Output = (state: number): number => {
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** A stream of numbers in [0, 1) from `seed`. */
export const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = mulberry32Advance(state);
    return mulberry32Output(state);
  };
};
