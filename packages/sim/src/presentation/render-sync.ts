import { type ActivityId, type AppearanceDescriptor, type DomainState, ENEMY_TYPES, type EntityId, type RenderPort, type Transform, appearanceOf, appearanceOfEnemy, lerp, lerpAngle, sameAppearance } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "../world/components";

type AimFields = Pick<Transform, "aim" | "aimZoom" | "guard">;

/**
 * Aim and guard for the presentation (ADR-0019): the player's eased aim down sights with the
 * zoom of the weapon in hand, an NPC's weapon up while it fights, the guard of either.
 */
const aimOf = (e: Entity, alpha: number): AimFields => {
  const out: { aim?: number; aimZoom?: number; guard?: number } = {};
  if (e.posture) {
    out.aim = e.posture.prevAim + (e.posture.aim - e.posture.prevAim) * alpha;
    out.aimZoom = e.combatant?.stats?.ads?.zoom ?? 1;
  } else if (e.combatant?.engaged) out.aim = 1;
  if (e.melee?.guard) out.guard = 1;
  return out;
};

/**
 * Mirrors the ECS world into a RenderPort: spawns new views, despawns removed ones and
 * pushes interpolated transforms for moving entities. Entities listed in `streamedOut`
 * (asleep in an unloaded chunk) are despawned as "unloaded", everything else as "removed".
 */
export class RenderSync {
  private readonly spawned = new Set<EntityId>();
  private cameraTarget: EntityId | null = null;
  /** Last appearance sent per entity; a new one goes out only when it differs (ADR-0015). */
  private readonly looks = new Map<EntityId, AppearanceDescriptor>();
  /** Last activity sent per entity (ADR-0040); a change goes out once, null when it stops. */
  private readonly activities = new Map<EntityId, ActivityId>();
  private playerLook: { inv: unknown; eq: unknown; cyber: unknown; look: AppearanceDescriptor } | null = null;

  constructor(private readonly port: RenderPort) {}

  sync(world: World<Entity>, alpha: number, streamedOut?: ReadonlySet<EntityId>, domain?: DomainState): void {
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
        ...aimOf(e, alpha),
        // Jumps, falls and ladders (ADR-0021).
        ...(e.fall !== undefined ? { air: e.fall } : {}),
        ...(e.climb ? { climb: e.climb.speed } : {}),
        // A pull-up onto a ledge borrows the ladder pose: arms up, the body rising.
        ...(e.mantle ? { climb: 1.5 } : {}),
      };
      if (!this.spawned.has(e.id)) {
        this.spawned.add(e.id);
        this.port.spawn(e.id, e.view, transform);
      } else if (moving) {
        this.port.updateTransform(e.id, transform);
      }
      const look = this.appearanceFor(e, domain);
      if (look && !sameAppearance(this.looks.get(e.id) ?? null, look)) {
        this.looks.set(e.id, look);
        this.port.setAppearance(e.id, look);
      }
      this.syncActivity(e);
      if (e.player && this.cameraTarget !== e.id) {
        this.cameraTarget = e.id;
        this.port.attachCamera(e.id);
      }
    }
    for (const id of [...this.spawned]) {
      if (seen.has(id)) continue;
      this.spawned.delete(id);
      this.looks.delete(id);
      this.activities.delete(id);
      this.port.despawn(id, streamedOut?.has(id) ? "unloaded" : "removed");
    }
  }

  /** Despawns everything, e.g. before swapping in a freshly loaded world. */
  reset(): void {
    this.port.clear();
    this.spawned.clear();
    this.looks.clear();
    this.activities.clear();
    this.playerLook = null;
    this.cameraTarget = null;
  }

  /** What the character does where it stands (ADR-0040), sent when it changes. */
  private syncActivity(e: Entity): void {
    const next = e.activity ?? null;
    if ((this.activities.get(e.id) ?? null) === next) return;
    if (next === null) this.activities.delete(e.id);
    else this.activities.set(e.id, next);
    this.port.setActivity?.(e.id, next);
  }

  /** The player's look follows the equipment; an enemy's comes from its type. */
  private appearanceFor(e: Entity, domain: DomainState | undefined): AppearanceDescriptor | null {
    if (e.player && domain) {
      const p = this.playerLook;
      if (p && p.inv === domain.inventory && p.eq === domain.equipment && p.cyber === domain.character.cyberware) return p.look;
      const look = appearanceOf(domain.inventory, domain.equipment, domain.character.cyberware);
      this.playerLook = { inv: domain.inventory, eq: domain.equipment, cyber: domain.character.cyberware, look };
      return look;
    }
    if (e.enemy) return appearanceOfEnemy(ENEMY_TYPES[e.enemy.type]);
    return null;
  }
}
