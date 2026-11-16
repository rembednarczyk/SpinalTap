import type { EntityId } from "@seki/core";
import { INTERIORS, W3_LAYOUT, W3_ROW_N, W3_ROW_S, W3_Y } from "@seki/sim";
import type { TransformNode, Vector3 } from "../../babylon";

/**
 * W-3's hall from afar (ADR-0082 §4, stage 2): the props inside its rooms that are meshes of
 * their own (the doors' leaves, the stairs, the ladders; its walls and furniture are baked by
 * `W3View`, stage 2b) are drawn only while the eye is within
 * `W3_INTERIOR_RANGE` of the rooms. From the bridge they were some forty meshes behind the
 * shell's walls. The doors in the hall's outer walls, its outer walls and the cooling units on
 * its roof stand outside every room by more than `MARGIN` and stay.
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

/**
 * Is a baked block of the inside centred at `p` drawn with the hall (`w3InsideGeometry`): inside its outer walls, under the
 * low roofs' underside over row N (the airlocks', row N's outer walls and the cooling units on
 * the roof stay), to its ceilings over the rest, down to the basement's floor; and the culvert
 * under the terrace (its mouth by the river stays). Ceilings and floors are not in any room and
 * are drawn with the hall; the shut leaves stand in the facades' doorways, outside it.
 */
export const inW3Hall = (p: { readonly x: number; readonly y: number; readonly z: number }): boolean => {
  const y = p.y - W3_Y;
  const c = W3_LAYOUT.CULVERT_Z;
  if (y < 0 && p.x >= W3_LAYOUT.CULVERT_CRAWL.minX && p.x < W3_ROW_S.minX + 0.31 && p.z > c.minZ - 0.5 && p.z < c.maxZ + 0.5) return true;
  // Row S lines its own facade (the map city's); north of it the airlocks' and row N's outer walls are the blocks at x 2500..2500.3.
  if (y < -5 || p.x < W3_ROW_S.minX + (p.z < W3_ROW_S.maxZ ? 0 : 0.31)) return false;
  // Under the floor the basement's south wall stands outside the facade's line.
  if (p.z >= W3_ROW_S.minZ - (y < 0 ? 0.5 : 0) && p.z < W3_ROW_N.minZ) return p.x < W3_ROW_S.maxX && y < 16;
  return p.z >= W3_ROW_N.minZ && p.z < W3_ROW_N.maxZ - 0.31 && p.x < W3_ROW_N.maxX - 0.31 && y < 10;
};

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
  /** Whether the hall's meshes are drawn now. */
  shown = false;

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

  /** Judges the eye's distance again; true when the hall's meshes were shown or hidden. */
  update(eye: Vector3): boolean {
    const near = w3InteriorDistance(eye) <= W3_INTERIOR_RANGE;
    if (near === this.shown) return false;
    this.shown = near;
    for (const n of this.nodes.values()) n.setEnabled(near);
    return true;
  }
}
