import type { EntityId } from "@seki/core";
import { INTERIORS } from "@seki/sim";
import type { TransformNode, Vector3 } from "../../babylon";

/**
 * W-3's hall from afar (ADR-0082 §4, stage 2): the props inside its rooms that are meshes of
 * their own (the doors' leaves, the stairs, the ladders; its walls and furniture are merged per
 * area, ADR-0038) are drawn only while the eye is within `W3_INTERIOR_RANGE` of the rooms. From
 * the bridge they were some forty meshes behind the shell's walls. The doors in the hall's outer
 * walls stand outside every room by more than `MARGIN` and stay.
 */

/** "The static inside: in it, up to 30 m from its walls" (ADR-0082 §4). */
export const W3_INTERIOR_RANGE = 30;
/** Past a room's walls a prop still counts as in it: a door's leaf in a partition 0.2 m thick. */
const MARGIN = 0.12;
/** A prop's centre this far under a room's floor still counts (a flight of stairs down). */
const BELOW = 0.5;

type Room = (typeof INTERIORS)[number]["rooms"][number];

const ROOMS: readonly Room[] = INTERIORS.filter((i) => i.id === "w3-hall" || i.id === "w3-basement").flatMap((i) => i.rooms);

/** The hall's rooms, without the basement's: the culvert's mouth lies by the river, 13 m off the bridge. */
const HALL = INTERIORS.filter((i) => i.id === "w3-hall").flatMap((i) => i.rooms);
const BOUNDS = {
  minX: Math.min(...HALL.map((r) => r.minX)),
  maxX: Math.max(...HALL.map((r) => r.maxX)),
  minY: Math.min(...HALL.map((r) => r.bottom)),
  maxY: Math.max(...HALL.map((r) => r.top)),
  minZ: Math.min(...HALL.map((r) => r.minZ)),
  maxZ: Math.max(...HALL.map((r) => r.maxZ)),
};

/** Is a prop centred at `p` inside a room of W-3's hall or basement? */
export const inW3Interior = (p: { readonly x: number; readonly y: number; readonly z: number }): boolean =>
  ROOMS.some((r) => p.x > r.minX - MARGIN && p.x < r.maxX + MARGIN && p.z > r.minZ - MARGIN && p.z < r.maxZ + MARGIN && p.y > r.bottom - BELOW && p.y < r.top);

/** How far the eye is from the box round the hall's rooms (0 inside it). */
export const w3InteriorDistance = (eye: { readonly x: number; readonly y: number; readonly z: number }): number =>
  Math.hypot(
    Math.max(BOUNDS.minX - eye.x, 0, eye.x - BOUNDS.maxX),
    Math.max(BOUNDS.minY - eye.y, 0, eye.y - BOUNDS.maxY),
    Math.max(BOUNDS.minZ - eye.z, 0, eye.z - BOUNDS.maxZ),
  );

/** Shows and hides the hall's own meshes with the eye's distance. */
export class W3InteriorCull {
  private readonly nodes = new Map<EntityId, TransformNode>();
  private shown = false;

  /** A prop's root, kept if it stands in the hall; hidden at once when the eye is away. */
  track(id: EntityId, root: TransformNode, at: Vector3): void {
    if (!inW3Interior(at)) return;
    this.nodes.set(id, root);
    root.setEnabled(this.shown);
  }

  untrack(id: EntityId): void {
    this.nodes.delete(id);
  }

  get size(): number {
    return this.nodes.size;
  }

  update(eye: Vector3): void {
    const near = w3InteriorDistance(eye) <= W3_INTERIOR_RANGE;
    if (near === this.shown) return;
    this.shown = near;
    for (const n of this.nodes.values()) n.setEnabled(near);
  }
}
