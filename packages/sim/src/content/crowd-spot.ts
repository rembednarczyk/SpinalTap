import type { ActivityId, Vec3 } from "@seki/core";

/** A place where a resident stands and does something, facing `yaw`. */
export interface CrowdSpot {
  readonly chunk: string;
  readonly at: Vec3;
  readonly yaw: number;
  /** What it does there; it changes with the passers-by's routine slots. */
  readonly does: readonly [ActivityId, ...ActivityId[]];
  /** Under a roof: no umbrella. */
  readonly indoor?: true;
  /**
   * Spots of one group (a bench's seats, a kiosk's queue, ADR-0050): the standers of a chunk take
   * a group's spots one after another, so people sit and queue together.
   */
  readonly group?: string;
}
