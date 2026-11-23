import type { EntityId, Vec3, ViewDescriptor } from "@seki/core";
import type { Entity } from "../world/components";

/**
 * The near and the far picture of a character with a stand-in (ADR-0101): Alchemia's sellers are
 * full characters (a skinned model, its draw calls in every pass) only within `STAND_IN_NEAR` of
 * the player on her floor, the reach of a conversation and the next shops, and the crowd's figures
 * (one shared mesh for all of them, ADR-0041) past `STAND_IN_FAR` or a floor away. The renderer
 * draws a character to 60 m whatever lies between, and in the gallery that is all 44 sellers: as
 * full characters some 1390 draw calls on P1 with the models on against 355 before them. Between
 * the two distances it keeps the picture it has, so walking along the line does not swap it to and
 * fro. Pattern: discrete LOD with hysteresis (Luebke et al., "Level of Detail for 3D Graphics",
 * 2002) and the crowd LOD of the games that draw far people as cheap puppets. Presentation only:
 * the simulation does not read it.
 */
export const STAND_IN_NEAR = 6;
export const STAND_IN_FAR = 8;
/** Height apart within which it counts as her floor, and within which it stays so (the gallery's floors are 4.2 to 4.5 m apart). */
const NEAR_Y = 2;
const FAR_Y = 2.5;

export class StandIns {
  /** Stand-ins drawn as full characters now. */
  private readonly near = new Set<EntityId>();
  /** The view each stand-in was spawned with last. */
  private readonly sent = new Map<EntityId, ViewDescriptor>();

  /** The view `e` is drawn with now, by the player's distance (`at`, null without a player: far). */
  pick(e: Entity & { view: ViewDescriptor }, at: Vec3 | null): ViewDescriptor {
    if (!e.standIn) return e.view;
    const d = at ? Math.hypot(e.position.x - at.x, e.position.z - at.z) : Infinity;
    const dy = at ? Math.abs(e.position.y - at.y) : Infinity;
    const near = this.near.has(e.id) ? d <= STAND_IN_FAR && dy < FAR_Y : d < STAND_IN_NEAR && dy < NEAR_Y;
    if (near) this.near.add(e.id);
    else this.near.delete(e.id);
    return near ? e.view : e.standIn.view;
  }

  /** True when `view` differs from the one `id` was spawned with (then the port spawns it again). */
  changed(id: EntityId, view: ViewDescriptor): boolean {
    const last = this.sent.get(id);
    return last !== undefined && last !== view;
  }

  /** `id` was spawned with `view` (only a stand-in's is kept). */
  spawned(e: Entity, view: ViewDescriptor): void {
    if (e.standIn) this.sent.set(e.id, view);
  }

  forget(id: EntityId): void {
    this.near.delete(id);
    this.sent.delete(id);
  }

  clear(): void {
    this.near.clear();
    this.sent.clear();
  }
}
