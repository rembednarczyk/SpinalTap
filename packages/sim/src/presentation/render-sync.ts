import { type EntityId, type RenderPort, type Transform, lerp, lerpAngle } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "../world/components";

/**
 * Mirrors the ECS world into a RenderPort: spawns new views, despawns removed ones and
 * pushes interpolated transforms for moving entities. Entities listed in `streamedOut`
 * (asleep in an unloaded chunk) are despawned as "unloaded", everything else as "removed".
 */
export class RenderSync {
  private readonly spawned = new Set<EntityId>();
  private cameraTarget: EntityId | null = null;

  constructor(private readonly port: RenderPort) {}

  sync(world: World<Entity>, alpha: number, streamedOut?: ReadonlySet<EntityId>): void {
    const seen = new Set<EntityId>();
    for (const e of world.with("view")) {
      seen.add(e.id);
      const moving = e.velocity !== undefined;
      const transform: Transform = {
        position: moving ? lerp(e.prevPosition, e.position, alpha) : e.position,
        yaw: moving ? lerpAngle(e.prevYaw, e.yaw, alpha) : e.yaw,
        pitch: e.pitch,
        speed: e.velocity ? Math.hypot(e.velocity.x, e.velocity.z) : 0,
        ...(e.posture ? { crouch: e.posture.prevAmount + (e.posture.amount - e.posture.prevAmount) * alpha } : {}),
      };
      if (!this.spawned.has(e.id)) {
        this.spawned.add(e.id);
        this.port.spawn(e.id, e.view, transform);
      } else if (moving) {
        this.port.updateTransform(e.id, transform);
      }
      if (e.player && this.cameraTarget !== e.id) {
        this.cameraTarget = e.id;
        this.port.attachCamera(e.id);
      }
    }
    for (const id of [...this.spawned]) {
      if (seen.has(id)) continue;
      this.spawned.delete(id);
      this.port.despawn(id, streamedOut?.has(id) ? "unloaded" : "removed");
    }
  }

  /** Despawns everything, e.g. before swapping in a freshly loaded world. */
  reset(): void {
    this.port.clear();
    this.spawned.clear();
    this.cameraTarget = null;
  }
}
