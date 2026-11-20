import type { EntityId } from "@seki/core";
import { MALL, MALL_LEVELS } from "@seki/sim";
import type { TransformNode, Vector3 } from "../../babylon";
import { eyeInP2 } from "./p2-view";

/**
 * The gallery's own moving meshes over P0 (ADR-0093 O1: the lifts' gates and platforms on P1..the
 * roof), hidden while the eye is down in P-2 or the shelter, as Alchemia's outside is
 * (`AlchemiaView`): from P-2's store the frustum took the gates up the shaft through the slabs and
 * the ground (one active mesh more in `npr-perf`'s P-2 scene). Hidden too from afar: they stand inside
 * the building, and from Zielona some 180 m west the frustum took them over the roofs (three draw
 * calls more in `npr-perf`'s Zielona scene).
 */

/** Farther than this from the gallery's walls (m, on the ground) the eye sees none of its lifts' gates. */
export const GALLERY_DRAW = 60;

/** How far the eye is from the gallery's footprint, on the ground (0 inside). */
const fromGallery = (eye: { readonly x: number; readonly z: number }): number =>
  Math.hypot(Math.max(MALL.x0 - eye.x, 0, eye.x - MALL.x1), Math.max(MALL.z0 - eye.z, 0, eye.z - MALL.z1));
export const inAlchemiaGallery = (p: { readonly x: number; readonly y: number; readonly z: number }): boolean =>
  p.x > MALL.x0 - 0.5 && p.x < MALL.x1 + 0.5 && p.z > MALL.z0 - 0.5 && p.z < MALL.z1 + 0.5 && p.y > MALL_LEVELS.p1 - 0.5;

/** Shows and hides the gallery's moving meshes with where the eye is. */
export class AlchemiaGalleryCull {
  private readonly nodes = new Map<EntityId, TransformNode>();
  shown = true;

  /** A prop's root, kept if it stands in the gallery over P0; hidden at once while the eye is in P-2 or afar. */
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
    const shown = !eyeInP2(eye) && fromGallery(eye) <= GALLERY_DRAW;
    if (shown === this.shown) return;
    this.shown = shown;
    for (const n of this.nodes.values()) n.setEnabled(shown);
  }
}
