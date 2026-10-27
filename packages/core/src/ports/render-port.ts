import type { CameraMode, EffectDescriptor, EntityId, Transform, ViewDescriptor } from "./types";

export interface RenderPort {
  spawn(entityId: EntityId, view: ViewDescriptor, transform: Transform): void;
  updateTransform(entityId: EntityId, t: Transform): void;
  /** Removes an entity; the view may play an exit (e.g. a death fall) before it disappears. */
  despawn(entityId: EntityId): void;
  /** Removes every view immediately, without exit animations (new game, load). */
  clear(): void;
  setCameraMode(mode: CameraMode): void;
  /** Marks the entity the camera follows. */
  attachCamera(entityId: EntityId): void;
  playEffect(effect: EffectDescriptor): void;
}
