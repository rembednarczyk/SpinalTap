/**
 * The one norm of an outdoor step in the whole game (G-840): what the renderer lays a flight of
 * the map's steps by and the glitch scan holds it to. A riser of 0.15 m on a tread of 0.32 m, the
 * stride 2h + s of a granite flight; a flight runs at most `maxRun` risers before a landing.
 */
export const STEP_NORM = {
  /** The riser a flight aims for (m). */
  riser: 0.15,
  /** The lowest and highest riser of the norm (m). */
  riserMin: 0.12,
  riserMax: 0.17,
  /** The stride 2h + s a flight's treads are cut to (m): 0.62 gives a tread of 0.32 on a riser of 0.15. */
  stride: 0.62,
  /** The stride's bounds (m). */
  strideMin: 0.6,
  strideMax: 0.66,
  /** The most risers of a flight between two landings. */
  maxRun: 12,
  /** The shortest landing (m): a level stretch shorter than this between two risers is a stretched tread. */
  landingMin: 1,
} as const;

/** The tread of a riser `h` by the norm's stride (m). */
export const normTread = (h: number): number => STEP_NORM.stride - 2 * h;

/** Whether a riser `h` and the tread `s` after it keep the norm: the riser in its bounds, 2h + s in the stride's. */
export const inStepNorm = (h: number, s: number): boolean =>
  h >= STEP_NORM.riserMin - 1e-6 && h <= STEP_NORM.riserMax + 1e-6 && 2 * h + s >= STEP_NORM.strideMin - 1e-6 && 2 * h + s <= STEP_NORM.strideMax + 1e-6;
