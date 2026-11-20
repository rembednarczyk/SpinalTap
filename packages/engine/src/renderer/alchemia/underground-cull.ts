import type { EntityId } from "@seki/core";
import { INTERIORS } from "@seki/sim";
import type { TransformNode, Vector3 } from "../../babylon";

/**
 * Alchemia's buried levels from afar (ADR-0074 stage 5e), as W-3's hall (`W3InteriorCull`): the
 * props in P-2's and the shelter's rooms that are meshes of their own (P-2's robots, the car lift's
 * platform and car, the shelter's devices) are drawn only while the eye is within `RANGE` of those
 * rooms. From Zielona they were drawn under the ground some 170 m off, in the building site's
 * scene's frame.
 */

const RANGE = 30;
/** Past a room's walls a prop still counts as in it; this far under its floor too (the lift's platform). */
const MARGIN = 0.25;
const BELOW = 0.5;

type Room = (typeof INTERIORS)[number]["rooms"][number];

const ROOMS: readonly Room[] = INTERIORS.filter((i) => i.id === "alchemia-p2" || i.id === "alchemia-shelter").flatMap((i) => i.rooms);
const BOUNDS = {
  minX: Math.min(...ROOMS.map((r) => r.minX)),
  maxX: Math.max(...ROOMS.map((r) => r.maxX)),
  minY: Math.min(...ROOMS.map((r) => r.bottom)),
  maxY: Math.max(...ROOMS.map((r) => r.top)),
  minZ: Math.min(...ROOMS.map((r) => r.minZ)),
  maxZ: Math.max(...ROOMS.map((r) => r.maxZ)),
};

/** Is a prop centred at `p` in a room of P-2 or the shelter? */
export const inAlchemiaUnderground = (p: { readonly x: number; readonly y: number; readonly z: number }): boolean =>
  ROOMS.some((r) => p.x > r.minX - MARGIN && p.x < r.maxX + MARGIN && p.z > r.minZ - MARGIN && p.z < r.maxZ + MARGIN && p.y > r.bottom - BELOW && p.y < r.top);

/** How far the eye is from the box round those rooms (0 inside it). */
export const alchemiaUndergroundDistance = (eye: { readonly x: number; readonly y: number; readonly z: number }): number =>
  Math.hypot(
    Math.max(BOUNDS.minX - eye.x, 0, eye.x - BOUNDS.maxX),
    Math.max(BOUNDS.minY - eye.y, 0, eye.y - BOUNDS.maxY),
    Math.max(BOUNDS.minZ - eye.z, 0, eye.z - BOUNDS.maxZ),
  );

/** Shows and hides the buried levels' own meshes with the eye's distance. */
export class AlchemiaUndergroundCull {
  private readonly nodes = new Map<EntityId, TransformNode>();
  shown = false;

  /** A prop's root, kept if it stands down there; hidden at once when the eye is away. */
  track(id: EntityId, root: TransformNode, at: Vector3): void {
    if (!inAlchemiaUnderground(at)) return;
    this.nodes.set(id, root);
    root.setEnabled(this.shown);
  }

  untrack(id: EntityId): void {
    this.nodes.delete(id);
  }

  get size(): number {
    return this.nodes.size;
  }

  /** Judges the eye's distance again. */
  update(eye: Vector3): void {
    const near = alchemiaUndergroundDistance(eye) <= RANGE;
    if (near === this.shown) return;
    this.shown = near;
    for (const n of this.nodes.values()) n.setEnabled(near);
  }
}
