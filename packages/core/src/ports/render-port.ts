import type { Vec3 } from "../math/vec3";
import type { ActivityId, MetroRideView } from "../world/wave2";
import type { AppearanceDescriptor, CameraMode, DespawnReason, EffectDescriptor, EntityId, Transform, ViewDescriptor } from "./types";

/**
 * Stages of `RenderPort.prepare` in their order (ADR-0057): the character models and weapons,
 * the city kit, the city round the start, the shaders. The UI names them through its catalogs.
 */
export const PREPARE_STAGES = ["models", "cityKit", "city", "shaders"] as const;
export type PrepareStage = (typeof PREPARE_STAGES)[number];

export interface RenderPort {
  spawn(entityId: EntityId, view: ViewDescriptor, transform: Transform): void;
  updateTransform(entityId: EntityId, t: Transform): void;
  /**
   * Removes an entity. "removed" (the default) lets the view play an exit, e.g. a death fall;
   * "unloaded" means world streaming put it to sleep, so it disappears without ceremony.
   */
  despawn(entityId: EntityId, reason?: DespawnReason): void;
  /** Removes every view immediately, without exit animations (new game, load). */
  clear(): void;
  setCameraMode(mode: CameraMode): void;
  /** Marks the entity the camera follows. */
  attachCamera(entityId: EntityId): void;
  playEffect(effect: EffectDescriptor): void;
  /**
   * Dresses and arms a spawned character. Separate from `spawn`, so changing clothes or weapons
   * never respawns the view (or reloads an imported model). Unknown ids are ignored.
   */
  setAppearance(entityId: EntityId, appearance: AppearanceDescriptor): void;
  /** Accessibility (ADR-0028): no chromatic aberration, glitch or flicker; slow fades only. */
  setReduceFlashes?(on: boolean): void;
  /** The character now does `activity` where it stands (ADR-0037); null returns it to walking and idling. */
  setActivity?(entityId: EntityId, activity: ActivityId | null): void;
  /** The metro car on screen while the player rides (ADR-0036); null back to the city. */
  setMetroRide?(ride: MetroRideView | null): void;
  /**
   * Loads what the start of a game needs before it is shown (ADR-0057): models, the city kit,
   * the city round `at` (where the player starts) and the shaders. `onProgress` reports the
   * share done so far, 0..1 and never going back, with the stage under way. Resolves once every
   * stage is over; a file that fails to load does not reject it (the procedural look stays).
   * A renderer without it starts the game at once.
   */
  prepare?(at: Vec3, onProgress: (done: number, stage: PrepareStage) => void): Promise<void>;
  /**
   * The start under way leads nowhere any more (back to the title): `prepare` stops drawing its
   * warm-up frames and resolves. Optional, like `prepare`.
   */
  cancelPrepare?(): void;
}
