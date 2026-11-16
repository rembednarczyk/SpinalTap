import { SNAP_DOWN, STEP_HEIGHT } from "../systems/movement-system";
import { MAX_WALK_SLOPE } from "./ground";

/**
 * One rule for whether a walker gets from one spot of the ground to the next (ADR-0080, point 5),
 * shared by the glitch scan's `walk-blocked` and, later, the AI's planner (`nav-raster.ts`).
 * It reads only what the movement reads: the ground's height (`groundY`, decks included), its
 * slope over half a metre (ADR-0043) and whether the spot is on a flight of steps.
 */

/** A spot of the ground a walker stands on. */
export interface WalkCell {
  /** The ground's height there (m). */
  readonly y: number;
  /** Its steepness, rise over run, from central differences over 0.5 m (ADR-0043). */
  readonly slope: number;
  /** On a flight of steps, whose own grade is no bank. */
  readonly flight: boolean;
}

/** Why a walker does not get from one spot to the next. */
export type WalkBlock = "rise" | "drop" | "steep";

/**
 * Does a walker get from `a` to the neighbouring `b`? Null when it does, else why not:
 * - `rise`: `b` lies more than `STEP_HEIGHT` (0.45 m) over `a`, a ledge the movement does not climb;
 * - `drop`: `b` lies more than `SNAP_DOWN` (0.35 m) under `a`, past what the feet snap down to;
 * - `steep`: `b` is a bank steeper than `MAX_WALK_SLOPE` (tg 35°, ADR-0043), off a flight of steps.
 */
export const walkStep = (a: WalkCell, b: WalkCell): WalkBlock | null => {
  const dy = b.y - a.y;
  if (dy > STEP_HEIGHT) return "rise";
  if (-dy > SNAP_DOWN) return "drop";
  if (!b.flight && b.slope > MAX_WALK_SLOPE) return "steep";
  return null;
};

/** Is the way between two neighbouring spots open both ways (the scan's pair of cells)? */
export const walkBoth = (a: WalkCell, b: WalkCell): WalkBlock | null => walkStep(a, b) ?? walkStep(b, a);
