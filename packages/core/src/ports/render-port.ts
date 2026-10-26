import type { CameraMode, EffectDescriptor, EntityId, Transform, ViewDescriptor } from "./types";

export interface RenderPort {
  spawn(entityId: EntityId, view: ViewDescriptor, transform: Transform): void;
  updateTransform(entityId: EntityId, t: Transform): void;
  despawn(entityId: EntityId): void;
  setCameraMode(mode: CameraMode): void;
  /** Marks the entity the camera follows. */
  attachCamera(entityId: EntityId): void;
  playEffect(effect: EffectDescriptor): void;
}
