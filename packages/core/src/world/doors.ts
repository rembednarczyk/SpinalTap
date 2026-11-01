/**
 * The doors on the facades of the map city (ADR-0058 stage 9): street pieces of kind `door`
 * whose variant holds the model and the size, so the importer that places them, the renderer
 * that draws them and the glitch scan read one layout.
 */

/**
 * The models, by what the entrance is: a steel door with a push bar (a staircase, a back door),
 * a steel double door (a main entrance), a shop's glazed door, a tall door with a fanlight (one
 * that takes a whole window or shop window of the ground floor), a security door with a code
 * panel (a bank) and a roller shutter (a service or garage entrance).
 */
export const DOOR_MODELS = ["steel", "steel-double", "shop", "tall", "code", "shutter"] as const;
export type DoorModel = (typeof DOOR_MODELS)[number];

/** Narrowest and lowest door the variant holds, and its steps (m). */
const MIN_WIDTH = 0.8;
const MIN_HEIGHT = 2.0;
const WIDTH_STEP = 0.05;
const HEIGHT_STEP = 0.02;
/** Model in bits 0-2, width in bits 3-8, height in bits 9-15. */
const WIDTH_STEPS = 63;
const HEIGHT_STEPS = 127;

/** The widest and the tallest door a variant holds (m). */
export const DOOR_MAX = { width: MIN_WIDTH + WIDTH_STEPS * WIDTH_STEP, height: Math.round((MIN_HEIGHT + HEIGHT_STEPS * HEIGHT_STEP) * 100) / 100 } as const;

export interface DoorLayout {
  readonly model: DoorModel;
  /** Across the wall and from the paving up, metres. */
  readonly width: number;
  readonly height: number;
}

/** Steps over `min`, rounded up (a hair of float slack), so a door is never smaller than asked: it covers what it was sized to cover. */
const steps = (v: number, min: number, step: number, most: number): number => Math.max(0, Math.min(most, Math.ceil((v - min) / step - 1e-6)));

/** The variant of a door, its size rounded up to the 5 cm (width) and 2 cm (height) the variant keeps, clamped to `DOOR_MAX`. */
export const doorVariant = (d: DoorLayout): number =>
  DOOR_MODELS.indexOf(d.model) + 8 * (steps(d.width, MIN_WIDTH, WIDTH_STEP, WIDTH_STEPS) + 64 * steps(d.height, MIN_HEIGHT, HEIGHT_STEP, HEIGHT_STEPS));

/** The door a variant holds. */
export const doorLayout = (variant: number): DoorLayout => ({
  model: DOOR_MODELS[variant & 7] ?? "steel",
  width: Math.round((MIN_WIDTH + ((variant >> 3) & 63) * WIDTH_STEP) * 100) / 100,
  height: Math.round((MIN_HEIGHT + ((variant >> 9) & 127) * HEIGHT_STEP) * 100) / 100,
});
