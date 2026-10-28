import type { ActivityId } from "../world/wave2";
import type { AppearanceDescriptor, CameraMode, DespawnReason, EffectDescriptor, EntityId, Transform, ViewDescriptor } from "./types";

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
}
