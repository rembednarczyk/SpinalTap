import type { EntityId } from "@seki/core";
import { MALL, MALL_LEVELS } from "@seki/sim";
import type { TransformNode, Vector3 } from "../../babylon";
import { eyeInP2 } from "./p2-view";

/**
 * The gallery's own moving meshes over P0 (ADR-0093 O1: the lifts' gates and platforms on P1..the
 * roof), hidden while the eye is down in P-2 or the shelter, as Alchemia's outside is
 * (`AlchemiaView`): from P-2's store the frustum took the gates up the shaft through the slabs and
 * the ground (one active mesh more in `npr-perf`'s P-2 scene).
 */
export const inAlchemiaGallery = (p: { readonly x: number; readonly y: number; readonly z: number }): boolean =>
  p.x > MALL.x0 - 0.5 && p.x < MALL.x1 + 0.5 && p.z > MALL.z0 - 0.5 && p.z < MALL.z1 + 0.5 && p.y > MALL_LEVELS.p1 - 0.5;

/** Shows and hides the gallery's moving meshes with where the eye is. */
export class AlchemiaGalleryCull {
  private readonly nodes = new Map<EntityId, TransformNode>();
  shown = true;

  /** A prop's root, kept if it stands in the gallery over P0; hidden at once while the eye is in P-2. */
  track(id: EntityId, root: TransformNode, at: Vector3): void {
    if (!inAlchemiaGallery(at)) return;
    this.nodes.set(id, root);
    root.setEnabled(this.shown);
  }

  untrack(id: EntityId): void {
    this.nodes.delete(id);
  }

  get size(): number {
    return this.nodes.size;
  }

  /** Judges the eye again. */
  update(eye: Vector3): void {
    const shown = !eyeInP2(eye);
    if (shown === this.shown) return;
    this.shown = shown;
    for (const n of this.nodes.values()) n.setEnabled(shown);
  }
}
